# Public interactive demo

The landing page, Skills and guides share the native React interface with fictional company records. Desktop visitors can use the embedded view. Phones get a full-page link to `/demo/?lang=en` or `/demo/?lang=ar`, without shrinking a desktop interface. The demo keeps the actual app's light appearance inside either website theme.

The demo supports searching, country tabs, list filters, sample history, outcome totals, explicit action selection, simulated progress, Stop and Reset. Application, career-profile and email outcomes remain separate. Connections, installation, imports, exports and scheduling belong to the local app and are unavailable in the demo.

## Isolation

- `src/main.jsx` exports the same `App` rendered by the local tracker.
- `vite.demo.config.mjs` replaces only `src/native-api.js` with `src/demo/api.js` at build time. The native build keeps its normal API transport.
- `src/demo/store.mjs` supplies a bounded in-memory API. It imports no server, database, provider, client credentials or Node modules. Unsupported operations throw rather than fall through to a real API.
- Demo records and view preferences live in memory. Reset clears both. The demo does not read or overwrite the native app's browser preferences or tracking store.
- HTTP headers allow same-site framing only for the public demo. The real tracker and API retain `frame-ancestors 'none'`.
- A Content Security Policy blocks network connections and form submission. The embedded page also has no popup, download, form or top-navigation sandbox permissions.
- All companies, job roles, receipts and outcomes are fictional and labelled. A simulated run never starts a native Run, launches an agent, connects a provider or sends/submits anything.
- The demo entry is `noindex` and stays out of the sitemap. The real bilingual landing, Skills and guide pages remain canonical.

## Build and review

`node website/build.mjs` builds the native demo into `site-dist/demo/` and the generated local preview under `public/demo/`. Vercel installs development and optional build dependencies explicitly because Vite needs its platform-specific compiler bindings. Install lifecycle scripts stay disabled. Generated demo bundles stay out of Git. `npm run build` still builds only the native tracker.

Run `node --test tests/public-demo.test.mjs tests/website-deployment.test.mjs` for data isolation, selected actions, stop/reset, separate outcomes and deployment parity. After building the website, run `npm run test:ui -- tests/public-demo-ui.spec.mjs` for English/Arabic, phone/desktop and both website color preferences. Browser tests reject external requests and `/api/` requests and check that the native browser preferences are untouched.

The deployment verifier checks the demo HTML and its exact generated JS/CSS before promotion, alongside the existing sitemap and shared brand assets. These are browser viewport checks; they are not a physical iPhone or Android test.
