# Persistencia del Observer

El motor conserva su store local de verificación. Las bases externas reciben una proyección asíncrona de los resultados admitidos por el Observer; no verifican firmas ni sustituyen el store criptográfico.

## Esquema propuesto

El prefijo predeterminado es `myria_observer`.

| Colección o tabla | Clave | Contenido | Retención |
| --- | --- | --- | --- |
| `myria_observer_entities` | `networkId + kind + entityId` | Esporas, objetos, contratos, colecciones, catálogos y claims | Persistente |
| `myria_observer_routes` | `networkId + routeId` | Carrier, destino, admisión, disponibilidad y fechas | Según la política del operador |
| `myria_observer_events` | `networkId + eventId` | Actividad reciente | 7 días por defecto |
| `myria_observer_metrics` | `networkId + timestamp` | Contadores agregados y estado de workers | 90 días por defecto |
| `myria_observer_checkpoints` | `networkId + name` | Progreso y resultado de la proyección | Persistente |

Todas las claves incluyen `networkId`, por lo que una nueva Genesis no puede mezclarse accidentalmente con la anterior. `observerDatabaseNames(prefix)` permite consultar los nombres antes de crear la base. El prefijo acepta únicamente letras minúsculas, números y `_`.

## MongoDB

```js
import {
  createCommunityObserver,
  createMyriaObserverClient,
  createMongoObserverDatabase,
  ObserverProjectionWorker,
} from '@myria-network/observer';

const observer=await createCommunityObserver({home:'./observer-data',port:0});
const client=createMyriaObserverClient({url:observer.url});
const database=await createMongoObserverDatabase({
  url:process.env.MONGODB_URI,
  database:'myria_observer',
});
const worker=new ObserverProjectionWorker({client,database,pageSize:100,intervalMs:15000});
await worker.start();
```

El conector crea índices únicos e índices temporales TTL para eventos y métricas. También se puede inyectar un `MongoClient` o un objeto `db` ya administrado por la aplicación.

## PostgreSQL

```js
const database=await createPostgresObserverDatabase({
  connectionString:process.env.DATABASE_URL,
  prefix:'myria_observer',
});
```

Usa `JSONB`, claves primarias compuestas, upserts parametrizados e índices por fecha. También acepta un `Pool` o cliente compatible mediante `client`.

## MySQL y MariaDB

```js
const mysql=await createMysqlObserverDatabase({url:process.env.DATABASE_URL});
const mariadb=await createMariaDbObserverDatabase({url:process.env.DATABASE_URL});
```

Ambos usan el protocolo de `mysql2`, tablas InnoDB administradas por el servidor, columnas `JSON`, upserts y consultas parametrizadas. MariaDB debe tener soporte para el tipo `JSON` o su alias compatible.

## Worker

`syncOnce()` proyecta solamente la página reciente de cada catálogo. `start()` la repite después de terminar la ejecución anterior, por lo que nunca superpone ciclos. `backfill({maxRecords})` recorre páginas del backend con un límite global explícito. Ningún método descarga un catálogo completo sin límite.

```js
await worker.initialize();
await worker.backfill({maxRecords:25_000});
await worker.start({immediate:false});

console.log(worker.status());

worker.stop();
await database.close();
client.close();
await observer.close();
```

Instala solamente el driver necesario:

```bash
npm install mongodb
npm install pg
npm install mysql2
```

Las credenciales permanecen en variables de entorno o en el gestor de secretos del operador. El SDK no las guarda, imprime ni incorpora al paquete.
