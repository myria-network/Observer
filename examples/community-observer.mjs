import {createCommunityObserver} from '@myria-network/observer';
import * as engine from '@myria-network/protocol/observer';

const observer=await createCommunityObserver({
  home:process.env.MYRIA_OBSERVER_HOME??'./myria-community-observer',
  port:Number(process.env.PORT??4318),
  engine,
  config:{verify:true,activeChecks:true},
});

console.log(JSON.stringify({networkId:observer.networkId,url:observer.url}));
const stop=async()=>{await observer.close();process.exit(0);};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
