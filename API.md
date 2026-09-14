# API de MYRIA Observer

`createCommunityObserver()` no usa una API de otro Observer. El runtime recibe anuncios de discovery, recupera contenido desde los carriers indicados por la red y genera localmente los resultados que expone el cliente.

## Cliente

```js
const client = createMyriaObserverClient({url, timeoutMs?, fetch?, socketFactory?});
```

- `url` debe usar HTTPS. Se permite HTTP solamente para `localhost`, `127.0.0.1` y `::1`.
- `timeoutMs` admite entre 1 y 120 segundos.
- `fetch` y `socketFactory` permiten integrar runtimes controlados o pruebas.
- Las respuestas JSON mayores a 4 MiB se rechazan.

### Catálogo genérico

```js
await client.catalog({
  module: 'spores',
  params: {limit: 30, offset: 0, status: 'VERIFIED', type: 'TX'},
  live: false
});
```

Parámetros aceptados: `limit`, `offset`, `q`, `status`, `target`, `range`, `root`, `depth`, `nodes`, `type`, `health` y `address`. El servidor aplica sus propios límites y paginación.

| Módulo | Método | Detalle por ID | Live |
| --- | --- | --- | --- |
| `overview` | `overview()` | — | Sí |
| `stats` | `stats()` | — | Sí |
| `status` | `status()` | — | Sí |
| `assets` | `assets()` | — | No |
| `carriers` | `carriers()` | — | Sí |
| `activity` | `activity()` | — | Sí |
| `research` | `research()` | — | No |
| `live-spores` | `liveSpores()` | — | Sí |
| `timeline` | `timeline()` | — | Sí |
| `spores` | `spores()` | `spore(id)` | No |
| `transfers` | `transfers()` | — | Sí |
| `transaction-gallery` | `transactionGallery()` | — | Sí |
| `wallet-gallery` | `walletGallery()` | — | Sí |
| `social-media` | `socialMedia()` | — | Sí |
| `contracts` | `contracts()` | `contract(id)` | Sí |
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

Todos los métodos de listado aceptan un objeto con paginación y filtros, seguido opcionalmente por `{signal}`.

### Otras lecturas

- `health({signal?})`: estado del proceso, Genesis y workers.
- `discoveryCapsule({type, id, signal?})`: genera una cápsula importable para un catálogo o colección ya verificados.
- `socialMediaImageUrl(postId)`: construye la URL local y validada del medio cacheado por el Observer.
- `subscribe(request, listener, {onError?})`: recibe snapshot inicial y parches live.
- `close()`: cierra Socket.IO y todas las suscripciones del cliente.

## Runtime comunitario

```js
const observer = await createCommunityObserver(options);
```

Opciones:

| Campo | Descripción |
| --- | --- |
| `home` | Directorio exclusivo y persistente del Observer. Obligatorio. |
| `network` | Alias local. Por defecto `test-myria`. |
| `port` | Puerto loopback. `0` solicita uno libre al sistema. |
| `initializePublicNetwork` | Instala el bootstrap público si falta. Por defecto `true`. |
| `config` | Configuración acotada de verificación, transportes y retención. |
| `policy` | Política de lectura avanzada. |
| `multi` | Opciones avanzadas de transportes múltiples. |

La instancia devuelve:

- `networkId` y `url`.
- `status()` para métricas locales.
- `catalog(request)` para lecturas dentro del mismo proceso.
- `submit(candidate)` para integrar un transporte público adicional; el candidato pasa por la misma admisión y verificación.
- `close()` idempotente.

El runtime fija `mutateNetwork: false` y no incluye el dashboard. Por tanto, tampoco distribuye Spore Game.
