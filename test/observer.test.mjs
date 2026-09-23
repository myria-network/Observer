import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createMyriaObserverClient,createCommunityObserver,OBSERVER_MODULES,MyriaObserverError,
  OBSERVER_DATABASE_BLUEPRINT,ObserverProjectionWorker,observerDatabaseNames,
  createMongoObserverDatabase,createPostgresObserverDatabase,createMysqlObserverDatabase,createMariaDbObserverDatabase,
  classifyObservedRecord,isObservedToken,isObservedTransfer,isObservedSwap,observedAssetId,observedObjectType,
} from '../src/index.js';

const objectId='ab'.repeat(32),wallet='myr_w_'+'a'.repeat(52);
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});

test('semantic helpers classify tokens, transfers and swaps consistently',()=>{
  const tokenId='cd'.repeat(32);
  assert.equal(classifyObservedRecord({data:{objectType:'TX',operation:'TRANSFER',transaction:{assetId:objectId}},__observer:{networkId:objectId}}).kind,'TRANSFER');
  assert.equal(classifyObservedRecord({data:{objectType:'TX',operation:'TRANSFER',transaction:{assetId:tokenId}},__observer:{networkId:objectId}}).kind,'TOKEN_TRANSFER');
  assert.equal(isObservedToken({data:{objectType:'TOKEN_DEFINITION',assetId:tokenId}}),true);
  assert.equal(isObservedTransfer({data:{objectType:'TX',operation:'TRANSFER'}}),true);
  assert.equal(isObservedSwap({data:{objectType:'TX',operation:'AMM_SWAP'}}),true);
  assert.equal(observedAssetId({data:{transaction:{assetId:tokenId}}}),tokenId);
  assert.equal(observedObjectType({data:{objectType:'TOKEN_DEFINITION'}}),'TOKEN_DEFINITION');
});

test('public Observer pins portable crypto and the supported dApp SDK line',async()=>{
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.dependencies['@noble/hashes'],'2.0.1');
  assert.equal(pkg.dependencies['@myria-network/dapp'],'^0.3.0');
  for(const file of ['index.js','token-avatar.js','wallet-avatar.js']){
    const source=await readFile(new URL(`../src/${file}`,import.meta.url),'utf8');
    assert.doesNotMatch(source,/node:crypto|crypto\.subtle|\/webcrypto\.js|\bKeyObject\b/);
  }
});

test('client exposes every Observer catalog through one bounded POST endpoint',async()=>{
  const calls=[];
  const client=createMyriaObserverClient({url:'https://observer.example',fetch:async(url,init)=>{
    const pathname=new URL(url).pathname;
    if(pathname==='/healthz')return json({status:'ok',networkId:objectId,workers:{}});
    if(pathname==='/observer/discovery-capsule')return json({capsule:'myria:test'});
    assert.equal(pathname,'/observer/catalog');assert.equal(init.method,'POST');
    const body=JSON.parse(init.body);calls.push(body);return json({module:body.module,id:body.id,params:body.params,items:[]});
  }});
  assert.equal((await client.health()).networkId,objectId);
  assert.equal((await client.discoveryCapsule({type:'COLLECTION',id:objectId})).capsule,'myria:test');
  assert.equal(client.socialMediaImageUrl('2098410697826676833'),'https://observer.example/observer/social-media/media/2098410697826676833');

  const reads=[
    client.overview(),client.stats(),client.status(),client.assets(),client.carriers(),client.activity(),client.research(),client.liveSpores(),client.timeline(),
    client.spores(),client.spore(objectId),client.transfers(),client.transactionGallery(),client.walletGallery(),client.socialMedia(),client.contracts(),client.contract(objectId),
    client.objects(),client.object(objectId),client.collections(),client.collection(objectId),client.catalogs(),client.catalogDetail(objectId),client.propagations(),client.propagation(objectId),
    client.discoveries(),client.discovery(objectId),client.routes(objectId),client.scarce(),client.keepers(),client.keeper('myr_k_'+'a'.repeat(52)),client.scouts(),client.scout('myr_s_'+'a'.repeat(52)),client.graph(),client.wallet(wallet),
  ];
  await Promise.all(reads);
  assert.deepEqual(new Set(calls.map(call=>call.module)),new Set(OBSERVER_MODULES));
  assert.ok(calls.every(call=>Object.keys(call).every(key=>['module','id','params','live'].includes(key))));
  assert.throws(()=>client.catalog({module:'admin',params:{}}),error=>error instanceof MyriaObserverError&&error.code==='INVALID_CATALOG_REQUEST');
  assert.throws(()=>client.catalog({module:'spores',params:{secret:'x'}}),error=>error.code==='INVALID_CATALOG_PARAM');
  assert.throws(()=>client.socialMediaImageUrl('../secret'),error=>error.code==='INVALID_POST_ID');
  const hostile=createMyriaObserverClient({url:'https://observer.example',fetch:async()=>new Response('{"__proto__":{"polluted":true}}',{headers:{'Content-Type':'application/json'}})});
  await assert.rejects(()=>hostile.health(),error=>error.code==='INVALID_OBSERVER_RESPONSE');
  assert.equal({}.polluted,undefined);
});

