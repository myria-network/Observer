# MYRIA Observer API

`createCommunityObserver()` never consumes another Observer API. Its runtime receives discovery announcements, retrieves content from network-advertised carriers, verifies it, and generates the local results exposed through this client.

See [DATA_MODEL.md](./DATA_MODEL.md) for the complete response structures and representation rules used by the methods below.

## Package exports

| Export | Purpose |
| --- | --- |
| `createCommunityObserver(options)` | Starts an autonomous read-only Observer through a compatible verification engine. |
| `createMyriaObserverClient(options)` | Creates an HTTP/WebSocket catalog client. |
| `MyriaObserverClient` | Client class used by the factory. |
| `MyriaObserverError` | Stable SDK error with `code` and optional HTTP `status`. |
| `OBSERVER_MODULES` | Complete immutable list of catalog module names. |
| `OBSERVER_CATALOG` | Module metadata, including whether a module supports live updates. |
| `ObserverProjectionWorker` | Bounded asynchronous database projection worker. |
| `OBSERVER_DATABASE_BLUEPRINT` | Names, keys, descriptions, and retention defaults for projected stores. |
| `observerDatabaseNames(prefix)` | Returns safe collection or table names for a prefix. |
| `createMongoObserverDatabase(options)` | MongoDB projection adapter. |
| `createPostgresObserverDatabase(options)` | PostgreSQL projection adapter. |
| `createMysqlObserverDatabase(options)` | MySQL projection adapter. |
| `createMariaDbObserverDatabase(options)` | MariaDB projection adapter. |
| `tokenAvatarArt(assetId, symbol?)` | Produces the deterministic MYRIA Pixel Blast portrait instructions for a token. |
| `tokenInitial(symbol?, name?)` | Produces its single-letter mark; MYR and TMYR always use `M`. |
| `drawTokenAvatar(canvas, options)` | Draws the canonical token portrait into a browser canvas. |
| `tokenAvatarPng(assetId, symbol?, name?)` | Returns the portrait as a cached PNG base64 data URL. |
| `walletAvatar(address)` | Produces deterministic, platform-neutral Pixel Blast instructions for a wallet portrait. |
| `walletAvatarRgba(address, resolution?)` | Rasterizes the portrait into square RGBA bytes at a resolution from 300 to 1024 pixels. |

## Semantic object classification

The SDK exports one shared vocabulary for community Observers, external indexes,
and user interfaces:

```js
import {
  classifyObservedRecord,
  isObservedToken,
  isObservedTransfer,
  isObservedSwap,
  observedAssetId,
  observedObjectType,
} from '@myria-network/observer';

classifyObservedRecord({
  objectType: 'TX',
  operation: 'TRANSFER',
  networkId,
  assetId,
}); // kind: 'TRANSFER' or 'TOKEN_TRANSFER'
```

- `classifyObservedRecord` returns the shared semantic kind and boolean flags.
- `isObservedToken`, `isObservedTransfer`, and `isObservedSwap` are focused predicates.
- `observedAssetId` and `observedObjectType` read normalized identifiers from
  both list records and detail DTOs.

These helpers classify data already returned by an Observer. They do not claim
economic acceptance; that remains a verified-ledger decision.

Public kinds include `TOKEN`, `TRANSFER`, `TOKEN_TRANSFER`, `SWAP`,
`LIQUIDITY`, `TOKEN_CREATION`, `CONTRACT_DEPLOYMENT`, and
`CONTRACT_EXECUTION`, in addition to structural network objects.

## Client

```js
const client = createMyriaObserverClient({url, timeoutMs?, fetch?, socketFactory?});
```

- `url` must use HTTPS. HTTP is accepted only for `localhost`, `127.0.0.1`, and `::1`.
- `timeoutMs` accepts values from 1 to 120 seconds.
- `fetch` and `socketFactory` allow controlled runtime integration and testing.
- JSON responses larger than 4 MiB are rejected.

### Generic catalog call

```js
await client.catalog({
  module: 'spores',
  params: {limit: 30, offset: 0, status: 'VERIFIED', type: 'TX'},
  live: false
});
```

Accepted parameters are `limit`, `offset`, `q`, `status`, `target`, `range`, `root`, `depth`, `nodes`, `type`, `health`, and `address`. The server applies its own limits and backend pagination.

