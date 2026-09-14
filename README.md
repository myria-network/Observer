# MYRIA Observer SDK

JavaScript library for running an autonomous, read-only community Observer and consuming its views through a single catalog API.

The node does not query another Observer. It listens directly to the enabled discovery transports, admits announcements under local resource limits, retrieves spores from their announced carriers, verifies the available evidence, and builds its own database. Contracts, catalogs, collections, routes, and metrics always describe what that Observer instance has observed.

```text
Nostr / Waku / Iroh / P2P / DHT / Hyperswarm
                       ↓ announcements
                Community Observer
                       ↓ retrieval
                Discovered carriers
                       ↓ verification
          Local store + HTTP/WebSocket API
                       ↓
             Applications and services
```

## Repository status

This repository distributes the HTTP/WebSocket client, typed catalog, database projection adapters, and runtime integration point.

The client and database adapters work independently. `createCommunityObserver()` also needs a compatible MYRIA engine that provides cryptographic verification and discovery transports. Until that engine is publicly distributed through npm, pass its verified adapter explicitly through `engine`. Every client receives its endpoint explicitly from the integrating application.

## SDK capabilities

- Start and stop an autonomous read-only Observer through a compatible verification engine.
- Receive announcements directly from configured discovery transports.
- Retrieve candidate bytes from announced carriers and expose only admitted results and explicit observation states.
- Read overview counters, worker status, transport state, activity, research data, and historical metric buckets.
- List and inspect spores, objects, wallets, native balances, custom tokens, transfers, contracts, executions, collections, catalogs, routes, Keepers, Scouts, and social publications.
- Read the verified fee-market snapshot and base-operation fee estimates derived from Genesis, accepted settlements, and certified Keeper offers.
- Query content recoverability and build a bounded discovery graph.
- Generate import capsules for verified collections and catalogs.
- Receive snapshots and ordered patches over one WebSocket connection per client.
- Project bounded pages asynchronously into MongoDB, PostgreSQL, MySQL, or MariaDB.

The complete method reference, accepted filters, fee calculation, return fields, errors, subscriptions, runtime controls, and persistence methods are documented in [API.md](./API.md).

## Installation

Install directly from GitHub:

```bash
npm install github:myria-network/Observer
```

Node.js 24.14.0 is required. When the public engine package becomes available, it can be installed alongside this SDK. Until then, `createMyriaObserverClient()` and the database connectors are immediately usable, while a complete Observer process requires an injected engine adapter.

## Run a community Observer

```js
import {createCommunityObserver} from '@myria-network/observer';
import * as engine from 'test-myria/observer'; // Compatible verified engine

const observer = await createCommunityObserver({
  home: './myria-observer-data',
  port: 4318,
  engine,
  config: {
    verify: true,
    activeChecks: true,
    sources: {nostr: true, p2p: true, dht: true, waku: true, hyperswarm: true}
  }
});

console.log(observer.networkId, observer.url);

process.once('SIGINT', async () => {
  await observer.close();
  process.exit(0);
});
```

Startup installs only the public bootstrap supplied by the engine, opens stores separated by Genesis, starts discovery, and serves the API on loopback. It never creates wallets, Keepers, Scouts, or Genesis identities. Put a hardened HTTPS reverse proxy in front of any Internet-facing deployment.

## Consume an Observer

```js
import {createMyriaObserverClient} from '@myria-network/observer';

const myria = createMyriaObserverClient({
  url: 'https://your-observer.example'
});

const health = await myria.health();
const spores = await myria.spores({limit: 20, offset: 0});
const contracts = await myria.contracts({limit: 20, offset: 0});

console.log(health.networkId, spores.total, contracts.items);
myria.close();
```

## Application integration

The full Observer process needs Node.js, persistent storage, and long-lived discovery connections. It can serve any presentation layer but does not run inside a browser.

- Browser applications use `createMyriaObserverClient()` against the API of their community-managed Observer.
- Server applications may run the Observer as a separate persistent Node.js service. Do not start it per request or inside a short-lived serverless function.
- Backend services can use the same catalog client or project verified results into a supported database.

All view reads use `POST /observer/catalog`. Module names, parameters, and live capabilities are declared in `OBSERVER_CATALOG`, so applications do not need to construct a different URL for every view.

```js
import {OBSERVER_CATALOG} from '@myria-network/observer';

console.table(OBSERVER_CATALOG);
```

## Live updates

```js
const subscription = myria.subscribe(
  {module: 'overview', params: {range: 60}},
  (overview, update) => console.log(update.revision, overview.stats),
  {onError: console.error}
);

// Release the subscription when the view is no longer active.
subscription.close();
myria.close();
```

The client maintains one Socket.IO connection per instance, validates revisions and patches, requests a fresh snapshot after a discontinuity, and disconnects after the last subscription closes.

## Contract JavaScript

`myria.contract(contractId)` returns source code only after the Observer has recovered a published source package and verified its `NetworkID`, `ContractID`, deployment transaction, `WasmID`, source hash, and signatures. The Observer neither compiles nor executes that JavaScript. Replaying WASM for an audit is a separate wallet-engine or specialized-tool operation.

See [DATA_PROVENANCE.md](./DATA_PROVENANCE.md) for how every view is discovered, verified, and derived. See [API.md](./API.md) for every method, [SECURITY.md](./SECURITY.md) before exposing an Observer publicly, and [DATABASES.md](./DATABASES.md) to project admitted results into MongoDB, PostgreSQL, MySQL, or MariaDB through a bounded asynchronous worker. [CONTRIBUTING.md](./CONTRIBUTING.md) defines the boundary between the public protocol and implementation-specific material. Maintainers can follow [PUBLISHING.md](./PUBLISHING.md) to release the package under the `@myria-network` npm scope.