class SocketFixture{
  connected=true;handlers=new Map();sent=[];disconnected=false;
  on(name,listener){this.handlers.set(name,listener);return this;}
  emit(name,payload){this.sent.push({name,payload});return this;}
  receive(name,payload){this.handlers.get(name)?.(payload);}
  disconnect(){this.connected=false;this.disconnected=true;}
}

test('live client applies ordered patches and rejects prototype paths',()=>{
  const socket=new SocketFixture(),updates=[],errors=[];
  const client=createMyriaObserverClient({url:'https://observer.example',fetch:async()=>json({}),socketFactory:()=>socket});
  const subscription=client.subscribe({module:'overview',params:{range:60}},(value,event)=>updates.push({value,event}),{onError:error=>errors.push(error)});
  socket.receive('catalog.snapshot',{key:subscription.key,revision:0,value:{stats:{observed:1}}});
  socket.receive('catalog.patch',{key:subscription.key,base:0,revision:1,patches:[{path:['stats','observed'],value:2}]});
  assert.equal(updates.at(-1).value.stats.observed,2);assert.equal(updates.at(-1).event.kind,'patch');
  socket.receive('catalog.patch',{key:subscription.key,base:1,revision:2,patches:[{path:['__proto__','polluted'],value:true}]});
  assert.equal({}.polluted,undefined);assert.equal(errors.at(-1).code,'INVALID_CATALOG_PATCH');
  socket.receive('catalog.snapshot',{key:subscription.key,revision:2,value:JSON.parse('{"constructor":{"prototype":{"polluted":true}}}')});
  assert.equal({}.polluted,undefined);assert.equal(errors.at(-1).code,'INVALID_CATALOG_PATCH');
  subscription.close();assert.equal(socket.disconnected,true);
});

test('community runtime delegates to an explicitly supplied verified engine',async()=>{
  const calls=[];
  const expected={networkId:objectId,url:'http://127.0.0.1:4318',status:()=>({role:'OBSERVER'}),catalog:()=>({}),submit:()=>true,close:async()=>{}};
  const engine={createCommunityObserver:async options=>{calls.push(options);return expected;}};
  const observer=await createCommunityObserver({home:'./observer-data',port:4318,engine,config:{verify:true}});
  assert.equal(observer,expected);
  assert.deepEqual(calls,[{home:'./observer-data',port:4318,config:{verify:true}}]);
  await assert.rejects(()=>createCommunityObserver({home:'./observer-data'}),error=>error instanceof MyriaObserverError&&error.code==='OBSERVER_ENGINE_REQUIRED');
});

test('projection worker persists bounded pages produced by its own Observer',async()=>{
  const calls=[],written={entities:[],routes:[],events:[],metrics:[],checkpoints:[],prunes:[]};
  const client={
    health:async()=>({networkId:objectId}),
    catalog:async request=>{calls.push(request);if(request.module==='routes')return {items:[{routeId:'route-1',targetType:'SPORE',targetId:objectId,carrierClass:'HTTP',verificationStatus:'VERIFIED_ACTIVE',firstObservedAt:1,lastObservedAt:2,lastVerifiedAt:2}]};if(request.module==='activity')return {items:[{id:1,timestamp:2,eventType:'spore.verified',targetType:'SPORE',targetId:objectId}]};if(['stats','status'].includes(request.module))return {module:request.module,observedSpores:1};return {items:[{id:objectId,status:'VERIFIED',firstObservedAt:1,lastObservedAt:2,lastVerifiedAt:2}]};},
  };
  const database={dialect:'memory',names:observerDatabaseNames(),initialize:async()=>{},upsertEntities:async rows=>written.entities.push(...rows),upsertRoutes:async rows=>written.routes.push(...rows),upsertEvents:async rows=>written.events.push(...rows),insertMetric:async row=>written.metrics.push(row),setCheckpoint:async row=>written.checkpoints.push(row),prune:async row=>written.prunes.push(row),close:async()=>{}};
  const worker=new ObserverProjectionWorker({client,database,pageSize:25,intervalMs:5000});await worker.initialize();assert.equal(await worker.syncOnce(),true);
  assert.equal(written.entities.length,7);assert.equal(written.routes.length,1);assert.equal(written.events.length,1);assert.equal(written.metrics.length,1);assert.equal(written.checkpoints.length,1);assert.equal(written.prunes.length,1);
  assert.ok(calls.every(call=>!('offset' in call)||call.params.offset===0));assert.equal(worker.status().lastError,undefined);
  assert.deepEqual(Object.keys(OBSERVER_DATABASE_BLUEPRINT),['entities','routes','events','metrics','checkpoints']);
  assert.throws(()=>observerDatabaseNames('bad-prefix'),/INVALID_DATABASE_PREFIX/);
});

