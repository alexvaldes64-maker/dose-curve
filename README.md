# Dose Curve

A private, offline Progressive Web App for logging medication doses and check-ins and seeing an estimated effect curve for the day. Light and dark card layout in the style of the Bevel health app. Today shows a ring with where you are right now, a chart of the whole day colored by phase (kicking in, peak, wearing off, fading, clear), the phases with their times, and an hour-by-hour timeline.

Estimates only, based on general averages. Not medical advice. Follow your prescriber's instructions.

Free and open source under the [MIT License](LICENSE). See the [privacy policy](PRIVACY.md), [terms of use](TERMS.md), [security policy](SECURITY.md), [contributing rules](CONTRIBUTING.md), [code of conduct](CODE_OF_CONDUCT.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

> **Disclaimer.** Dose Curve is a private log and visualizer. It is not a medical device, has not been evaluated or approved by the FDA or any other regulator, and is not medical advice. Do not use it to decide whether, when or how much to take of anything. The curves are estimates from general averages and can be wrong for you. Use it at your own risk; it is provided without warranty (see [LICENSE](LICENSE) and [TERMS.md](TERMS.md)).
>
> In an emergency in the US, call 911, Poison Control at 1-800-222-1222, or use webPOISONCONTROL at https://www.poison.org. For a mental health crisis, call or text 988. Outside the US, use your local emergency number.

- Vite + React + TypeScript + Tailwind CSS v4
- Dexie (IndexedDB) for storage. No backend, no accounts, no analytics. Nothing leaves the device.
- d3-shape for curve smoothing, drawn as plain SVG
- vite-plugin-pwa for the manifest, icons, and offline service worker
- System font (SF Pro on Apple devices). No web fonts or other third-party requests.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. In dev mode the bottom of the Today screen has an **Add sample dose at 9:30a (dev)** link. It adds one flagged sample dose so you can preview the curve, and tapping it again removes it. Real doses are never touched. It does not appear in production builds.

## Test

```bash
npm test
```

All model math is in `src/lib/model.ts`, tested in `src/lib/model.test.ts`.

## Build and preview

```bash
npm run build
npm run preview
```

`dist/` is a fully static site with `sw.js` and `manifest.webmanifest`.

To regenerate the PNG icons after editing `public/favicon.svg`, run `npm run icons`.

## Deploy to Vercel

Either:

1. In Vercel choose **Add New > Project**, import `alexvaldes64-maker/dose-curve`, and keep the detected settings (Framework: Vite, Build: `npm run build`, Output: `dist`). Vercel's `VERCEL_GIT_COMMIT_SHA` makes the app show the exact commit it was built from in Learn > Check privacy.

or, from this folder:

```bash
npx vercel --prod
```

`vercel.json` adds an SPA rewrite and makes sure `sw.js` is never cached, so updates arrive promptly.

## Add to Home Screen (iPhone)

1. Open your deployed URL in **Safari** (it must be HTTPS).
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Launch Dose Curve from the home screen icon. It runs full screen and works offline.

Data lives in that home screen app's own storage on that device. It is not shared with Safari or other devices, and deleting the app deletes the data. Use **Learn > Export JSON** for backups and **Import JSON** to restore.

## Substances and presets

Log any of these, each with its own color, curve and phases. Presets fill in half-life, absorption speed and release shape (adjustable in Learn > Presets):

| Preset | Formulations | Half-life | Shape |
| --- | --- | --- | --- |
| Adderall | IR, XR | 11 h | IR single; XR two pulses, half now and half 4 h later |
| Vyvanse | Capsule | 12 h | Single, slower absorption |
| Ritalin / Concerta | IR, ER | 2.1 h / 3.5 h | IR single; ER 22% now, the rest over 10 h |
| Focalin | IR, XR | 2.2 h / 3 h | IR single; XR two pulses, peaks near 1.5 h and 6.5 h |
| Dexedrine | IR, Spansule | 12 h | IR single; Spansule fitted to the label's 8 h peak |
| Mydayis | Capsule | 11 h | Fitted to the label's 8 h peak |
| Caffeine | Drink | 5 h | Single, fast absorption, no acute tolerance |

Each substance is scaled to its own reference dose (100%) and drawn as its own line. They are never added together. Learn also has a sourced "What not to mix" list (NIAAA, CDC, FDA labels via DailyMed, MedlinePlus).

## Profiles, fills, schedules and summaries

- **First run:** four short screens. The only required one is the acknowledgement (estimates only, not medical advice, 18+ or a parent, emergency numbers). If TERMS_VERSION in `src/db.ts` changes, only that screen shows again. Learn > About can replay the welcome.
- **Reminders:** Learn > Reminders creates a calendar file (.ics) with daily reminders at times you choose. Your calendar does the reminding, so it works offline with no server.
- **Already logged notice:** logging the same medication within 3 hours of another entry shows the earlier one before you save, so duplicates are easy to spot.
- **Your logged wear-off:** after 3 days of tapping "It wore off", the Phases card shows your typical logged wear-off time next to the general estimate.
- **Backup reminder:** after a week of data, Today suggests exporting a backup every 30 days (dismissable).
- **"Did I take it?":** Today's first line shows the last logged dose and how long ago, or that a dose was skipped.
- **Skipped or paused:** log a day you did not take a medication, with a reason (planned break, forgot, could not get a refill, side effects, prescriber paused it, other). It appears in the prescriber summary and CSV.
- **Undo:** every log offers Undo for 8 seconds.
- **Already logged:** once-a-day medications (XR, Vyvanse, Concerta style ER, Spansule, Mydayis) check the whole day; others check 3 hours either side.
- **Days of supply:** add a count to a fill and Log shows about how many are left and, after 3 days of doses, about how many days at your logged pace, with a one-tap refill reminder for your calendar.

- **Profiles:** tap the avatar on Today to add a person (for example a child). Each profile has its own doses, check-ins, fills, usual sleep window and timing settings. Child profiles add an appetite rating.
- **Finer doses:** strength chips come from each FDA label. Scored tablets can be logged as ½ or ¼. Tap the amount to type an exact value (0.25 mg steps).
- **Personal timing:** Learn > Presets, or "Adjust timing" under the chart. Caffeine has Fast, Typical and Slow choices.
- **Sleep window:** tap the times under "Today" to change one day's wake and sleep (night shifts can run past midnight) and save presets.
- **Fills:** Log > Fills records the manufacturer and pharmacy of each refill. History > Compare fills compares two fills using only what you logged (wore-off times, ratings, side effects), once each has 5 days.
- **Prescriber summary:** History > Summary for your prescriber. Print or save as PDF, or download CSV.

## Privacy checks

- `npm run build` fails if shipped app code contains network APIs (`fetch`, XHR, beacons, WebSockets) or if the Content Security Policy is missing. The CSP's `connect-src 'self'` makes the browser refuse any request to another server.
- `src/copy.test.ts` fails if any source file contains dosing or timing advice phrasing, or em dashes.
- Learn > Check privacy shows every request the page has made, whether the browser is blocking outside connections, where data is stored, and the build version. It also has Delete all data.

## How the curve is computed

- **Simple model (default):** a fixed effect shape per dose (monotone cubic through set points, peaking at 2.5h, gone by 8h), scaled by mg / reference mg, summed across doses.
- **Tolerance-adjusted model:** one-compartment oral absorption model per dose (half-life, absorption rate ka), summed across doses including the previous day, normalized so a single reference dose peaks at 100, then multiplied by an acute tolerance factor `exp(-rate * hours since first dose today)` that resets at wake time. The raw blood level estimate is drawn as a dashed line.
- **Phases** (Onset, Peak, Taper, Comedown, Clear) are derived from the day's curve relative to its own max.
- The gray band shows the same curve 45 minutes earlier and later.

## Project layout

```
src/lib/model.ts       effect models, phases (pure math)
src/lib/time.ts        day window and time formatting
src/db.ts              Dexie schema, settings, export/import
src/hooks/             useDayModel, useNow, useWidth
src/components/        Timeline, Curve, NowLine, PhasePill, EventCard, TabBar, DayView, forms, sheets
src/screens/           Today, Log, History, Learn
mockups/               the three design directions, at /mockups/index.html in dev
```

Design guidance comes from Anthropic's frontend-design skill in `.claude/skills/frontend-design/`.
