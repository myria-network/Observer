# Observer data model

This document describes the JSON-compatible structures returned by the public SDK. It defines presentation-independent contracts that can be consumed by any frontend or backend.

## Representation rules

| Value | Representation |
| --- | --- |
| `NetworkID`, `SporeID`, `ObjectID`, `ContractID`, `WasmID`, manifest IDs, and transaction IDs | Lowercase 64-character hexadecimal string. |
| Wallet address | Public `myr_w_...` address string. |
| Keeper or Scout identity | Public role-address string. |
| Monetary amount | Base-10 string containing atomic units. Never a JavaScript `number`. |
| Date and time | Integer Unix timestamp in milliseconds. Applications format it in the viewer's locale and time zone. |
| Missing verified value | `null`, omitted field, or an explicit unavailable state. It is never guessed. |
| Extensible payload | JSON object. Consumers must ignore unknown fields for forward-compatible additions. |

## Catalog envelope

Every catalog response is an object. It includes stable context under `__observer`:

```ts
interface ObserverContext {
  networkId?: string;
  role?: 'OBSERVER';
  workers?: Record<string, unknown>;
  sources?: Record<string, unknown>;
  budgets?: Record<string, unknown>;
  feeMarket?: FeeMarketSnapshot | null;
  [key: string]: unknown;
}

interface CatalogEnvelope {
  __observer?: ObserverContext;
  [key: string]: unknown;
}
```

`__observer.networkId` identifies the Genesis dataset used to derive the response. Consumers should reject or separate data when it does not match the expected network.

## Paginated result

List methods return backend pages:

```ts
interface CatalogPage<T> extends CatalogEnvelope {
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
}
```

`total` is the count for the active filter when the module can calculate it. An absent total means the source exposes a cursor or bounded recent window instead.

## Observation record

Spores, objects, collections, catalogs, propagation evidence, and discovery claims share these fields where applicable:

```ts
interface ObservedRecord {
  id: string;
  type: string;
  status: string;
  firstObservedAt: number;
  lastObservedAt: number;
  lastVerifiedAt: number;
  objectId?: string;
  manifestId?: string;
  healthStatus?: 'CRITICAL' | 'SCARCE' | 'UNDER_REPLICATED' | 'HEALTHY' | 'UNKNOWN';
  data: Record<string, unknown>;
  sources?: unknown[];
}
```

`status` describes the local Observer's evidence state. Observation does not imply reconstruction, signature validity, economic acceptance, or current availability.

## Health

`health()` returns:

```ts
interface ObserverHealth {
  status: 'ok';
  networkId: string;
  workers: Record<string, unknown>;
}
```

This endpoint indicates that the process can answer requests. Use `status()` for detailed transport, queue, storage, and budget information.

## Overview, statistics, and status

`overview()` combines data needed for an initial application view:

```ts
interface ObserverOverview extends CatalogEnvelope {
  stats: Record<string, number | string | boolean | null>;
  status: ObserverStatus;
  carriers: CarrierSummary[];
  activity: ActivityEvent[];
  discoveries: unknown[];
  discoveryCursor?: string | number;
  timeline: unknown;
}
```

`stats()` returns local aggregate counters. `status()` returns the runtime snapshot:

```ts
interface ObserverStatus extends CatalogEnvelope {
  role: 'OBSERVER';
  startedAt: number;
  uptimeMs: number;
  queue: number;
  verify: boolean;
  activeChecks: boolean;
  workers: Record<string, {state: string; queued?: number}>;
  sources: Record<string, unknown>;
  announcements: Record<string, number>;
  storage: Record<string, unknown>;
  budgets: Record<string, number>;
  feeMarket: FeeMarketSnapshot | null;
}
```

## Fee market

```ts
type FeeOperation =
  | 'TRANSFER'
  | 'TOKEN_CREATE'
  | 'CONTRACT_DEPLOY'
  | 'CONTRACT_EXEC';

interface FeeQuote {
  operation: FeeOperation;
  workUnits: string;
  estimatedFeeUnits: string;
  maximumFeeUnits: string;
}

interface FeeMarketSnapshot {
  profile: string;
  scheduleId: string;
  source:
    | 'VERIFIED_SETTLEMENTS'
    | 'CERTIFIED_KEEPER_OFFERS'
    | 'GENESIS_BOOTSTRAP';
  samples: number;
  certifiedOffers: number;
  assetDecimals: number;
  bootstrapAtomsPerWorkUnit: string;
  p25: string;
  median: string;
  p75: string;
  p90: string;
  recommendedAtomsPerWorkUnit: string;
  maximumAtomsPerWorkUnit: string;
  quotes: FeeQuote[];
}
```

