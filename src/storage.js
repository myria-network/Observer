const PREFIX=/^[a-z][a-z0-9_]{0,31}$/;
const NETWORK=/^[a-f0-9]{64}$/;
const ENTITY_MODULES=Object.freeze(['spores','objects','contracts','collections','catalogs','propagations','discoveries']);
const MAX_JSON_BYTES=4*1024*1024;
const DEFAULT_EVENT_RETENTION_MS=7*24*60*60*1000;
const DEFAULT_METRIC_RETENTION_MS=90*24*60*60*1000;

export const OBSERVER_DATABASE_BLUEPRINT=Object.freeze({
  entities:Object.freeze({suffix:'entities',primaryKey:['networkId','kind','entityId'],description:'Esporas, objetos, contratos, colecciones, catálogos y claims ya admitidos por el Observer.'}),
  routes:Object.freeze({suffix:'routes',primaryKey:['networkId','routeId'],description:'Rutas descubiertas, carrier, admisión, disponibilidad y fechas de verificación.'}),
  events:Object.freeze({suffix:'events',primaryKey:['networkId','eventId'],retentionMs:DEFAULT_EVENT_RETENTION_MS,description:'Historial operativo acotado para actividad y auditoría.'}),
  metrics:Object.freeze({suffix:'metrics',primaryKey:['networkId','timestamp'],retentionMs:DEFAULT_METRIC_RETENTION_MS,description:'Snapshots agregados; evita incrementar la base por cada anuncio.'}),
  checkpoints:Object.freeze({suffix:'checkpoints',primaryKey:['networkId','name'],description:'Estado del worker de proyección y fecha de la última sincronización.'}),
});

export function observerDatabaseNames(prefix='myria_observer'){
  if(typeof prefix!=='string'||!PREFIX.test(prefix))throw new TypeError('INVALID_DATABASE_PREFIX');
  return Object.freeze(Object.fromEntries(Object.entries(OBSERVER_DATABASE_BLUEPRINT).map(([key,value])=>[key,`${prefix}_${value.suffix}`])));
}

function integer(value,fallback=0){return Number.isSafeInteger(value)&&value>=0?value:fallback;}
function compactJson(value){const text=JSON.stringify(value);if(!text||new TextEncoder().encode(text).length>MAX_JSON_BYTES)throw new Error('OBSERVER_DATABASE_RECORD_TOO_LARGE');return text;}
function identifier(value,label){if(typeof value!=='string'||!value||value.length>128)throw new Error(label);return value;}
function chunks(items,size=100){const result=[];for(let index=0;index<items.length;index+=size)result.push(items.slice(index,index+size));return result;}
function entityRecord(networkId,kind,item){
  const entityId=identifier(item?.id??item?.contractId,'INVALID_ENTITY_ID');
  return {networkId,kind,entityId,status:typeof item.status==='string'?item.status:'OBSERVED',firstObservedAt:integer(item.firstObservedAt),lastObservedAt:integer(item.lastObservedAt),lastVerifiedAt:integer(item.lastVerifiedAt),payload:item};
}
function routeRecord(networkId,item){return {networkId,routeId:identifier(item?.routeId,'INVALID_ROUTE_ID'),targetType:String(item.targetType??''),targetId:identifier(item?.targetId,'INVALID_ROUTE_TARGET'),carrierClass:String(item.carrierClass??'UNKNOWN'),verificationStatus:String(item.verificationStatus??'UNVERIFIED'),firstObservedAt:integer(item.firstObservedAt),lastObservedAt:integer(item.lastObservedAt),lastVerifiedAt:integer(item.lastVerifiedAt),payload:item};}
function eventRecord(networkId,item){return {networkId,eventId:identifier(String(item?.id??''),'INVALID_EVENT_ID'),timestamp:integer(item.timestamp),eventType:String(item.eventType??'unknown'),targetType:String(item.targetType??'UNKNOWN'),targetId:identifier(item.targetId??'unknown','INVALID_EVENT_TARGET'),payload:item};}
function requireDatabase(database){for(const method of ['initialize','upsertEntities','upsertRoutes','upsertEvents','insertMetric','setCheckpoint','prune'])if(typeof database?.[method]!=='function')throw new TypeError(`DATABASE_METHOD_REQUIRED:${method}`);return database;}

