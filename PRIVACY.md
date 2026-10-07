# Privacy policy

Last updated: October 6, 2026

Dose Curve is built so that your health information never leaves your device. This page explains exactly what that means. You can check every claim here in the source code in this repository.

## What we collect

Nothing. The developer of Dose Curve never receives your doses, check-ins, profiles, fills, schedules, settings or any other information you enter.

## Where your data is stored

Everything you enter is saved in your browser's storage (IndexedDB) on your device, and nowhere else. There are no accounts, no cloud sync, no analytics, no crash reporting, no advertising and no third-party scripts or fonts.

## How this is enforced

- The app ships with a Content Security Policy that includes `connect-src 'self'`. Your browser refuses any request from the app to another server.
- The build fails if the app's code contains network APIs (`fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` and similar). See `scripts/check-privacy.mjs`.
- In the app, Learn > Check privacy lists every request the page has made, so you can see they all go to the app's own address.

## What the host can see

The app is served as a static website. Like any website, the hosting provider (for example Vercel) receives standard request information when your browser downloads the app's files, such as your IP address, the time and your browser type. This does not include anything you enter in the app. After the first load, the app can run offline from your device.

## Sharing

The app never shares anything. If you export a backup, a CSV or a printed summary, the file is created on your device and goes only where you choose to send it.

## Links

Learn contains links to sources such as FDA labels on DailyMed, NIAAA, CDC and MedlinePlus. Opening a link takes you to that site, which has its own privacy policy. The app sends nothing to those sites.

## Deleting your data

Learn > Check privacy > Delete all data removes everything from your device. Removing the app or clearing your browser's site data also deletes it. There is no copy anywhere else, so it cannot be recovered unless you exported a backup.

## Children

Dose Curve can hold a profile that a parent logs for a child. That information stays on the parent's device like everything else, and the developer never receives it.

## Changes

Changes to this policy are made in this repository, so the full history is public.
