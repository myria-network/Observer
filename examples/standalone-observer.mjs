import {createCommunityObserver,createMyriaObserverClient} from '@myria-network/observer';
import * as engine from '@your-org/myria-protocol-engine';

const node=await createCommunityObserver({
  home:process.env.MYRIA_OBSERVER_HOME??'./myria-community-observer',
  port:0,
  engine,
  config:{
    verify:true,
    activeChecks:true,
    sources:{nostr:true,p2p:true,dht:true,waku:true,hyperswarm:true},
  },
});

const api=createMyriaObserverClient({url:node.url});
const [health,status,spores,contracts,catalogs]=await Promise.all([
  api.health(),
  api.status(),
  api.spores({limit:20,offset:0}),
  api.contracts({limit:20,offset:0}),
  api.catalogs({limit:20,offset:0}),
]);

console.log(JSON.stringify({
  localApi:node.url,
  networkId:health.networkId,
  discovery:status.sources,
  spores:spores.items,
  contracts:contracts.items,
  catalogs:catalogs.items,
},null,2));

api.close();
await node.close();
