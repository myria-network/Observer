import {io as createSocket} from 'socket.io-client';
export {classifyObservedRecord,observedObjectType,observedAssetId,isObservedToken,isObservedTransfer,isObservedSwap} from './record.js';

const ID=/^[a-zA-Z0-9_-]{1,128}$/;
const POST_ID=/^[0-9]{1,19}$/;
const MODULES=['overview','stats','status','assets','carriers','activity','research','live-spores','timeline','spores','transfers','transaction-gallery','wallet-gallery','social-media','contracts','objects','collections','catalogs','propagations','discoveries','routes','health/scarce','propagators','scouts','graph','wallet'];
const PARAMS=new Set(['limit','offset','q','status','target','range','root','depth','nodes','type','health','address']);
const FORBIDDEN_KEYS=new Set(['__proto__','prototype','constructor']);
const MAX_RESPONSE_CHARS=4*1024*1024;

export const OBSERVER_MODULES=Object.freeze([...MODULES]);
export const OBSERVER_CATALOG=Object.freeze(Object.fromEntries(MODULES.map(module=>[module,Object.freeze({module,transport:'catalog',live:['overview','stats','status','carriers','activity','live-spores','timeline','transfers','transaction-gallery','wallet-gallery','social-media','contracts'].includes(module)})])));

export class MyriaObserverError extends Error{
  constructor(code,message=code,{status,cause}={}){super(message,{cause});this.name='MyriaObserverError';this.code=code;this.status=status;}
}

function baseUrl(value){
  let url;try{url=new URL(value);}catch(error){throw new MyriaObserverError('INVALID_OBSERVER_URL','Observer URL is invalid.',{cause:error});}
  if(url.username||url.password||url.search||url.hash)throw new MyriaObserverError('INVALID_OBSERVER_URL');
  const loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))throw new MyriaObserverError('HTTPS_REQUIRED');
  url.pathname=url.pathname.replace(/\/+$/,'');return url;
}
function catalogRequest(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||!MODULES.includes(input.module))throw new MyriaObserverError('INVALID_CATALOG_REQUEST');
  if(input.id!==undefined&&(typeof input.id!=='string'||!ID.test(input.id)))throw new MyriaObserverError('INVALID_CATALOG_ID');
  const params=input.params??{};if(!params||typeof params!=='object'||Array.isArray(params))throw new MyriaObserverError('INVALID_CATALOG_PARAMS');
  const normalized={};
  for(const [key,value] of Object.entries(params)){
    if(!PARAMS.has(key))throw new MyriaObserverError('INVALID_CATALOG_PARAM');
    if(typeof value==='string'){if(value.length>128)throw new MyriaObserverError('INVALID_CATALOG_PARAM');normalized[key]=value;}
    else if(Number.isInteger(value)&&value>=0&&value<=1000000)normalized[key]=value;
    else throw new MyriaObserverError('INVALID_CATALOG_PARAM');
  }
  if(input.live!==undefined&&typeof input.live!=='boolean')throw new MyriaObserverError('INVALID_CATALOG_REQUEST');
  return {module:input.module,...(input.id?{id:input.id}:{}),params:normalized,live:input.live??false};
}
function mergeSignal(signal,timeoutMs){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort('timeout'),timeoutMs);
  const abort=()=>controller.abort(signal?.reason);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  return {signal:controller.signal,close(){clearTimeout(timer);signal?.removeEventListener('abort',abort);}};
}
function safePath(path){return Array.isArray(path)&&path.length<=32&&path.every(part=>Number.isInteger(part)&&part>=0&&part<=100000||typeof part==='string'&&part.length<=128&&!FORBIDDEN_KEYS.has(part));}
function clone(value,code='INVALID_OBSERVER_RESPONSE',depth=0,budget={nodes:0}){
  if(depth>64||++budget.nodes>200000)throw new MyriaObserverError(code);
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number')return value;
  if(value===undefined)return undefined;
  if(Array.isArray(value)){if(value.length>100000)throw new MyriaObserverError(code);return value.map(item=>clone(item,code,depth+1,budget));}
  if(typeof value!=='object')throw new MyriaObserverError(code);
  const result=Object.create(null),entries=Object.entries(value);if(entries.length>100000)throw new MyriaObserverError(code);
  for(const [key,item] of entries){if(FORBIDDEN_KEYS.has(key))throw new MyriaObserverError(code);result[key]=clone(item,code,depth+1,budget);}
  return result;
}
function applyPatches(current,patches){
  if(!Array.isArray(patches)||patches.length>5000)throw new MyriaObserverError('INVALID_CATALOG_PATCH');
  const result=clone(current,'INVALID_CATALOG_PATCH');
  for(const patch of patches){
    if(!patch||typeof patch!=='object'||!safePath(patch.path))throw new MyriaObserverError('INVALID_CATALOG_PATCH');
    if(patch.path.length===0){if(patch.remove)throw new MyriaObserverError('INVALID_CATALOG_PATCH');return clone(patch.value,'INVALID_CATALOG_PATCH');}
    let target=result;
    for(const part of patch.path.slice(0,-1)){
      if(!target||typeof target!=='object'||!(part in target))throw new MyriaObserverError('INVALID_CATALOG_PATCH');
      target=target[part];
    }
    const key=patch.path.at(-1);
    if(key==='length'){
      if(!Array.isArray(target)||patch.remove||!Number.isInteger(patch.value)||patch.value<0||patch.value>100000)throw new MyriaObserverError('INVALID_CATALOG_PATCH');
      target.length=patch.value;continue;
    }
    if(!target||typeof target!=='object')throw new MyriaObserverError('INVALID_CATALOG_PATCH');
    if(patch.remove)delete target[key];else target[key]=clone(patch.value,'INVALID_CATALOG_PATCH');
  }
  return result;
}