/**
 * Asynchronous, bounded projection worker. The Observer remains authoritative for
 * admission and cryptographic verification; this worker only persists its public DTOs.
 */
export class ObserverProjectionWorker{
  #client;#database;#pageSize;#intervalMs;#timer;#running=false;#stopped=true;#lastError;#lastSyncAt=0;
  constructor({client,database,pageSize=100,intervalMs=15000}={}){
    if(typeof client?.catalog!=='function'||typeof client?.health!=='function')throw new TypeError('OBSERVER_CLIENT_REQUIRED');
    if(!Number.isInteger(pageSize)||pageSize<1||pageSize>200)throw new TypeError('INVALID_PAGE_SIZE');
    if(!Number.isInteger(intervalMs)||intervalMs<5000||intervalMs>3600000)throw new TypeError('INVALID_INTERVAL');
    this.#client=client;this.#database=requireDatabase(database);this.#pageSize=pageSize;this.#intervalMs=intervalMs;
  }
  status(){return Object.freeze({running:this.#running,stopped:this.#stopped,lastSyncAt:this.#lastSyncAt,lastError:this.#lastError});}
  async initialize(){await this.#database.initialize();return this;}
  async syncOnce(){
    if(this.#running)return false;this.#running=true;this.#lastError=undefined;
    try{
      const health=await this.#client.health();if(!NETWORK.test(health.networkId))throw new Error('INVALID_NETWORK_ID');const networkId=health.networkId;
      for(const module of ENTITY_MODULES){
        const page=await this.#client.catalog({module,params:{limit:this.#pageSize,offset:0}}),items=Array.isArray(page?.items)?page.items:[];
        await this.#database.upsertEntities(items.map(item=>entityRecord(networkId,module,item)));
      }
      const routePage=await this.#client.catalog({module:'routes',params:{limit:this.#pageSize,offset:0}});
      await this.#database.upsertRoutes((Array.isArray(routePage?.items)?routePage.items:[]).map(item=>routeRecord(networkId,item)));
      const activity=await this.#client.catalog({module:'activity',params:{limit:this.#pageSize,offset:0}});
      await this.#database.upsertEvents((Array.isArray(activity?.items)?activity.items:[]).map(item=>eventRecord(networkId,item)));
      const [stats,status]=await Promise.all([this.#client.catalog({module:'stats',params:{}}),this.#client.catalog({module:'status',params:{}})]),timestamp=Date.now();
      await this.#database.insertMetric({networkId,timestamp,payload:{stats,status}});
      await this.#database.setCheckpoint({networkId,name:'recent-projection',value:{timestamp,pageSize:this.#pageSize}});
      await this.#database.prune({now:timestamp,eventRetentionMs:DEFAULT_EVENT_RETENTION_MS,metricRetentionMs:DEFAULT_METRIC_RETENTION_MS});
      this.#lastSyncAt=timestamp;return true;
    }catch(error){this.#lastError=error instanceof Error?error.message:String(error);throw error;}finally{this.#running=false;}
  }
  async backfill({maxRecords=10000}={}){
    if(!Number.isInteger(maxRecords)||maxRecords<1||maxRecords>1000000)throw new TypeError('INVALID_BACKFILL_LIMIT');
    const health=await this.#client.health();if(!NETWORK.test(health.networkId))throw new Error('INVALID_NETWORK_ID');let remaining=maxRecords,written=0;
    for(const module of [...ENTITY_MODULES,'routes','activity']){
      for(let offset=0;remaining>0;offset+=this.#pageSize){
        const limit=Math.min(this.#pageSize,remaining),page=await this.#client.catalog({module,params:{limit,offset}}),items=Array.isArray(page?.items)?page.items:[];
        if(module==='routes')await this.#database.upsertRoutes(items.map(item=>routeRecord(health.networkId,item)));
        else if(module==='activity')await this.#database.upsertEvents(items.map(item=>eventRecord(health.networkId,item)));
        else await this.#database.upsertEntities(items.map(item=>entityRecord(health.networkId,module,item)));
        written+=items.length;remaining-=items.length;if(items.length<limit)break;
      }
      if(!remaining)break;
    }
    await this.#database.setCheckpoint({networkId:health.networkId,name:'bounded-backfill',value:{timestamp:Date.now(),written,maxRecords}});return written;
  }
  async start({immediate=true}={}){
    if(!this.#stopped)return;this.#stopped=false;await this.initialize();
    const cycle=async()=>{if(this.#stopped)return;try{await this.syncOnce();}catch{}finally{if(!this.#stopped)this.#timer=setTimeout(cycle,this.#intervalMs);}};
    if(immediate)await cycle();else this.#timer=setTimeout(cycle,this.#intervalMs);
  }
  stop(){this.#stopped=true;if(this.#timer)clearTimeout(this.#timer);this.#timer=undefined;}
}

async function mongoDatabase(options={}){
  const names=observerDatabaseNames(options.prefix),owned=!options.client;
  let client=options.client;if(!client){if(typeof options.url!=='string')throw new TypeError('MONGODB_URL_REQUIRED');const {MongoClient}=await import('mongodb');client=new MongoClient(options.url,{maxPoolSize:options.maxPoolSize??8,minPoolSize:0,maxIdleTimeMS:30000});await client.connect();}
  const db=options.db??client.db(options.database??'myria_observer'),collection=key=>db.collection(names[key]);
  return {dialect:'mongodb',names,async initialize(){
    await Promise.all([
      collection('entities').createIndex({networkId:1,kind:1,entityId:1},{unique:true}),collection('entities').createIndex({networkId:1,lastObservedAt:-1}),
      collection('routes').createIndex({networkId:1,routeId:1},{unique:true}),collection('routes').createIndex({networkId:1,lastObservedAt:-1}),
      collection('events').createIndex({networkId:1,eventId:1},{unique:true}),collection('events').createIndex({expiresAt:1},{expireAfterSeconds:0}),
      collection('metrics').createIndex({networkId:1,timestamp:1},{unique:true}),collection('metrics').createIndex({expiresAt:1},{expireAfterSeconds:0}),
      collection('checkpoints').createIndex({networkId:1,name:1},{unique:true}),
    ]);
  },async upsertEntities(records){for(const batch of chunks(records))if(batch.length)await collection('entities').bulkWrite(batch.map(record=>({updateOne:{filter:{networkId:record.networkId,kind:record.kind,entityId:record.entityId},update:{$set:record},upsert:true}})),{ordered:false});},
  async upsertRoutes(records){for(const batch of chunks(records))if(batch.length)await collection('routes').bulkWrite(batch.map(record=>({updateOne:{filter:{networkId:record.networkId,routeId:record.routeId},update:{$set:record},upsert:true}})),{ordered:false});},
  async upsertEvents(records){for(const batch of chunks(records))if(batch.length)await collection('events').bulkWrite(batch.map(record=>({updateOne:{filter:{networkId:record.networkId,eventId:record.eventId},update:{$set:{...record,expiresAt:new Date(record.timestamp+DEFAULT_EVENT_RETENTION_MS)}},upsert:true}})),{ordered:false});},
  async insertMetric(record){await collection('metrics').updateOne({networkId:record.networkId,timestamp:record.timestamp},{$set:{...record,expiresAt:new Date(record.timestamp+DEFAULT_METRIC_RETENTION_MS)}},{upsert:true});},
  async setCheckpoint(record){await collection('checkpoints').updateOne({networkId:record.networkId,name:record.name},{$set:{...record,updatedAt:new Date()}},{upsert:true});},
  async prune(){/* MongoDB TTL indexes perform bounded retention asynchronously. */},async close(){if(owned)await client.close();}};
}

export async function createMongoObserverDatabase(options){return mongoDatabase(options);}

function table(name,dialect){return dialect==='postgres'?`"${name}"`:`\`${name}\``;}
function sqlRunner(client){const execute=typeof client.execute==='function'?client.execute.bind(client):client.query?.bind(client);if(!execute)throw new TypeError('SQL_CLIENT_REQUIRED');return execute;}
function postgresPlaceholders(rowCount,columns){let index=0;return Array.from({length:rowCount},()=>`(${Array.from({length:columns},()=>`$${++index}`).join(',')})`).join(',');}
function mysqlPlaceholders(rowCount,columns){return Array.from({length:rowCount},()=>`(${Array(columns).fill('?').join(',')})`).join(',');}

async function sqlDatabase(dialect,options={}){
  const names=observerDatabaseNames(options.prefix),owned=!options.client;let client=options.client;
  if(!client&&dialect==='postgres'){if(typeof options.connectionString!=='string')throw new TypeError('POSTGRES_URL_REQUIRED');const {Pool}=await import('pg');client=new Pool({connectionString:options.connectionString,max:options.maxPoolSize??8,idleTimeoutMillis:30000});}
  if(!client&&dialect!=='postgres'){if(typeof options.url!=='string')throw new TypeError('MYSQL_URL_REQUIRED');const mysql=await import('mysql2/promise');client=mysql.createPool(options.url);}
  const run=sqlRunner(client),q=key=>table(names[key],dialect),jsonType=dialect==='postgres'?'JSONB':'JSON',big=dialect==='postgres'?'BIGINT':'BIGINT UNSIGNED';
  const batch=async(key,columns,records,conflict,update)=>{for(const part of chunks(records)){if(!part.length)continue;const values=part.flatMap(record=>columns.map(column=>column==='payload'||column==='value'?compactJson(record[column]):record[column])),placeholders=dialect==='postgres'?postgresPlaceholders(part.length,columns.length):mysqlPlaceholders(part.length,columns.length),quoted=columns.map(column=>dialect==='postgres'?`"${column}"`:`\`${column}\``).join(','),sql=dialect==='postgres'?`INSERT INTO ${q(key)} (${quoted}) VALUES ${placeholders} ON CONFLICT (${conflict.map(column=>`"${column}"`).join(',')}) DO UPDATE SET ${update.map(column=>`"${column}"=EXCLUDED."${column}"`).join(',')}`:`INSERT INTO ${q(key)} (${quoted}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE ${update.map(column=>`\`${column}\`=VALUES(\`${column}\`)`).join(',')}`;await run(sql,values);}};
  return {dialect,names,async initialize(){
    const statements=[
      `CREATE TABLE IF NOT EXISTS ${q('entities')} (${table('networkId',dialect)} CHAR(64) NOT NULL,${table('kind',dialect)} VARCHAR(32) NOT NULL,${table('entityId',dialect)} VARCHAR(128) NOT NULL,${table('status',dialect)} VARCHAR(64) NOT NULL,${table('firstObservedAt',dialect)} ${big} NOT NULL,${table('lastObservedAt',dialect)} ${big} NOT NULL,${table('lastVerifiedAt',dialect)} ${big} NOT NULL,${table('payload',dialect)} ${jsonType} NOT NULL,PRIMARY KEY(${table('networkId',dialect)},${table('kind',dialect)},${table('entityId',dialect)}))`,
      `CREATE TABLE IF NOT EXISTS ${q('routes')} (${table('networkId',dialect)} CHAR(64) NOT NULL,${table('routeId',dialect)} VARCHAR(128) NOT NULL,${table('targetType',dialect)} VARCHAR(32) NOT NULL,${table('targetId',dialect)} VARCHAR(128) NOT NULL,${table('carrierClass',dialect)} VARCHAR(64) NOT NULL,${table('verificationStatus',dialect)} VARCHAR(64) NOT NULL,${table('firstObservedAt',dialect)} ${big} NOT NULL,${table('lastObservedAt',dialect)} ${big} NOT NULL,${table('lastVerifiedAt',dialect)} ${big} NOT NULL,${table('payload',dialect)} ${jsonType} NOT NULL,PRIMARY KEY(${table('networkId',dialect)},${table('routeId',dialect)}))`,
      `CREATE TABLE IF NOT EXISTS ${q('events')} (${table('networkId',dialect)} CHAR(64) NOT NULL,${table('eventId',dialect)} VARCHAR(128) NOT NULL,${table('timestamp',dialect)} ${big} NOT NULL,${table('eventType',dialect)} VARCHAR(128) NOT NULL,${table('targetType',dialect)} VARCHAR(32) NOT NULL,${table('targetId',dialect)} VARCHAR(128) NOT NULL,${table('payload',dialect)} ${jsonType} NOT NULL,PRIMARY KEY(${table('networkId',dialect)},${table('eventId',dialect)}))`,
      `CREATE TABLE IF NOT EXISTS ${q('metrics')} (${table('networkId',dialect)} CHAR(64) NOT NULL,${table('timestamp',dialect)} ${big} NOT NULL,${table('payload',dialect)} ${jsonType} NOT NULL,PRIMARY KEY(${table('networkId',dialect)},${table('timestamp',dialect)}))`,
      `CREATE TABLE IF NOT EXISTS ${q('checkpoints')} (${table('networkId',dialect)} CHAR(64) NOT NULL,${table('name',dialect)} VARCHAR(128) NOT NULL,${table('value',dialect)} ${jsonType} NOT NULL,${table('updatedAt',dialect)} ${big} NOT NULL,PRIMARY KEY(${table('networkId',dialect)},${table('name',dialect)}))`,
    ];for(const statement of statements)await run(statement,[]);
    const indexes=[['entities','lastObservedAt'],['routes','lastObservedAt'],['events','timestamp'],['metrics','timestamp']];
    for(const [key,column] of indexes){const index=names[key]+'_'+column.toLowerCase();const statement=dialect==='postgres'?`CREATE INDEX IF NOT EXISTS "${index}" ON ${q(key)} (${table('networkId',dialect)},${table(column,dialect)} DESC)`:`CREATE INDEX ${table(index,dialect)} ON ${q(key)} (${table('networkId',dialect)},${table(column,dialect)} DESC)`;try{await run(statement,[]);}catch(error){if(dialect==='postgres'||!['ER_DUP_KEYNAME','ER_DUP_INDEX'].includes(error?.code))throw error;}}
  },
  upsertEntities(records){return batch('entities',['networkId','kind','entityId','status','firstObservedAt','lastObservedAt','lastVerifiedAt','payload'],records,['networkId','kind','entityId'],['status','firstObservedAt','lastObservedAt','lastVerifiedAt','payload']);},
  upsertRoutes(records){return batch('routes',['networkId','routeId','targetType','targetId','carrierClass','verificationStatus','firstObservedAt','lastObservedAt','lastVerifiedAt','payload'],records,['networkId','routeId'],['targetType','targetId','carrierClass','verificationStatus','firstObservedAt','lastObservedAt','lastVerifiedAt','payload']);},
  upsertEvents(records){return batch('events',['networkId','eventId','timestamp','eventType','targetType','targetId','payload'],records,['networkId','eventId'],['timestamp','eventType','targetType','targetId','payload']);},
  insertMetric(record){return batch('metrics',['networkId','timestamp','payload'],[record],['networkId','timestamp'],['payload']);},
  setCheckpoint(record){return batch('checkpoints',['networkId','name','value','updatedAt'],[{...record,updatedAt:Date.now()}],['networkId','name'],['value','updatedAt']);},
  async prune({now,eventRetentionMs=DEFAULT_EVENT_RETENTION_MS,metricRetentionMs=DEFAULT_METRIC_RETENTION_MS}){const marker=dialect==='postgres'?'$1':'?';await run(`DELETE FROM ${q('events')} WHERE timestamp < ${marker}`,[now-eventRetentionMs]);await run(`DELETE FROM ${q('metrics')} WHERE timestamp < ${marker}`,[now-metricRetentionMs]);},
  async close(){if(owned)await client.end();}};
}

export function createPostgresObserverDatabase(options){return sqlDatabase('postgres',options);}
export function createMysqlObserverDatabase(options){return sqlDatabase('mysql',options);}
export function createMariaDbObserverDatabase(options){return sqlDatabase('mariadb',options);}