| Module | Method | Detail by ID | Live |
| --- | --- | --- | --- |
| `overview` | `overview()` | — | Yes |
| `stats` | `stats()` | — | Yes |
| `status` | `status()` | — | Yes |
| `assets` | `assets()` | — | No |
| `carriers` | `carriers()` | — | Yes |
| `activity` | `activity()` | — | Yes |
| `research` | `research()` | — | No |
| `live-spores` | `liveSpores()` | — | Yes |
| `timeline` | `timeline()` | — | Yes |
| `spores` | `spores()` | `spore(id)` | No |
| `transfers` | `transfers()` | — | Yes |
| `transaction-gallery` | `transactionGallery()` | — | Yes |
| `wallet-gallery` | `walletGallery()` | — | Yes |
| `social-media` | `socialMedia()` | — | Yes |
| `contracts` | `contracts()` | `contract(id)` | Yes |
| `objects` | `objects()` | `object(id)` | No |
| `collections` | `collections()` | `collection(id)` | No |
| `catalogs` | `catalogs()` | `catalogDetail(id)` | No |
| `propagations` | `propagations()` | `propagation(id)` | No |
| `discoveries` | `discoveries()` | `discovery(id)` | No |
| `routes` | `routes(target)` | — | No |
| `health/scarce` | `scarce()` | — | No |
| `propagators` | `keepers()` | `keeper(id)` | No |
| `scouts` | `scouts()` | `scout(id)` | No |
| `graph` | `graph()` | — | No |
| `wallet` | `wallet(address)` | — | No |

Every list method accepts a pagination and filter object followed by an optional `{signal}` request option.

### Complete client method reference

All asynchronous reads return a cloned JSON-compatible value. Catalog responses include `__observer`, which identifies the network and provides the stable status context used to derive the response.

| Method | What it obtains |
| --- | --- |
| `health(options?)` | Minimal process health, active Genesis/NetworkID, and worker states from `GET /healthz`. |
| `catalog(request, options?)` | Generic typed catalog request through the single `POST /observer/catalog` endpoint. |
| `overview(params?, options?)` | Combined counters, status, carriers, recent activity, discoveries, and timeline. Defaults to `range: 60`. |
| `stats(options?)` | Current local aggregate counts from the verified Observer store. |
| `status(options?)` | Runtime, queues, discovery transports, resource budgets, storage, announcements, and `feeMarket`. |
| `assets(options?)` | Native asset and verified custom-token definitions plus accepted-ledger supply and holder statistics. |
| `carriers(options?)` | Carrier classes and locally observed route availability aggregated from admitted routes. |
| `activity(params?, options?)` | Retained, paginated observation and verification events. |
| `research(options?)` | Explicitly labelled local research projections and contract research records. |
| `liveSpores(params?, options?)` | Most recent discovery events and their cursor. |
| `timeline(params?, options?)` | Historical counter buckets or a bounded range of metric samples. |
| `spores(params?, options?)` | Paginated spores with verification, object type, observation time, and recoverability state. |
| `spore(id, params?, options?)` | One spore, its reconstructed object association, recent routes, preservation evidence, and health. |
| `transfers(params?, options?)` | Paginated verified transfer objects and accepted economic effects. |
| `transactionGallery(params?, options?)` | Presentation-ready transaction summaries derived from verified transaction records. |
| `walletGallery(params?, options?)` | Paginated public wallet summaries derived from exact verified address associations. |
| `wallet(address, params?, options?)` | Wallet profile, native balance, custom-token balances, and paginated activity from the accepted ledger. |
| `socialMedia(params?, options?)` | Paginated social-publication associations whose MYRIA spore relationship was observed. |
| `socialMediaImageUrl(postId)` | Safe local media-cache URL for a decimal social post ID; it performs no network request itself. |
| `contracts(params?, options?)` | Paginated verified contract deployments. |
| `contract(id, params?, options?)` | Deployment, runtime authorization, WASM fragment completeness, source package, executions, reserve, rewards, and transfers. |
| `objects(params?, options?)` | Paginated verified or observed objects; contract-related records are grouped into contract objects. |
| `object(id, params?, options?)` | One object with transaction data, recent spores, routes, and collection/catalog contents when applicable. |
| `collections(params?, options?)` | Paginated verified collection heads. |
| `collection(id, params?, options?)` | Collection identity, publisher, sequence, contents, routes, and capsule readiness. |
| `catalogs(params?, options?)` | Paginated verified catalogs. |
| `catalogDetail(id, params?, options?)` | Catalog identity, publisher, sequence, referenced collections, contents, routes, and capsule readiness. |
| `discoveryCapsule({type, id, signal?})` | Importable capsule for a verified `CATALOG` or `COLLECTION`. |
| `propagations(params?, options?)` | Paginated propagation evidence observed by this node. |
| `propagation(id, params?, options?)` | One propagation record and its locally verified routes. |
| `discoveries(params?, options?)` | Paginated signed discovery claims. |
| `discovery(id, params?, options?)` | One discovery claim and its target/route evidence. |
| `routes(target, params?, options?)` | Paginated known routes for an exact target ID. |
| `scarce(params?, options?)` | Objects ordered by local recoverability risk and independent carrier/origin diversity. |
| `keepers(params?, options?)` | Paginated Keeper identities derived from verified propagation-related evidence. |
| `keeper(id, params?, options?)` | Keeper claim history, reward destinations, signer fingerprints, and advertised directories. |
| `scouts(params?, options?)` | Paginated Scout identities derived from signed discovery claims. |
| `scout(id, params?, options?)` | Scout claim history and exact observed targets. |
| `graph(params?, options?)` | Bounded graph of Genesis, spores, objects, contracts, executions, publications, claims, and routes. |
| `subscribe(request, listener, options?)` | Live snapshot followed by ordered patches for a live-capable catalog. |
| `close()` | Unsubscribes, closes the client's WebSocket, and releases live resources. |

