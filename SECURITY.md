# Seguridad para operadores de Observer

Un Observer es un lector y auditor local. Sus resultados expresan lo que esa instancia descubrió y verificó; no constituyen un recuento global ni una nueva autoridad de red.

## Datos y llaves

- Usa un home exclusivo para cada Genesis.
- No coloques semillas, contraseñas, llaves privadas o credenciales cloud en el home, variables impresas, configuración o logs.
- El runtime comunitario instala evidencia pública y nunca crea una wallet.
- No montes el home administrativo de Genesis dentro del proceso público.

## Exposición de red

- El servidor escucha en loopback. Publica con Nginx, Caddy o un balanceador HTTPS.
- Conserva límites de body, timeouts, conexiones WebSocket y rate limits.
- No abras CORS global. En navegador, consume desde el mismo origen o mediante un backend/reverse proxy controlado.
- No conviertas locators anonimizados en destinos de fetch. La verificación usa rutas admitidas internamente.

## Contenido no confiable

- Discovery, hints, nombres, metadatos, imágenes, JavaScript y URLs son entradas no confiables hasta superar su verificación correspondiente.
- El Observer verifica frames, esporas, manifests, objetos, firmas, hashes, NetworkID y vínculos económicos disponibles.
- El Observer no ejecuta ni compila contratos descubiertos.
- El paquete fuente de un contrato se muestra solo después de vincularlo con un despliegue verificado. No se reconstruye código desde WASM.

## Recursos

- Mantén paginación del backend; no cargues catálogos completos en memoria del cliente.
- Configura retención para eventos, rutas, medios sociales y evidencia no verificada.
- Separa workers de verificación, mantenimiento y recuperación de medios.
- Revisa `status().budgets`, almacenamiento, colas y errores de workers.
