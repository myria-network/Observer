# MYRIA Observer SDK

Biblioteca JavaScript para ejecutar un Observer comunitario autónomo de solo lectura y consumir todas sus vistas mediante una única API de catálogos. El paquete no contiene llaves privadas, credenciales de AWS, datos de wallets ni Spore Game.

El nodo no consulta otro Observer. Escucha directamente los transportes de discovery habilitados, admite anuncios con límites locales, recupera las esporas desde los carriers anunciados, verifica su evidencia y construye su propia base de datos. Sus contratos, catálogos, colecciones, rutas y métricas representan únicamente lo observado por esa instancia.

```text
Nostr / Waku / Iroh / P2P / DHT / Hyperswarm
                       ↓ anuncios
             Observer comunitario
                       ↓ recuperación
             Carriers descubiertos
                       ↓ verificación
        Base local + API HTTP/WebSocket
                       ↓
          React / Next / Vue / Svelte
```

## Estado del repositorio

Este repositorio distribuye el SDK público: cliente HTTP/WebSocket, catálogo tipado, adaptadores de persistencia y el punto de integración del runtime. No incluye el dashboard ni llaves privadas.

El cliente y los adaptadores funcionan de forma independiente. `createCommunityObserver()` necesita además un motor MYRIA compatible que implemente la verificación y los transportes. Mientras ese motor no se publique en npm, se inyecta explícitamente mediante la opción `engine`; el SDK nunca usa `observer.myria.network` como fuente de datos.

## Instalación

```bash
npm install github:myria-network/Observer
```

Requiere Node.js 24.14.0. Cuando el motor público esté disponible, podrá instalarse junto con el SDK. Hasta entonces, `createMyriaObserverClient()` y los conectores de base de datos están disponibles directamente, y el arranque completo acepta un adaptador `engine` verificado.

## Levantar un Observer comunitario

```js
import {createCommunityObserver} from '@myria-network/observer';

const observer = await createCommunityObserver({
  home: './myria-observer-data',
  port: 4318,
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

El arranque instala únicamente el bootstrap público incluido en `test-myria`, abre stores separados para esa Genesis, inicia discovery y sirve la API en loopback. No crea wallets ni identidades de Keeper o Scout. Para exponerlo en Internet se debe usar un reverse proxy HTTPS que conserve los límites del servidor.

## Consumir un Observer

```js
import {createMyriaObserverClient} from '@myria-network/observer';

const node = await createCommunityObserver({
  home: './myria-observer-data',
  port: 0
});

const myria = createMyriaObserverClient({url: node.url});

const health = await myria.health();
const spores = await myria.spores({limit: 20, offset: 0});
const contracts = await myria.contracts({limit: 20, offset: 0});

console.log(health.networkId, spores.total, contracts.items);

myria.close();
await node.close();
```

Este ejemplo consume la API generada por el mismo nodo. No depende de un Observer central.

## Uso con frameworks

El proceso completo requiere Node.js, almacenamiento persistente y conexiones de discovery de larga duración. Puede acompañar cualquier frontend, pero no se ejecuta dentro del navegador. En React, Vue o Svelte se usa `createMyriaObserverClient` contra la API del Observer administrado por esa comunidad. En Next.js se puede ejecutar el nodo en un servicio Node persistente; no debe iniciarse por request ni dentro de una función serverless.

Todas las lecturas pasan por `POST /observer/catalog`. Los nombres de los módulos, parámetros y capacidades live están en `OBSERVER_CATALOG`; la aplicación no necesita construir una URL distinta por vista.

```js
import {OBSERVER_CATALOG} from '@myria-network/observer';

console.table(OBSERVER_CATALOG);
```

## Actualizaciones live

```js
const subscription = myria.subscribe(
  {module: 'overview', params: {range: 60}},
  (overview, update) => console.log(update.revision, overview.stats),
  {onError: console.error}
);

// Cuando la vista deja de usarse:
subscription.close();
myria.close();
```

El cliente mantiene un solo Socket.IO por instancia, valida revisiones y parches, solicita un snapshot nuevo cuando detecta una discontinuidad y elimina la conexión al cerrar la última suscripción.

## JavaScript de contratos

`myria.contract(contractId)` devuelve la fuente solamente cuando el Observer recuperó un paquete publicado y verificó su `NetworkID`, `ContractID`, transacción de despliegue, `WasmID`, hash de fuente y firmas. El Observer no compila ni ejecuta ese JavaScript. Una reproducción de WASM, si se necesita para una auditoría, es una operación independiente del motor de una wallet o herramienta especializada.

Consulta [API.md](./API.md) para todos los métodos y [SECURITY.md](./SECURITY.md) antes de publicar una instancia.

Para proyectar los resultados en MongoDB, PostgreSQL, MySQL o MariaDB consulta [DATABASES.md](./DATABASES.md). Los conectores crean un esquema común e índices y trabajan mediante un worker asíncrono acotado.
