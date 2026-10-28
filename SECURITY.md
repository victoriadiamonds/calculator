# Security and deployment

## Render configuration

- Use `npm ci` for builds and `npm start` for the service.
- Set `NODE_ENV=production` on the deployed service. Never deploy with `NODE_ENV=test`.
- Set `AIRWALLEX_CLIENT_ID`, `AIRWALLEX_API_KEY`, `AIRWALLEX_ENV`, and `AIRWALLEX_WEBHOOK_SECRET` through Render's environment settings. Never put credentials in the repository or browser assets.
- The webhook now returns 503 if its signing secret is missing and rejects invalid signatures. Configure the matching Airwallex webhook secret before deployment; do not disable verification to resolve failures.
- Only the calculator HTML, stylesheet, natural-diamond catalog, and selector script are publicly served. Backend code, archives, dependency manifests, tests, and local output are not public assets.
- CSP permits embedding by the Victoria Diamonds storefront domains. Add any future legitimate embedding origin explicitly in `server-security.js`.

## Request protections

- Payment-link requests are limited to 10 per IP per 15 minutes; other public requests to 300 per IP per minute. Webhooks and health probes are excluded from these limits.
- On Render, only the nearest proxy hop is trusted. Recheck proxy topology before using another host.
- Limits use a per-process memory store. Multiple service instances need a shared rate-limit store and/or edge protection for deployment-wide limits.
- Public checkout rejects client-supplied discounts, profit adjustments, and customization fees. These require a future authenticated staff workflow; a browser-supplied amount is not authorization.
- JSON bodies are limited to 32 KB; compressed request bodies are rejected.
- Receipt HTML escapes customer and product text, receipt responses are not cached, and new receipt identifiers use 128 bits of randomness. Receipt links remain bearer links: anyone with the full URL can read them.
- Mock receipt creation is available only with `NODE_ENV=test`.

## Verification and limits

Run `npm test` and `npm run audit:security` after dependency changes. HTTP security tests use loopback networking, no real payment credentials, and do not send email.

The October 29, 2026 patch resolved the nine reported npm dependency warnings. A clean dependency audit is not a guarantee against all vulnerabilities. Live Airwallex operations and Render deployment must be checked separately after release.

Orders are currently held in process memory. A restart loses receipt lookup and order state. Persistent order storage and reconciliation are still needed for durable payment records; this patch does not migrate order storage.