### Pagination and filters

Use backend pagination; do not download a complete catalog and paginate it in the application.

```js
const page = await client.objects({
  limit: 50,
  offset: 100,
  q: 'contract name or ID',
  status: 'VERIFIED',
  type: 'SMART_CONTRACT'
});

console.log(page.items, page.total, page.limit, page.offset);
```

Supported request parameters are:

| Parameter | Use |
| --- | --- |
| `limit` | Requested page size. The server caps it at 200. |
| `offset` | Backend offset, capped at 1,000,000. |
| `q` | Bounded search term supported by list catalogs. |
| `status` | Observation or verification-state filter. |
| `target` | Exact target ID used by routes. Prefer `routes(target)`. |
| `range` | Overview/timeline history range. |
| `root` | Graph root ID. |
| `depth` | Graph traversal depth; the server enforces its own maximum. |
| `nodes` | Maximum graph node count; the server enforces its own maximum. |
| `type` | Spore/object/graph type filter where supported. |
| `health` | Recoverability-state filter. |
| `address` | Exact wallet address. Prefer `wallet(address)`. |

Pass an `AbortSignal` separately from catalog parameters:

```js
const controller = new AbortController();
const page = await client.spores(
  {limit: 25, offset: 0, type: 'TX'},
  {signal: controller.signal}
);
```

### Fee-market data

Fee information is returned by `status()` as `feeMarket` and is also present in the status context returned with catalog data. It is an estimate derived from protocol evidence; the Observer does not invent or charge the fee.

```js
const {feeMarket} = await client.status();

if (feeMarket) {
  console.log(feeMarket.source);
  console.log(feeMarket.p75, feeMarket.p90);

  for (const quote of feeMarket.quotes) {
    console.log({
      operation: quote.operation,
      workUnits: quote.workUnits,
      estimatedFeeUnits: quote.estimatedFeeUnits,
      maximumFeeUnits: quote.maximumFeeUnits
    });
  }
}
```

The Observer obtains and calculates the snapshot as follows:

1. It loads the signed fee schedule committed by the active Genesis: profile, asset decimals, bootstrap atoms per work unit, absolute minimum per operation, sample window, minimum sample count, and deterministic work-unit profile.
2. It accepts a settlement price only after the related economic operation and finality evidence have passed network, signature, input, conservation, fee, Unique Spend, and participant checks.
3. It deduplicates settlement spends and bounds influence to at most three accepted samples per payer and ten per identical participant set inside the Genesis-defined market window.
4. When the minimum settlement sample count is reached, verified settlements are the source. Otherwise it uses current certified Keeper offers when available. If neither is available, it uses the Genesis bootstrap price.
5. It sorts the selected integer prices and calculates P25, median, P75, and P90 without floating-point arithmetic.
6. `recommendedAtomsPerWorkUnit` is P75.
7. `maximumAtomsPerWorkUnit` is `max(P90, ceil(P75 × 5 / 4))`.
8. Each base quote uses deterministic work units and applies the Genesis absolute floor:

```text
estimatedFeeUnits = max(workUnits × P75, absoluteMinimum)
maximumFeeUnits   = max(workUnits × maximumAtomsPerWorkUnit, absoluteMinimum)
```

The four quoted operation classes are `TRANSFER`, `TOKEN_CREATE`, `CONTRACT_EXEC`, and `CONTRACT_DEPLOY`. Their base work units come from the Genesis-authorized `MYRIA_WORK_UNITS_V2` profile. A concrete wallet operation can require more units because of its actual inputs, outputs, byte size, contract instructions, memory, or source/module size. The wallet therefore performs the final concrete quote and obtains confirmation before signing.

All monetary fields are decimal strings in atomic units. Convert them for display using `feeMarket.assetDecimals`; do not use JavaScript `Number` for economic calculations.

### Wallets, native balance, and custom tokens

```js
const result = await client.wallet('myr_w_...',{limit: 25, offset: 0});

console.log(result.balance); // Native asset only
console.log(result.tokens);  // Custom assets remain separate
```

The Observer derives wallet data from verified public objects and its accepted local ledger. It does not query or unlock the user's wallet. Native MYR and custom-token units are never added together.

### Deterministic token portraits

The optional `token-avatar` export lets community frontends render the same visual identity from a verified `AssetID`. Artwork is presentation only and never replaces token-definition or transaction verification.

```js
import {tokenAvatarPng} from '@myria-network/observer/token-avatar';

const image = tokenAvatarPng(asset.assetId, asset.symbol, asset.name);
document.querySelector('img').src = image;
```

`tokenAvatarArt()` is platform-neutral. Browser applications can use `drawTokenAvatar()` or `tokenAvatarPng()`. MYR and TMYR always use a violet palette and the letter `M`.

### Deterministic wallet portraits

The optional `wallet-avatar` export derives a square Pixel Blast portrait from a public wallet address. The same address produces the same portrait, while different addresses select among five compositions, eight palettes, localized grid regions and variable density. Wallet portraits deliberately contain no letter, central core or circular node overlay, and preserve truly dark areas between their branches.

```js
import {walletAvatarRgba} from '@myria-network/observer/wallet-avatar';

const portrait = walletAvatarRgba(wallet.address, 384);
canvas.width = portrait.width;
canvas.height = portrait.height;
canvas.getContext('2d').putImageData(
  new ImageData(portrait.bytes, portrait.width, portrait.height),
  0,
  0
);
```

`walletAvatar()` returns drawing instructions for custom renderers. `walletAvatarRgba()` returns a `Uint8ClampedArray` of RGBA pixels and works without DOM or canvas APIs. These portraits are presentation data and never prove ownership, validity, or wallet identity.

### Contracts, source, executions, and rewards

```js
const detail = await client.contract(contractId,{limit: 10, offset: 0});

console.log(detail.runtime);
console.log(detail.wasmFragments);
console.log(detail.source?.javascript ?? 'Source package unavailable');
console.log(detail.executions);
console.log(detail.rewardHistory);
```

Source appears only when a recoverable network source package binds the active network, deployment, ContractID, WasmID, source hash, compiler, and build profile. Contract discovery never executes or recompiles the contract. Execution results come from accepted execution outcomes. Reward history separates currently available creator fees, withdrawn creator-fee payouts, and transfers produced by contract effects.

### Collections, catalogs, and portable discovery

```js
const collection = await client.collection(collectionId,{limit: 100, offset: 0});

if (collection.importReady) {
  const {capsule} = await client.discoveryCapsule({
    type: 'COLLECTION',
    id: collectionId
  });
  console.log(capsule);
}
```

Capsule creation succeeds only for an already verified catalog or collection. A capsule carries public discovery information and does not grant validity to its targets.

### Additional reads

