import {
  createCommunityObserver,
  createMyriaObserverClient,
  createMongoObserverDatabase,
  ObserverProjectionWorker,
} from '@myria-network/observer';
import * as engine from '@your-org/myria-protocol-engine';

if(!process.env.MONGODB_URI)throw new Error('MONGODB_URI_REQUIRED');

const observer=await createCommunityObserver({
  home:process.env.MYRIA_OBSERVER_HOME??'./myria-community-observer',
  port:0,
  engine,
});
const client=createMyriaObserverClient({url:observer.url});
const database=await createMongoObserverDatabase({url:process.env.MONGODB_URI,database:process.env.MONGODB_DATABASE??'myria_observer'});
const projector=new ObserverProjectionWorker({client,database,pageSize:100,intervalMs:15000});
await projector.start();

console.log(JSON.stringify({networkId:observer.networkId,localApi:observer.url,database:database.names}));

const stop=async()=>{projector.stop();client.close();await database.close();await observer.close();process.exit(0);};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
