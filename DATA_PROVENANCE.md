# Data provenance and verification

This document explains where every public Observer view comes from, which checks make it visible as verified, and which conclusions the Observer deliberately does not make.

## End-to-end pipeline

```text
Public Genesis bootstrap
          +
Discovery announcements from enabled transports
          ↓
Bounded candidate admission
          ↓
Route safety policy
          ↓
Carrier retrieval under byte, time, redirect, and concurrency budgets
          ↓
Spore frame + manifest verification
          ↓
Object reconstruction from the required parts
          ↓
Object, signature, NetworkID, dependency, and economic validation
          ↓
Local verification store
          ↓
Catalog API + optional asynchronous database projection
```

The Observer connects to discovery transports itself. A dashboard user never opens a discovery connection. Browser clients receive snapshots and ordered updates from the Observer's single server-side view.

An announcement is only a reason to investigate. It is not proof that content exists, belongs to MYRIA, is current, or is economically valid.

## Trust and availability states

| State | Meaning |
| --- | --- |
| `OBSERVED` | The ID or claim was announced, but the content needed for full verification is still missing or incomplete. |
| `VERIFIED` | The Observer recovered the required bytes and completed the applicable cryptographic and protocol checks. |
| `INVALID` | Recovered data failed a required check and is excluded from normal verified views. |
| `VERIFIED_ACTIVE` | A route recently returned content that verified for the requested target. |
| `VERIFIED_STALE` | The route verified previously but is outside the current reachability window. |
| `DEAD` | Recent bounded checks failed according to the local route policy. |
| `UNKNOWN` | The Observer lacks enough evidence to classify availability. |

“Verified by this Observer” means that this instance performed the checks using its active Genesis. It does not mean that every Observer has seen the same object.

## Discovery inputs

The engine can listen to Nostr, Waku, Iroh, direct P2P/libp2p, DHT-assisted peer discovery, Hyperswarm, ntfy, and explicitly imported public evidence when enabled by the network profile. Each transport carries bounded announcements or frames; it never grants authority by itself.

A local wallet bridge may notify the Observer about public signed activity. Those notifications remain reports until the Observer imports and verifies the referenced public evidence. Wallet secrets, balances reported by the wallet, and signing authority are never imported.

`META_HINT_FROM:<SporeID>` means that a verified MetaSpore suggested another spore, collection, or route. It records provenance for the hint. The suggested target must still pass the same retrieval and verification pipeline.

## Spores

A spore is obtained from a discovery frame, a verified carrier route, a bundle slice, an imported discovery capsule, or a verified MetaSpore hint.

The Observer checks:

1. Frame structure and bounded size.
2. Spore identifier against its canonical bytes.
3. Manifest identifier and manifest structure.
4. The active `NetworkID`.
5. Part index and the manifest's required-part rules.
6. The reconstructed object's identifier, signature, and object-specific schema.

A spore becomes verified only when its packaging is valid and the referenced object can be reconstructed and verified. Receiving the same announcement many times does not create additional copies.

The spores catalog derives the displayed content type from the verified parent object when available. For example, a spore can be presented as a transfer, smart contract, contract execution, token definition, or another protocol object without changing the spore itself.

## Objects

An object is reconstructed from enough verified spore parts belonging to one manifest. The engine then checks the canonical object ID, active Genesis, signatures, schema, parent references, and any object-specific invariants.

Common verified object types include:

- `GENESIS`
- `WALLET_CREATION`
- `TX`
- `TOKEN_DEFINITION`
- `CONTRACT_CODE`
- `RUNTIME_WHITELIST_UPDATE`
- `BUNDLE`

An observed object ID can exist before reconstruction. In that state, its type and content remain unknown. Metadata reported by a wallet or hint may help prioritize retrieval but cannot make the object verified.

The objects view keeps smart contracts in the normal object catalog. It groups a verified deployment, its WASM fragments, and executions into one smart-contract row for readability.

## Wallets

The Observer does not ask a wallet for its balance. It discovers public addresses in verified objects and builds a local economic projection.

A wallet becomes visible from exact public-address associations found in:

- Genesis allocations.
- Verified `WALLET_CREATION` objects.
- Verified accepted transactions.
- Signed route attribution evidence when the address acts as publisher or Keeper.

The wallet detail includes only exact associations. It does not infer a human identity, shared ownership, or control of another address.

### Native MYR balance

The displayed MYR balance is calculated from unspent native-asset outputs in the locally accepted ledger. Inputs are consumed in full and may return change, so received and spent totals use the net native change per accepted transaction rather than counting every consumed input as spending.

A balance can be unavailable when the Observer has not recovered the complete dependency chain needed to accept it. It is a local verified projection, not a query to a central account service.

