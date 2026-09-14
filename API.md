# MYRIA Observer API

`createCommunityObserver()` never consumes another Observer API. Its runtime receives discovery announcements, retrieves content from network-advertised carriers, verifies it, and generates the local results exposed through this client.

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

### Additional reads

- `health({signal?})`: process, Genesis, and worker status.
- `discoveryCapsule({type, id, signal?})`: creates an importable capsule for an already verified catalog or collection.
- `socialMediaImageUrl(postId)`: builds the local validated URL for media cached by the Observer.
- `subscribe(request, listener, {onError?})`: receives an initial snapshot and ordered live patches.
- `close()`: closes Socket.IO and every subscription owned by the client.

## Community runtime

```js
const observer = await createCommunityObserver(options);
```

| Option | Description |
| --- | --- |
| `home` | Exclusive persistent Observer directory. Required. |
| `network` | Local network alias. Defaults to `test-myria`. |
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
