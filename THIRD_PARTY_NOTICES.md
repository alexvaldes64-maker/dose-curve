# Third-party notices

The Dose Curve app bundles the following open-source libraries. Each keeps its own license and copyright.

| Library | License | Source |
| --- | --- | --- |
| React, React DOM, Scheduler | MIT | https://github.com/facebook/react |
| Dexie.js, dexie-react-hooks | Apache-2.0 | https://github.com/dexie/Dexie.js |
| d3-shape, d3-path | ISC | https://github.com/d3/d3-shape |
| Workbox (service worker, workbox-window) | MIT | https://github.com/GoogleChrome/workbox |

Build and test tools (Vite, TypeScript, Tailwind CSS, vite-plugin-pwa, Vitest, sharp, fake-indexeddb) are used only to build and test the app and are not shipped in it. Their licenses are listed in each package under `node_modules` after `npm install`.

Drug timing values come from public FDA labels (DailyMed) and the other sources linked in the app. Interaction text is written in our own words with links to its sources. Adderall, Vyvanse, Ritalin and Concerta are trademarks of their respective owners; Dose Curve is not affiliated with or endorsed by them.
