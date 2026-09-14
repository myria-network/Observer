# MYRIA Observer SDK

JavaScript library for running an autonomous, read-only community Observer and consuming its views through a single catalog API.

## Documentation

| Guide | Use it for |
| --- | --- |
| [API reference](./API.md) | Every exported function, client method, parameter, response, fee calculation, error, live subscription, runtime control, and persistence method. |
| [Data model](./DATA_MODEL.md) | Shared primitives, envelopes, pages, records, status, fee, wallet, contract, route, graph, and live-update structures. |
| [Data provenance and verification](./DATA_PROVENANCE.md) | How the Observer discovers, reconstructs, verifies, and derives spores, objects, wallets, balances, tokens, transfers, contracts, fees, routes, and metrics. |
| [Database persistence](./DATABASES.md) | MongoDB, PostgreSQL, MySQL, and MariaDB schemas, adapters, retention, projection workers, and bounded backfills. |
| [Security](./SECURITY.md) | Trust boundaries, safe deployment requirements, input limits, endpoint exposure, and operational controls. |
| [Contributing](./CONTRIBUTING.md) | Public protocol boundary, implementation-neutral documentation rules, protocol version references, and contribution requirements. |

Choose a starting point:

- **Build an application:** start with [Consume an Observer](#consume-an-observer), then use the [complete API reference](./API.md#complete-client-method-reference).
- **Understand where a value comes from:** read [Data provenance and verification](./DATA_PROVENANCE.md), including [network fee estimates](./DATA_PROVENANCE.md#network-fee-estimates).
- **Run an Observer:** start with [Run a community Observer](#run-a-community-observer), then review [Security](./SECURITY.md).
- **Store queryable projections:** follow [Database persistence](./DATABASES.md).
- **Contribute protocol-facing behavior:** read [Contributing](./CONTRIBUTING.md) before changing validation or documentation.

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

This repository distributes the Observer runtime integration point, HTTP/WebSocket client, typed catalog, and database projection adapters. It does not prescribe a frontend framework, backend web framework, cloud provider, or database.

The client and database adapters work independently. `createCommunityObserver()` receives a compatible MYRIA protocol engine that provides cryptographic verification, storage, and discovery transports. This separation lets an operator use any frontend and backend while keeping protocol validity inside one reviewed engine. Every client receives its endpoint explicitly from the integrating application.

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
- Generate deterministic Pixel Blast token portraits from verified AssetIDs.

The complete method reference, accepted filters, fee calculation, return fields, errors, subscriptions, runtime controls, and persistence methods are documented in the [API reference](./API.md).

## Installation

Install the public package from npm:

```bash
npm install @myria-network/observer
```

Community frontends can generate the same token image without downloading an icon:

```js
import {tokenAvatarPng} from '@myria-network/observer/token-avatar';

tokenImage.src = tokenAvatarPng(asset.assetId, asset.symbol, asset.name);
```

The current `0.x` line is a public preview. The `next` channel can be selected
explicitly with `npm install @myria-network/observer@next`.

Node.js 24.14.0 is required for the packaged runtime integration. Browser applications only use the client bundle. A complete Observer process requires a compatible protocol engine adapter.

## Run a community Observer

```js
import {createCommunityObserver} from '@myria-network/observer';
import * as engine from './myria-protocol-engine.js';

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

Startup installs only the public bootstrap supplied by the engine, opens stores separated by Genesis, starts discovery, and serves the API on loopback. It never creates wallets, Keepers, Scouts, or Genesis identities. Review [Security](./SECURITY.md) before exposing an API publicly.

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

The Observer backend and the application frontend remain separate:

```text
MYRIA protocol engine
        ↓ verified local state
createCommunityObserver()
        ↓ catalog API + live updates
your backend, reverse proxy, or application server
        ↓
your frontend
```

An application can serve its frontend from any stack. It only needs to provide the Observer endpoint to `createMyriaObserverClient()`. The frontend never connects directly to discovery transports, carriers, databases, or wallet homes.

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

The documentation index at the top of this page links every maintained guide in this repository.