All price and amount fields are atomic-unit strings. [API reference: fee-market data](./API.md#fee-market-data) explains evidence selection and the exact formulas.

## Assets

`assets()` returns:

```ts
interface AssetRecord {
  assetId: string;
  name?: string;
  symbol?: string;
  decimals: number;
  issuer?: string;
  supplyPolicy: string;
  fixedSupply?: string;
  observedSupply?: string;
  holders?: number;
  transfers?: number;
  status: string;
  firstObservedAt: number;
  lastObservedAt: number;
  lastVerifiedAt: number;
}

interface AssetCatalog extends CatalogEnvelope {
  networkId: string;
  scope: 'LOCAL_ACCEPTED_LEDGER';
  available: boolean;
  items: AssetRecord[];
  total?: number;
}
```

The native asset and each custom token remain separate records.

## Wallet

`wallet(address)` returns public information derived from accepted records:

```ts
interface ObservedBalance {
  balance: string | null;
  received?: string;
  spent?: string;
  conflicts?: number;
  status?: string;
  [key: string]: unknown;
}

interface WalletTokenBalance {
  assetId: string;
  name?: string;
  symbol?: string;
  decimals: number;
  units: string;
  display?: string;
}

interface WalletDetail extends CatalogEnvelope {
  address: string;
  found: boolean;
  balance: ObservedBalance;
  tokens: WalletTokenBalance[];
  items?: unknown[];
  total?: number;
  limit?: number;
  offset?: number;
}
```

The Observer never combines custom-token units with the native balance.

## Spores and objects

`spores()` and `objects()` return `CatalogPage<ObservedRecord>`. Detail methods add related information:

```ts
interface RecordDetail extends ObservedRecord, CatalogEnvelope {
  transaction?: Record<string, unknown>;
  recentSpores?: RouteRecord[];
  routes?: CatalogPage<RouteRecord> | RouteRecord[];
  health?: Recoverability;
  contents?: CatalogPage<DirectoryEntry>;
  importReady?: boolean;
}
```

`data.objectType` carries the verified parent object's type when known. It is absent or explicitly unknown until reconstruction and verification complete.

## Transfers and activity

Transfer and activity rows retain their verified IDs and atomic units:

```ts
interface TransferRecord extends ObservedRecord {
  data: {
    operation?: string;
    from?: string;
    to?: string;
    assetId?: string;
    amount?: string;
    fee?: string;
    [key: string]: unknown;
  };
}

interface ActivityEvent {
  id: string | number;
  timestamp: number;
  eventType: string;
  targetType: string;
  targetId: string;
  [key: string]: unknown;
}
```

`transfers()` returns a page of transfer records. `transactionGallery()` returns a presentation-oriented summary without changing the underlying economic values.

## Contracts

`contracts()` returns deployment records. `contract(id)` returns:

```ts
interface WasmFragmentSummary {
  observed: number;
  verified: number;
  expected: number | null;
  complete: boolean;
  codeBytes: number;
}

interface ContractSource {
  javascript: string;
  sourceHash: string;
  buildProfile: string;
  compiler: string;
  scope: string;
  verification: string;
  collectionId?: string;
  headId?: string;
  sourceUrl?: string;
  retrievedAt?: number;
}

interface ContractExecution {
  transactionId: string;
  invocationId?: string;
  executionId?: string;
  sender?: string;
  input?: unknown;
  status: string;
  reason?: string | null;
  output?: unknown;
  rewards: Array<{to: string; amountUnits: string}>;
  observedAt: number;
  verifiedAt: number;
}

interface ContractDetail extends ObservedRecord, CatalogEnvelope {
  name?: string;
  deploymentObjectId: string;
  lastActivityAt: number;
  executionTotal: number;
  wasmFragments: WasmFragmentSummary;
  source: ContractSource | null;
  runtime: Record<string, unknown> | null;
  rewardHistory: {
    availableUnits: string;
    withdrawnUnits: string;
    transferredUnits: string;
  };
  executions: ContractExecution[];
  executionLimit: number;
}
```

Source and runtime fields remain `null` when their evidence is unavailable. Executions contain accepted outcomes; internal commit/settle phases are grouped for consumers.

## Collections, catalogs, and directory contents

Collection and catalog lists use `CatalogPage<ObservedRecord>`. Details can include:

```ts
interface DirectoryEntry {
  path: string;
  type?: string;
  targetId?: string;
  size?: number;
  hash?: string;
  [key: string]: unknown;
}
```

`importReady: true` means `discoveryCapsule()` can create a portable public capsule for the verified ID. It does not mean every referenced file is currently available.

## Routes and carriers

```ts
interface RouteRecord {
  routeId: string;
  targetType: string;
  targetId: string;
  locator?: string;
  carrierClass: string;
  verificationStatus: string;
  firstObservedAt: number;
  lastObservedAt: number;
  lastVerifiedAt: number;
  [key: string]: unknown;
}

interface CarrierSummary {
  carrierClass?: string;
  status?: string;
  routes?: number;
  [key: string]: unknown;
}
```

`routes(target)` returns the routes for one exact ID. A route can be observed without being admitted or verified available.

## Keepers and Scouts

```ts
interface ParticipantDetail extends CatalogEnvelope {
  id: string;
  type: 'KEEPER' | 'SCOUT';
  status: string;
  publisher: string;
  firstObservedAt: number;
  lastObservedAt: number;
  lastVerifiedAt: number;
  claims: ObservedRecord[];
  claimTotal: number;
  claimLimit: number;
  rewardDestinations?: string[];
  signerFingerprints?: string[];
  keeperDirectories?: unknown[];
  scope: 'OBSERVED_ID_NOT_UNIQUE_HUMAN';
}
```

Participant records describe verified public claims. They do not prove a unique person or reward eligibility.

## Social publications

`socialMedia()` returns a page of associations between observed MYRIA spores and supported external post identifiers. The exact external metadata is optional and untrusted presentation data. `socialMediaImageUrl(postId)` produces an Observer-local media URL; the browser does not contact the external host through that function.

## Recoverability

```ts
interface Recoverability {
  healthStatus: 'CRITICAL' | 'SCARCE' | 'UNDER_REPLICATED' | 'HEALTHY' | 'UNKNOWN';
  completeCopies?: number;
  independentOrigins?: number;
  carrierClasses?: number;
  [key: string]: unknown;
}
```

`scarce()` returns a page ordered by this local estimate. Repeated announcements do not increase complete-copy counts.

## Graph

```ts
interface GraphNode {
  id: string;
  type: string;
  label?: string;
  status?: string;
  observedAt?: number;
  [key: string]: unknown;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  [key: string]: unknown;
}

interface GraphResult extends CatalogEnvelope {
  nodes: GraphNode[];
  edges: GraphEdge[];
  [key: string]: unknown;
}
```

The server bounds depth and node count. Graph relationships are derived views and grant no additional protocol authority.

## Live updates

```ts
interface LiveUpdate {
  kind: 'snapshot' | 'patch';
  revision: number;
}

interface LiveSubscription {
  readonly key: string;
  close(): void;
}
```

The listener always receives the fully materialized current value. Patches are applied and validated inside the SDK. A revision discontinuity triggers a new snapshot request.

## Method-to-result map

| Method | Result structure |
| --- | --- |
| `health()` | `ObserverHealth` |
| `overview()` | `ObserverOverview` |
| `stats()` | Aggregate object plus `CatalogEnvelope` |
| `status()` | `ObserverStatus` |
| `assets()` | `AssetCatalog` |
| `carriers()` | `{items: CarrierSummary[]} & CatalogEnvelope` |
| `activity()` | `CatalogPage<ActivityEvent>` |
| `research()` | Extensible research object plus `CatalogEnvelope` |
| `liveSpores()` | Recent-discovery object with items/cursor plus `CatalogEnvelope` |
| `timeline()` | Bounded samples/aggregates plus `CatalogEnvelope` |
| `spores()` | `CatalogPage<ObservedRecord>` |
| `spore(id)` | `RecordDetail` |
| `transfers()` | `CatalogPage<TransferRecord>` |
| `transactionGallery()` | `CatalogPage<TransferRecord>` |
| `walletGallery()` | `CatalogPage<WalletDetail>` |
| `wallet(address)` | `WalletDetail` |
| `socialMedia()` | Paginated social-publication records |
| `contracts()` | `CatalogPage<ObservedRecord>` |
| `contract(id)` | `ContractDetail` |
| `objects()` | `CatalogPage<ObservedRecord>` |
| `object(id)` | `RecordDetail` |
| `collections()` | `CatalogPage<ObservedRecord>` |
| `collection(id)` | `RecordDetail` with `contents` |
| `catalogs()` | `CatalogPage<ObservedRecord>` |
| `catalogDetail(id)` | `RecordDetail` with `contents` |
| `propagations()` | `CatalogPage<ObservedRecord>` |
| `propagation(id)` | `RecordDetail` |
| `discoveries()` | `CatalogPage<ObservedRecord>` |
| `discovery(id)` | `RecordDetail` |
| `routes(target)` | Route page or bounded route result |
| `scarce()` | `CatalogPage<Recoverability>` |
| `keepers()` | Paginated participant summaries |
| `keeper(id)` | `ParticipantDetail` |
| `scouts()` | Paginated participant summaries |
| `scout(id)` | `ParticipantDetail` |
| `graph()` | `GraphResult` |
| `discoveryCapsule()` | `{capsule: string}` |

The TypeScript declarations shipped in `dist/index.d.ts` are the machine-readable API contract. This document explains their meaning and trust limits.