test('database connectors create indexed schemas and parameterized upserts',async()=>{
  const collections=new Map(),db={collection(name){if(!collections.has(name))collections.set(name,{indexes:[],writes:[],updates:[],async createIndex(key,options){this.indexes.push({key,options});},async bulkWrite(value){this.writes.push(value);},async updateOne(...value){this.updates.push(value);}});return collections.get(name);}};
  const mongo=await createMongoObserverDatabase({client:{db:()=>db,close:async()=>{}},db,prefix:'community'});await mongo.initialize();await mongo.upsertEntities([{networkId:objectId,kind:'spores',entityId:objectId,status:'VERIFIED',firstObservedAt:1,lastObservedAt:2,lastVerifiedAt:2,payload:{safe:true}}]);
  assert.equal(collections.get('community_entities').writes.length,1);assert.ok(collections.get('community_events').indexes.some(index=>index.options.expireAfterSeconds===0));

  const pgCalls=[],pg={query:async(sql,values)=>{pgCalls.push({sql,values});},end:async()=>{}};
  const postgres=await createPostgresObserverDatabase({client:pg,prefix:'community'});await postgres.initialize();await postgres.upsertEntities([{networkId:objectId,kind:'spores',entityId:objectId,status:'VERIFIED',firstObservedAt:1,lastObservedAt:2,lastVerifiedAt:2,payload:{text:"x'); DROP TABLE observer; --"}}]);
  const insert=pgCalls.find(call=>call.sql.startsWith('INSERT INTO'));assert.ok(insert.sql.includes('$1'));assert.equal(insert.sql.includes('DROP TABLE'),false);assert.ok(insert.values.some(value=>String(value).includes('DROP TABLE')));

  for(const factory of [createMysqlObserverDatabase,createMariaDbObserverDatabase]){const calls=[],sql={execute:async(statement,values)=>{calls.push({statement,values});},end:async()=>{}};const adapter=await factory({client:sql,prefix:'community'});await adapter.initialize();await adapter.insertMetric({networkId:objectId,timestamp:1,payload:{observed:1}});assert.ok(calls.some(call=>call.statement.includes('ON DUPLICATE KEY UPDATE')));}
});

test('public API documentation covers every exported client and persistence method',async()=>{
  const api=await readFile(new URL('../API.md',import.meta.url),'utf8');
  const readme=await readFile(new URL('../README.md',import.meta.url),'utf8');
  const model=await readFile(new URL('../DATA_MODEL.md',import.meta.url),'utf8');
  const clientMethods=[
    'health','catalog','discoveryCapsule','socialMediaImageUrl','overview','stats','status','assets','carriers','activity','research','liveSpores','timeline',
    'spores','spore','transfers','transactionGallery','walletGallery','socialMedia','contracts','contract','objects','object','collections','collection','catalogs','catalogDetail',
    'propagations','propagation','discoveries','discovery','routes','scarce','keepers','keeper','scouts','scout','graph','wallet','subscribe','close',
  ];
  const packageExports=[
    'createCommunityObserver','createMyriaObserverClient','MyriaObserverClient','MyriaObserverError','OBSERVER_MODULES','OBSERVER_CATALOG',
    'ObserverProjectionWorker','OBSERVER_DATABASE_BLUEPRINT','observerDatabaseNames','createMongoObserverDatabase','createPostgresObserverDatabase','createMysqlObserverDatabase','createMariaDbObserverDatabase',
  ];
  const databaseMethods=['initialize','upsertEntities','upsertRoutes','upsertEvents','insertMetric','setCheckpoint','prune','close'];
  for(const name of [...clientMethods,...packageExports,...databaseMethods])assert.match(api,new RegExp('`'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\(|`)'),`API.md must document ${name}`);
  for(const topic of ['Fee-market data','Wallets, native balance, and custom tokens','Contracts, source, executions, and rewards','Collections, catalogs, and portable discovery'])assert.ok(api.includes(topic),`API.md must document ${topic}`);
  for(const topic of ['Catalog envelope','Paginated result','Fee market','Wallet','Contracts','Routes and carriers','Method-to-result map'])assert.ok(model.includes(topic),`DATA_MODEL.md must document ${topic}`);
  for(const text of [api,readme,model])assert.doesNotMatch(text,/SvelteKit|Amazon Web Services|\bAWS\b|\bEC2\b|CloudFront/i);
  assert.doesNotMatch(readme,/PUBLISHING\.md|Publishing under/);
});
