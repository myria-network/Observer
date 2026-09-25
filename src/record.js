function descriptor(record){
  if(!record||typeof record!=='object'||Array.isArray(record))return {};
  const data=record.data&&typeof record.data==='object'&&!Array.isArray(record.data)?record.data:record;
  const transaction=data.transaction&&typeof data.transaction==='object'&&!Array.isArray(data.transaction)?data.transaction:{};
  const context=record.__observer&&typeof record.__observer==='object'?record.__observer:{};
  return {
    objectType:String(data.objectType??data.reportedObjectType??record.objectType??''),
    operation:String(data.operation??data.reportedOperation??record.operation??''),
    networkId:String(data.networkId??record.networkId??context.networkId??''),
    assetId:String(transaction.assetId??data.assetId??record.assetId??''),
  };
}

/** Classifies an Observer catalog record without trusting it as economic authority. */
export function classifyObservedRecord(record){
  const {objectType,operation,networkId,assetId}=descriptor(record);
  const isTransaction=objectType==='TX',isTransfer=isTransaction&&['TRANSFER','CONTRACT_FEE_WITHDRAWAL'].includes(operation),isSwap=isTransaction&&operation==='AMM_SWAP';
  const isNativeAsset=!!assetId&&!!networkId&&assetId===networkId;
  const isToken=objectType==='TOKEN_DEFINITION'||(isTransfer&&!!assetId&&!!networkId&&!isNativeAsset);
  let kind='UNKNOWN';
  if(objectType==='GENESIS')kind='GENESIS';
  else if(objectType==='BUNDLE')kind='BUNDLE';
  else if(objectType==='WALLET_CREATION')kind='WALLET';
  else if(objectType==='TOKEN_DEFINITION')kind='TOKEN';
  else if(objectType==='CONTRACT_CODE')kind='CONTRACT_CODE';
  else if(objectType==='RUNTIME_WHITELIST_UPDATE')kind='RUNTIME_AUTHORIZATION';
  else if(objectType==='DEMO_RECORD')kind='RECORD';
  else if(isTransfer)kind=assetId&&networkId&&!isNativeAsset?'TOKEN_TRANSFER':'TRANSFER';
  else if(isSwap)kind='SWAP';
  else if(isTransaction&&operation==='AMM_ADD_LIQUIDITY')kind='ADD_LIQUIDITY';
  else if(isTransaction&&operation==='AMM_REMOVE_LIQUIDITY')kind='REMOVE_LIQUIDITY';
  else if(isTransaction&&['TOKEN_CREATE','TOKEN_WITH_LP'].includes(operation))kind='TOKEN_CREATION';
  else if(isTransaction&&operation==='DEPLOY')kind='CONTRACT_DEPLOYMENT';
  else if(isTransaction&&['INVOKE','INVOKE_COMMIT','INVOKE_SETTLE'].includes(operation))kind='CONTRACT_EXECUTION';
  else if(isTransaction)kind='TRANSACTION';
  return Object.freeze({objectType:objectType||undefined,operation:operation||undefined,networkId:networkId||undefined,assetId:assetId||undefined,kind,isTransaction,isTransfer,isSwap,isToken,isNativeAsset});
}

export const observedObjectType=record=>classifyObservedRecord(record).objectType;
export const observedAssetId=record=>classifyObservedRecord(record).assetId;
export const isObservedToken=record=>classifyObservedRecord(record).isToken;
export const isObservedTransfer=record=>classifyObservedRecord(record).isTransfer;
export const isObservedSwap=record=>classifyObservedRecord(record).isSwap;
