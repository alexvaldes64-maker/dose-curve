# Contributing

Thanks for helping. Dose Curve has a few rules that are not negotiable, because people use it to understand their medication.

## The three rules

1. **Describe, never prescribe.** The app shows what was logged and what a population-average model estimates. It must never suggest an amount, a next dose, a time to take something, a "safe" level, or how much more someone can have, for any substance, caffeine included. `src/copy.test.ts` checks for banned phrasing; do not remove phrases from it to make a test pass.
2. **Nothing leaves the device.** No accounts, analytics, crash reporting, ads, remote fonts or third-party scripts, and no network calls from app code. `npm run build` runs `scripts/check-privacy.mjs` and fails if one appears, and the Content Security Policy blocks them in the browser.
3. **Every number has a source.** Half-lives, absorption, strengths, release shapes and interaction text must come from an FDA label (DailyMed), a government health source, or peer-reviewed research, linked in `src/lib/substances.ts`. No values from memory, forums or AI output.

## Practical bits

- `npm install`, then `npm run dev`. Run `npm test` and `npm run build` before opening a pull request.
- Keep the app simple. New features should help someone understand their own day, not add settings for their own sake. Open an issue to discuss anything bigger than a fix.
- UI copy: plain language, sentence case, no em dashes.
- Data changes need a Dexie version bump with a migration and a test in `src/db.test.ts`, and backups must keep importing.
- By contributing you agree your work is released under the MIT License.

## Code of conduct

Be kind. See CODE_OF_CONDUCT.md.