export class MyriaObserverClient{
  #base;#fetch;#timeout;#socketFactory;#socket;#sequence=0;#subscriptions=new Map();
  constructor(options={}){
    this.#base=baseUrl(options.url??'http://127.0.0.1:4318');
    this.#fetch=options.fetch??globalThis.fetch;
    if(typeof this.#fetch!=='function')throw new MyriaObserverError('FETCH_UNAVAILABLE');
    this.#timeout=options.timeoutMs??10000;if(!Number.isInteger(this.#timeout)||this.#timeout<1000||this.#timeout>120000)throw new MyriaObserverError('INVALID_TIMEOUT');
    this.#socketFactory=options.socketFactory??createSocket;
  }
  get url(){return this.#base.href.replace(/\/$/,'');}
  async #json(path,init={},signal){
    const operation=mergeSignal(signal,this.#timeout);
    try{
      const response=await this.#fetch(new URL(path,this.#base),{...init,signal:operation.signal});
      const length=Number(response.headers.get('content-length')??0);if(length>MAX_RESPONSE_CHARS)throw new MyriaObserverError('OBSERVER_RESPONSE_TOO_LARGE');
      const type=(response.headers.get('content-type')??'').toLowerCase();
      const text=await response.text();if(text.length>MAX_RESPONSE_CHARS)throw new MyriaObserverError('OBSERVER_RESPONSE_TOO_LARGE');
      let body;try{body=text?JSON.parse(text):null;}catch(error){throw new MyriaObserverError('INVALID_OBSERVER_RESPONSE','Observer returned invalid JSON.',{status:response.status,cause:error});}
      if(!response.ok)throw new MyriaObserverError(body?.error??'OBSERVER_REQUEST_FAILED',`Observer request failed with HTTP ${response.status}.`,{status:response.status});
      if(!type.startsWith('application/json'))throw new MyriaObserverError('INVALID_OBSERVER_RESPONSE');return clone(body);
    }catch(error){if(error instanceof MyriaObserverError)throw error;if(operation.signal.aborted)throw new MyriaObserverError(signal?.aborted?'CANCELLED':'OBSERVER_TIMEOUT',undefined,{cause:error});throw new MyriaObserverError('OBSERVER_UNAVAILABLE',undefined,{cause:error});}
    finally{operation.close();}
  }
  health(options={}){return this.#json('/healthz',{},options.signal);}
  catalog(request,options={}){const body=catalogRequest(request);return this.#json('/observer/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},options.signal);}
  discoveryCapsule({type,id,signal}={}){
    if(!['CATALOG','COLLECTION'].includes(type)||typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw new MyriaObserverError('INVALID_DISCOVERY_CAPSULE');
    return this.#json('/observer/discovery-capsule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,id})},signal);
  }
  socialMediaImageUrl(postId){if(typeof postId!=='string'||!POST_ID.test(postId))throw new MyriaObserverError('INVALID_POST_ID');return new URL(`/observer/social-media/media/${postId}`,this.#base).href;}
  overview(params={range:60},options){return this.catalog({module:'overview',params},options);}
  stats(options){return this.catalog({module:'stats',params:{}},options);}
  status(options){return this.catalog({module:'status',params:{}},options);}
  assets(options){return this.catalog({module:'assets',params:{}},options);}
  carriers(options){return this.catalog({module:'carriers',params:{}},options);}
  activity(params={},options){return this.catalog({module:'activity',params},options);}
  research(options){return this.catalog({module:'research',params:{}},options);}
  liveSpores(params={},options){return this.catalog({module:'live-spores',params},options);}
  timeline(params={},options){return this.catalog({module:'timeline',params},options);}
  spores(params={},options){return this.catalog({module:'spores',params},options);}
  spore(id,params={},options){return this.catalog({module:'spores',id,params},options);}
  transfers(params={},options){return this.catalog({module:'transfers',params},options);}
  transactionGallery(params={},options){return this.catalog({module:'transaction-gallery',params},options);}
  walletGallery(params={},options){return this.catalog({module:'wallet-gallery',params},options);}
  socialMedia(params={},options){return this.catalog({module:'social-media',params},options);}
  contracts(params={},options){return this.catalog({module:'contracts',params},options);}
  contract(id,params={},options){return this.catalog({module:'contracts',id,params},options);}
  objects(params={},options){return this.catalog({module:'objects',params},options);}
  object(id,params={},options){return this.catalog({module:'objects',id,params},options);}
  collections(params={},options){return this.catalog({module:'collections',params},options);}
  collection(id,params={},options){return this.catalog({module:'collections',id,params},options);}
  catalogs(params={},options){return this.catalog({module:'catalogs',params},options);}
  catalogDetail(id,params={},options){return this.catalog({module:'catalogs',id,params},options);}
  propagations(params={},options){return this.catalog({module:'propagations',params},options);}
  propagation(id,params={},options){return this.catalog({module:'propagations',id,params},options);}
  discoveries(params={},options){return this.catalog({module:'discoveries',params},options);}
  discovery(id,params={},options){return this.catalog({module:'discoveries',id,params},options);}
  routes(target,params={},options){return this.catalog({module:'routes',params:{...params,target}},options);}
  scarce(params={},options){return this.catalog({module:'health/scarce',params},options);}
  keepers(params={},options){return this.catalog({module:'propagators',params},options);}
  keeper(id,params={},options){return this.catalog({module:'propagators',id,params},options);}
  scouts(params={},options){return this.catalog({module:'scouts',params},options);}
  scout(id,params={},options){return this.catalog({module:'scouts',id,params},options);}
  graph(params={},options){return this.catalog({module:'graph',params},options);}
  wallet(address,params={},options){return this.catalog({module:'wallet',params:{...params,address}},options);}
  #liveSocket(){
    if(this.#socket)return this.#socket;
    const socket=this.#socketFactory(this.url,{transports:['websocket'],reconnectionDelay:1000,reconnectionDelayMax:10000});this.#socket=socket;
    socket.on('connect',()=>{for(const entry of this.#subscriptions.values())socket.emit('catalog.subscribe',{key:entry.key,request:entry.request});});
    socket.on('catalog.snapshot',packet=>{const entry=this.#subscriptions.get(packet?.key);if(!entry||!Number.isInteger(packet.revision)||packet.revision<0||!Object.hasOwn(packet,'value'))return;try{entry.value=clone(packet.value,'INVALID_CATALOG_PATCH');entry.revision=packet.revision;entry.listener(entry.value,{kind:'snapshot',revision:entry.revision});}catch(error){entry.error?.(error);socket.emit('catalog.subscribe',{key:entry.key,request:entry.request});}});
    socket.on('catalog.patch',packet=>{const entry=this.#subscriptions.get(packet?.key);if(!entry)return;if(packet.base!==entry.revision||packet.revision!==packet.base+1){socket.emit('catalog.subscribe',{key:entry.key,request:entry.request});return;}try{entry.value=applyPatches(entry.value,packet.patches);entry.revision=packet.revision;entry.listener(entry.value,{kind:'patch',revision:entry.revision});}catch(error){entry.error?.(error);socket.emit('catalog.subscribe',{key:entry.key,request:entry.request});}});
    socket.on('catalog.error',packet=>{const entry=this.#subscriptions.get(packet?.key);entry?.error?.(new MyriaObserverError(packet?.error??'CATALOG_UNAVAILABLE'));});
    socket.on('connect_error',error=>{for(const entry of this.#subscriptions.values())entry.error?.(new MyriaObserverError('OBSERVER_UNAVAILABLE',undefined,{cause:error}));});
    return socket;
  }
  subscribe(request,listener,{onError}={}){
    if(typeof listener!=='function')throw new TypeError('listener must be a function');const normalized=catalogRequest({...request,live:true}),key='c'+(++this.#sequence);
    const entry={key,request:normalized,listener,error:onError,revision:-1,value:undefined};this.#subscriptions.set(key,entry);const socket=this.#liveSocket();if(socket.connected)socket.emit('catalog.subscribe',{key,request:normalized});
    let closed=false;return Object.freeze({key,close:()=>{if(closed)return;closed=true;this.#subscriptions.delete(key);if(socket.connected)socket.emit('catalog.unsubscribe',key);if(!this.#subscriptions.size){socket.disconnect();this.#socket=undefined;}}});
  }
  close(){for(const entry of this.#subscriptions.values())if(this.#socket?.connected)this.#socket.emit('catalog.unsubscribe',entry.key);this.#subscriptions.clear();this.#socket?.disconnect();this.#socket=undefined;}
}

export function createMyriaObserverClient(options){return new MyriaObserverClient(options);}

/** Starts a server-side, read-only Observer through a compatible engine adapter. */
export async function createCommunityObserver(options){
  if(!options||typeof options.home!=='string'||!options.home.trim())throw new MyriaObserverError('OBSERVER_HOME_REQUIRED');
  const {engine:providedEngine,...observerOptions}=options;
  const engine=providedEngine;
  if(!engine)throw new MyriaObserverError('OBSERVER_ENGINE_REQUIRED','Pass a compatible MYRIA protocol engine through options.engine.');
  if(typeof engine.createCommunityObserver!=='function')throw new MyriaObserverError('OBSERVER_ENGINE_UNAVAILABLE');
  return engine.createCommunityObserver(observerOptions);
}

export {
  OBSERVER_DATABASE_BLUEPRINT,
  ObserverProjectionWorker,
  createMongoObserverDatabase,
  createPostgresObserverDatabase,
  createMysqlObserverDatabase,
  createMariaDbObserverDatabase,
  observerDatabaseNames,
} from './storage.js';