### Custom tokens

Custom tokens are calculated separately. The Observer accepts a token only after verifying its `TOKEN_DEFINITION`, uniqueness constraints, issuer, supply policy, and the economic transactions that create or move its outputs. The native Genesis asset is excluded from the custom-token list, preventing token units from being mixed into the MYR balance.

## Transfers

The transfers view is built from verified `TX` objects with operation `TRANSFER` or `CONTRACT_FEE_WITHDRAWAL`, plus economically verified contract transfers produced by accepted execution outcomes.

For ordinary transfers, the Observer verifies the signed transaction details and reconstructs dependencies. A full accepted-ledger view additionally validates inputs, absence of double spend, value conservation, fees, and Unique Spend evidence.

Change outputs and alternate receipt sets for the same intent are not displayed as independent user transfers. Dates are observation dates unless the protocol object provides a separately verified event time.

## Tokens and assets

The assets catalog comes from the Observer's locally accepted economic ledger:

- Genesis defines the native MYR asset.
- Verified `TOKEN_DEFINITION` objects define custom asset name, symbol, decimals, issuer, supply policy, and fixed supply.
- Accepted unspent outputs determine observed supply and holder counts.
- Accepted account spends determine transfer counts.

Discovery hints alone never create a token balance or asset.

## Smart contracts

A smart contract first appears after the Observer verifies its deployment transaction. The deployment binds:

- `ContractID`
- creator/owner information present in the descriptor
- `WasmID`
- `RuntimeID`
- VM and ABI
- metering profile
- fee destination
- initial funding and upgrade policy

WASM code may arrive in multiple verified `CONTRACT_CODE` objects. The detail reports observed, verified, and expected fragment counts and marks the set complete only when the required fragments are present.

### JavaScript source

JavaScript is never reconstructed from WASM. The Observer shows source only after recovering a source package from one of these network paths:

1. A verified Collection Head containing `contracts/<ContractID>.cbor`.
2. An official carrier source index whose immutable package route matches the expected contract.

The package must bind the active `NetworkID`, deployment transaction, `ContractID`, `WasmID`, source hash, compiler, build profile, and optional contract name. Byte length and transport hash are checked before the source is exposed.

The Observer does not compile or execute source code during discovery, catalog reading, source display, or database projection.

### Executions and outputs

Contract activity comes from verified and economically accepted `INVOKE` or `INVOKE_SETTLE` transactions. The Observer links each result to its `ContractID`, invocation, sender, input, return value, status, reason, and certified transfer effects.

`INVOKE_COMMIT` is internal protocol evidence and is not presented as a separate user execution. A missing dependency or outcome leaves the execution unavailable rather than guessed.

### Contract balances and rewards

When the complete accepted economic projection is available, contract detail can show:

- Current reserve.
- Current fee balance available to the contract creator.
- Fee rewards already withdrawn.
- Amount transferred by successful contract effects.

Player losses or attached value are not counted as rewards. Reward figures remain unavailable when the Observer lacks the accepted dependency chain.

## Network fee estimates

Fee estimates are derived from the active Genesis fee schedule and the Observer's locally accepted economic ledger. They are not fees charged by the Observer and are not based on the number of propagated spores.

The source priority is:

1. Recent verified settlements after the minimum sample threshold.
2. Certified Keeper fee offers when settlement history is insufficient.
3. The Genesis bootstrap price when neither source is available.

The market window deduplicates spends and limits how many samples one payer or one participant set can contribute. It calculates P25, median, P75, and P90. The recommended price is P75. The automatic maximum is based on the greater protection supplied by P90 and the configured margin over P75. Per-operation quotes multiply the selected price by deterministic work units and enforce the Genesis absolute minimum.

The catalog exposes the source, sample counts, percentiles, work units, estimated fee, maximum fee, and asset decimals. The wallet performs the final calculation for the concrete transaction and asks the user to confirm the maximum before signing.

## Collections and catalogs

Collections and catalogs are learned from signed announcements, verified discovery cards, MetaSpore hints, or links in verified objects.

The Observer retrieves and verifies the Collection Head or Catalog, including its ID, publisher identity, network binding, signature, sequence/previous-head relationship, file descriptors, and referenced hashes. A catalog points to collections; a collection maps immutable artifacts and paths. Neither one executes contract code.

Directory contents and discovery capsules are generated only from locally verified catalog or collection state. A dead carrier route does not invalidate the signed identity of a previously verified head, but it can make its files unavailable until another replica is found.

## Routes and carriers

A route records where a target was announced or recovered. Its fields come from the canonical locator, target ID/type, discovery source, carrier class, first/last observation, independent read-back attempts, and signed attribution evidence.

Route processing has three separate decisions:

1. **Observed:** an announcement mentioned the locator.
2. **Admitted:** the URL and source passed the route safety policy.
3. **Verified available:** bounded retrieval returned bytes that verified for the target.

Carrier class is derived from the verified route schema and normalized locator, not from display text. Persistent storage routes are counted separately from temporary discovery transports.

The carrier catalog aggregates local route evidence by normalized origin and carrier class. It does not connect each dashboard visitor to carriers.

## Keepers and propagation evidence

A Keeper appears from verified propagation claims, publication attributions, or Keeper bindings.

- A propagation claim signs a specific spore and locator.
- A publication attribution binds a verified spore route to the publishing identity.
- A Keeper binding binds a collection namespace route to a Keeper identity.
- The reward destination is a separately bound public address when present.

The Observer verifies signatures, network binding, target, and canonical locator. It then performs its own route recovery check. A signed claim proves who declared the route; it does not by itself prove availability or create a reward. The current Observer records reward candidacy evidence but does not decide or pay rewards.

## Scouts and discovery claims

A Scout appears from a signed discovery claim. The claim identifies the Scout, target, locator, target type, and declared verification level. The Observer verifies the claim and independently processes the route. Scout identity is a protocol identity, not proof of one unique human.

## Social publications

A social publication is announced through MYRIA discovery and binds a supported social post ID and URL to a spore ID. The association is stored separately from ordinary HTTP routes.

The linked spore follows normal MYRIA verification. The external social host remains a presentation source, not protocol authority. Media retrieval is bounded, cached, rate limited, and performed asynchronously. A missing or deleted post removes it from the visible social wall without invalidating an independently recovered MYRIA spore.

The public card exposes the social handle but omits a display name. Opening the external post requires a separate user action in the dashboard.

## Health and recoverability

Spore health counts complete recoverable object copies, not announcement volume. A recovery set requires every distinct part of one manifest. Repeated URLs, repeated announcements, and incomplete fragment sets do not add copies.

Health combines:

- complete recoverable copies
- independent normalized origins
- carrier-class diversity
- recent successful verification

The resulting `CRITICAL`, `SCARCE`, `UNDER_REPLICATED`, `HEALTHY`, or `UNKNOWN` label is a local estimate. It is not a global availability guarantee.

## Graph

The graph is a derived visualization of verified and observed local relations: Genesis, spores, reconstructed objects, contract deployments, code fragments, executions, social publications, catalogs, collections, claims, and routes.

Genesis is the stable root when present. Large graphs keep Genesis and a bounded recent sample so the view shows origin and current progress without loading the full history. Graph edges do not create new protocol authority.

## Counters, timeline, and status

Overview counters are local database aggregates:

- observed and verified spores
- recently reachable spores
- observed objects and wallets
- observed and verified routes
- persistent attributed routes
- collections, catalogs, Keepers, and Scouts
- health counts
- worker queues and discovery-source status

Metrics are sampled into bounded time buckets. Timeline values are cumulative local counters, and activity is a retained event feed. None of these values claims to represent the entire MYRIA network.

## Database projections

MongoDB, PostgreSQL, MySQL, and MariaDB adapters receive bounded catalog pages after the engine has admitted and verified the underlying data. They are read models for applications and analytics. They do not replace the cryptographic store, fetch carriers, validate signatures, or execute contracts.

Every projected primary key includes `networkId`. Events and metrics can expire under retention policy; verified entities and projection checkpoints persist unless the operator explicitly resets the Genesis dataset.

## API mapping

| Public method | Primary provenance |
| --- | --- |
| `spores()`, `spore(id)` | Discovery frames, carrier recovery, manifest/object verification |
| `objects()`, `object(id)` | Reconstructed and verified canonical objects |
| `wallet(address)`, `walletGallery()` | Exact addresses in verified objects plus accepted local ledger |
| `transfers()`, `transactionGallery()` | Verified transaction objects and accepted economic outcomes |
| `assets()` | Genesis, token definitions, and accepted UTXOs |
| `contracts()`, `contract(id)` | Deployments, code fragments, source packages, accepted executions |
| `collections()`, `catalogs()` | Signed heads, manifests, announcements, and verified links |
| `routes(target)`, `carriers()` | Admitted locators and independent availability checks |
| `keepers()`, `keeper(id)` | Propagation claims, publication attribution, Keeper bindings |
| `scouts()`, `scout(id)` | Signed discovery claims |
| `socialMedia()` | MYRIA social-publication announcements plus bounded media cache |
| `scarce()` | Complete recovery sets and carrier/origin diversity |
| `graph()` | Derived local entity and relationship graph |
| `stats()`, `status()`, `timeline()` | Local counters, workers, transports, and retained metric samples |
