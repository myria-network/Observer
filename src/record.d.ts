export type ObservedRecordKind='GENESIS'|'BUNDLE'|'WALLET'|'TOKEN'|'TRANSFER'|'TOKEN_TRANSFER'|'SWAP'|'LIQUIDITY'|'TOKEN_CREATION'|'CONTRACT_DEPLOYMENT'|'CONTRACT_EXECUTION'|'CONTRACT_CODE'|'RUNTIME_AUTHORIZATION'|'RECORD'|'TRANSACTION'|'UNKNOWN';
export interface ObservedObjectClassification {objectType?:string;operation?:string;networkId?:string;assetId?:string;kind:ObservedRecordKind;isTransaction:boolean;isTransfer:boolean;isSwap:boolean;isToken:boolean;isNativeAsset:boolean}
export declare function classifyObservedRecord(record:unknown):ObservedObjectClassification;
export declare function observedObjectType(record:unknown):string|undefined;
export declare function observedAssetId(record:unknown):string|undefined;
export declare function isObservedToken(record:unknown):boolean;
export declare function isObservedTransfer(record:unknown):boolean;
export declare function isObservedSwap(record:unknown):boolean;
