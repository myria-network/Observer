# Security guidance for Observer operators

An Observer is a local reader and auditor. Its results describe what that instance discovered and verified; they are neither a global network count nor a new source of authority.

## Data and keys

- Use an exclusive home for each Genesis.
- Never place seeds, passwords, private keys, or cloud credentials in the home, printed environment, configuration, or logs.
- The community runtime installs public evidence and never creates a wallet.
- Never mount the administrative Genesis home in the public process.

## Network exposure

- The server listens on loopback. Publish it through Nginx, Caddy, or an HTTPS load balancer.
- Preserve request-body limits, timeouts, WebSocket connection limits, and rate limits.
- Do not enable global CORS. Browser applications should use the same origin or a controlled backend/reverse proxy.
- Never turn anonymized locators into fetch destinations. Verification uses only internally admitted routes.

## Untrusted content

- Discovery announcements, hints, names, metadata, images, JavaScript, and URLs remain untrusted until they pass their applicable verification.
- The Observer verifies frames, spores, manifests, objects, signatures, hashes, `NetworkID`, and available economic links.
- The Observer neither executes nor compiles discovered contracts.
- Contract source is displayed only after it is linked to a verified deployment. Source code is never reconstructed from WASM.

## Resource controls

- Keep pagination in the backend; never load complete catalogs into a browser client.
- Configure retention for events, routes, social media, and unverified evidence.
- Separate verification, maintenance, and media-retrieval workers.
- Monitor `status().budgets`, storage, queues, and worker failures.

## Reporting a vulnerability

Do not open a public issue for an unpatched vulnerability. Contact the maintainers privately and include the affected version, reproduction steps, impact, and any proposed mitigation.
