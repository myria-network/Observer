import type {MyriaObserverClient} from './index.js';

export interface ObserverDatabaseNames {entities:string;routes:string;events:string;metrics:string;checkpoints:string}
export interface ObserverDatabaseRecord {networkId:string;[key:string]:unknown}
export interface ObserverDatabase {
  readonly dialect:string;readonly names:ObserverDatabaseNames;
  initialize():Promise<void>;upsertEntities(records:ObserverDatabaseRecord[]):Promise<void>;upsertRoutes(records:ObserverDatabaseRecord[]):Promise<void>;upsertEvents(records:ObserverDatabaseRecord[]):Promise<void>;
  insertMetric(record:ObserverDatabaseRecord):Promise<void>;setCheckpoint(record:ObserverDatabaseRecord):Promise<void>;prune(options:{now:number;eventRetentionMs?:number;metricRetentionMs?:number}):Promise<void>;close():Promise<void>;
}
export declare const OBSERVER_DATABASE_BLUEPRINT:Readonly<Record<keyof ObserverDatabaseNames,{readonly suffix:string;readonly primaryKey:readonly string[];readonly description:string;readonly retentionMs?:number}>>;
export declare function observerDatabaseNames(prefix?:string):ObserverDatabaseNames;
export interface ProjectionWorkerOptions {client:MyriaObserverClient;database:ObserverDatabase;pageSize?:number;intervalMs?:number}
export declare class ObserverProjectionWorker {
  constructor(options:ProjectionWorkerOptions);status():Readonly<{running:boolean;stopped:boolean;lastSyncAt:number;lastError?:string}>;initialize():Promise<this>;syncOnce():Promise<boolean>;backfill(options?:{maxRecords?:number}):Promise<number>;start(options?:{immediate?:boolean}):Promise<void>;stop():void;
}
export interface MongoObserverDatabaseOptions {url?:string;database?:string;prefix?:string;maxPoolSize?:number;client?:any;db?:any}
export interface PostgresObserverDatabaseOptions {connectionString?:string;prefix?:string;maxPoolSize?:number;client?:any}
export interface MysqlObserverDatabaseOptions {url?:string;prefix?:string;maxPoolSize?:number;client?:any}
export declare function createMongoObserverDatabase(options:MongoObserverDatabaseOptions):Promise<ObserverDatabase>;
export declare function createPostgresObserverDatabase(options:PostgresObserverDatabaseOptions):Promise<ObserverDatabase>;
export declare function createMysqlObserverDatabase(options:MysqlObserverDatabaseOptions):Promise<ObserverDatabase>;
export declare function createMariaDbObserverDatabase(options:MysqlObserverDatabaseOptions):Promise<ObserverDatabase>;