- `health({signal?})`: process, Genesis, and worker status.
- `discoveryCapsule({type, id, signal?})`: creates an importable capsule for an already verified catalog or collection.
- `socialMediaImageUrl(postId)`: builds the local validated URL for media cached by the Observer.
- `subscribe(request, listener, {onError?})`: receives an initial snapshot and ordered live patches.
- `close()`: closes Socket.IO and every subscription owned by the client.

### Errors

```js
try {
  await client.contract(contractId);
} catch (error) {
  if (error instanceof MyriaObserverError) {
    console.error(error.code, error.status);
  }
}
```

Stable client codes include invalid request/parameter/ID errors, `OBSERVER_UNAVAILABLE`, `OBSERVER_TIMEOUT`, `CANCELLED`, `OBSERVER_REQUEST_FAILED`, `INVALID_OBSERVER_RESPONSE`, and `OBSERVER_RESPONSE_TOO_LARGE`. The SDK rejects non-JSON catalog responses, responses above 4 MiB, unsafe object keys, malformed patch paths, unsupported modules, and non-HTTPS remote endpoints.

## Community runtime

The canonical protocol SDK is available from `@myria-network/protocol`. The executable adapter expected by `createCommunityObserver()` is the separate `@myria-network/protocol/observer` subpath; a local `myria-protocol-engine.js` shim is not required. These subpaths currently resolve from the MYRIA source workspace and are not bundled with the `@myria-network/observer` npm package.

```js
import {createCommunityObserver} from '@myria-network/observer';
import * as engine from '@myria-network/protocol/observer';

const observer = await createCommunityObserver({
  home: './myria-observer-data',
  port: 4318,
  engine
});
```

```js
const observer = await createCommunityObserver(options);
```

| Option | Description |
| --- | --- |
| `home` | Exclusive persistent Observer directory. Required. |
| `network` | Optional network alias understood by the supplied protocol engine. |
| `port` | Loopback port. Use `0` to request a free system port. |
| `initializePublicNetwork` | Installs public bootstrap evidence when missing. Defaults to `true`. |
| `config` | Bounded verification, transport, and retention configuration. |
| `policy` | Advanced read policy. |
| `multi` | Advanced multi-transport options. |
| `engine` | Compatible verified MYRIA engine adapter. |

The returned instance exposes:

- `networkId` and `url`.
- `status()` for local status and budgets.
- `catalog(request)` for in-process reads.
- `submit(candidate)` to connect another public announcement transport; the candidate still passes normal admission and verification.
- Idempotent `close()`.

The runtime fixes `mutateNetwork: false`. Rendering and application-specific presentation remain separate from the catalog API.

## Database projection API

The storage API is exported from both `@myria-network/observer` and `@myria-network/observer/storage`.

### Database adapters

```js
const mongo = await createMongoObserverDatabase({url, database, prefix, maxPoolSize});
const postgres = await createPostgresObserverDatabase({connectionString, prefix, maxPoolSize});
const mysql = await createMysqlObserverDatabase({url, prefix, maxPoolSize});
const mariadb = await createMariaDbObserverDatabase({url, prefix, maxPoolSize});
```

Every adapter implements:

- `initialize()`
- `upsertEntities(records)`
- `upsertRoutes(records)`
- `upsertEvents(records)`
- `insertMetric(record)`
- `setCheckpoint(record)`
- `prune({now, eventRetentionMs?, metricRetentionMs?})`
- `close()`

Applications can implement the same interface for another database. `OBSERVER_DATABASE_BLUEPRINT` describes the required stores and `observerDatabaseNames(prefix)` returns validated names.

### Projection worker

```js
const worker = new ObserverProjectionWorker({
  client,
  database,
  pageSize: 100,
  intervalMs: 15_000
});

await worker.initialize();
await worker.syncOnce();
await worker.backfill({maxRecords: 25_000});
await worker.start({immediate: false});

console.log(worker.status());
worker.stop();
```

`syncOnce()` persists the newest bounded page of spores, objects, contracts, collections, catalogs, propagations, discoveries, routes, activity, stats, and status. `backfill()` walks pages up to the caller's explicit global maximum. `start()` never overlaps cycles. `status()` reports running/stopped state, the last successful sync time, and the last error. See [DATABASES.md](./DATABASES.md) for schemas, retention, and complete connector examples.
