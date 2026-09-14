# Observer persistence

The engine retains its own cryptographic verification store. External databases receive an asynchronous projection of results admitted by the Observer; they do not verify signatures and never replace that authoritative local store.

## Proposed schema

The default prefix is `myria_observer`.

| Collection or table | Key | Content | Retention |
| --- | --- | --- | --- |
| `myria_observer_entities` | `networkId + kind + entityId` | Spores, objects, contracts, collections, catalogs, and claims | Persistent |
| `myria_observer_routes` | `networkId + routeId` | Carrier, locator, admission, availability, and timestamps | Operator policy |
| `myria_observer_events` | `networkId + eventId` | Recent activity | 7 days by default |
| `myria_observer_metrics` | `networkId + timestamp` | Aggregated counters and worker status | 90 days by default |
| `myria_observer_checkpoints` | `networkId + name` | Projection progress and outcome | Persistent |

Every key includes `networkId`, preventing data from different Genesis networks from being mixed accidentally. `observerDatabaseNames(prefix)` returns the names before creating the database. Prefixes accept lowercase letters, numbers, and `_` only.

## MongoDB

```js
import {
  createCommunityObserver,
  createMyriaObserverClient,
  createMongoObserverDatabase,
  ObserverProjectionWorker,
} from '@myria-network/observer';

const observer = await createCommunityObserver({
  home: './observer-data',
  port: 0,
  engine,
});
const client = createMyriaObserverClient({url: observer.url});
const database = await createMongoObserverDatabase({
  url: process.env.MONGODB_URI,
  database: 'myria_observer',
});
const worker = new ObserverProjectionWorker({
  client,
  database,
  pageSize: 100,
  intervalMs: 15000,
});
await worker.start();
```

The connector creates unique indexes and TTL indexes for events and metrics. Applications may instead inject an already-managed `MongoClient` or `db` object.

## PostgreSQL

```js
const database = await createPostgresObserverDatabase({
  connectionString: process.env.DATABASE_URL,
  prefix: 'myria_observer',
});
```

The adapter uses `JSONB`, composite primary keys, parameterized upserts, and timestamp indexes. It also accepts a compatible `Pool` or client through `client`.

## MySQL and MariaDB

```js
const mysql = await createMysqlObserverDatabase({url: process.env.DATABASE_URL});
const mariadb = await createMariaDbObserverDatabase({url: process.env.DATABASE_URL});
```

Both adapters use the `mysql2` protocol, server-managed InnoDB tables, `JSON` columns, parameterized queries, and upserts. MariaDB must support the `JSON` type or its compatible alias.

## Projection worker

`syncOnce()` projects only the most recent page of every catalog. `start()` schedules another pass only after the previous one finishes, so cycles never overlap. `backfill({maxRecords})` walks backend pages under an explicit global limit. No method downloads an unlimited catalog.

```js
await worker.initialize();
await worker.backfill({maxRecords: 25_000});
await worker.start({immediate: false});

console.log(worker.status());

worker.stop();
await database.close();
client.close();
await observer.close();
```

Install only the database driver you need:

```bash
npm install mongodb
npm install pg
npm install mysql2
```

Keep credentials in environment variables or the operator's secret manager. The SDK does not store, print, or package them.
