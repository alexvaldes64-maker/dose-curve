# Dose Curve: next features plan

Six requested features, a privacy proof, and a legal guardrail.

**Decisions (October 6, 2026):**
- **Repo:** public GitHub repo for verifiable privacy.
- **Summary:** print page plus CSV, with no PDF library.
- **Order:** build in the phase order below.

**Status (October 6, 2026):** phases 0 to 5 are built and tested (64 tests). Phase 6: the public repo, MIT license, privacy policy and terms are in place. No legal review has happened; the open questions are in `docs/legal-review.md`.

Each section covers what exists today, the design, data changes, edge cases, and how to test it. The phases at the end set the build order.

## Ground rules for every feature

- **Describe, never prescribe.** Nothing computes or suggests an amount, a next dose, a "safe" time, or "how much more" for any substance, caffeine included. Screens show what was logged and what the model estimates is still active. That's all.
- **Modeled vs observed stays explicit.** The curve is a population-average estimate. Anything that looks like personal insight (comparing fills, wear-off times) must come from what the user logged, never from the model.
- **Everything stays on the device.** No feature may add a network call, an account or analytics. This gets enforced in code (see Privacy proof).

## Data model (one migration, Dexie v3)

All new features hang off one schema bump, so it ships first.

| Table | New or changed fields | Purpose |
| --- | --- | --- |
| `profiles` (new) | `id, name, color, kind: 'self' \| 'child', wakeTime, sleepTime, overrides, createdAt` | Multiple people. Each profile gets its own default sleep window and its own half-life overrides. |
| `doses` | `+ profileId, + fillId?` (index `profileId, takenAt`) | Which person took it, and from which fill. |
| `checkins` | `+ profileId, + kind: 'rating' \| 'wore_off' \| 'side_effect'`, `+ tags?` | Adds one-tap "felt it wear off" and side-effect notes, which observed comparisons need. |
| `fills` (new) | `id, profileId, substance, formulation, strengthMg, manufacturer, pharmacy?, filledAt, note?` | Which generic or pharmacy fill. |
| `schedules` (new) | `id, profileId, date, wake, sleep` | Sleep window overrides for a specific day (shift workers). |
| `settings` | `+ activeProfileId`; `wakeTime/bedtime/overrides` move to the profile | Global settings keep only the model choice, tolerance rate and the active profile. |

**Migration.** Create a "Me" profile from the current settings (wake, bed, overrides). Set `profileId` on every existing dose and check-in, and `kind: 'rating'` on every check-in. Bump the backup format to v2. Import still accepts v1 files and maps them to the "Me" profile.

**Tests.**
- Migrating a v2 database keeps every dose and check-in and links them to "Me".
- A v1 backup imports correctly.
- A v2 backup round-trips (export, then import, gives the same data).

## 1. Finer dose amounts and split pills

**Today.** Adderall already steps by 2.5 mg. Vyvanse steps by 10, Ritalin by 5, and the smallest amount you can enter equals the step, so a quarter tablet can't be logged. Concerta-style ER amounts (18, 27, 36, 54) don't match a 5 mg step.

**Design.**
- **Type an exact amount:** tap the big number to type it. Allow 0.25 mg precision and validate the range (more than 0, up to the substance's max).
- **Strength chips:** add a row per formulation for the common tablet and capsule strengths. Selecting one sets the amount, and a **½** and **¼** toggle splits it ("10 mg tablet, half: 5 mg"). Strengths go in `substances.ts` with a source link per formulation. Each list must be checked against the FDA label before shipping, not written from memory.
- **Steppers:** use 1.25 mg steps for Adderall, 5 for Vyvanse, 2.5 for Ritalin, and 9 for ER (matching its strengths).
- **Saved data:** keep storing the amount actually taken in `mg`, plus an optional `split: 0.5 | 0.25` so the log can say "½ of 10 mg".
- **Scope:** the curve math already scales linearly with the amount, so no model change is needed.

**Tests.**
- Typed amounts round to 0.25.
- Splitting a strength sets the right amount.
- A dose of 0 or a negative amount is rejected.
- Legacy doses without `split` display unchanged.

## 2. Your own half-life (caffeine metabolism)

**Today.** Learn > Presets already lets you edit half-life and absorption per substance and formulation. But it's buried, it's global rather than per person, and it uses raw numbers.

**Design.**
- **Overrides move onto the profile,** so a parent and a child can have different values.
- **Caffeine gets a metabolism choice:** Fast (about 3 h), Typical (5 h), Slow (about 8 h), or Custom. Below it goes a sourced note that half-life varies widely (cited range 1.5 to 9.5 h), with factors the reference names, such as pregnancy, oral contraceptives and smoking. The note only describes. It never says which option to pick.
- **Medications keep a numeric Custom field.** Default to the preset, add "Reset to preset", and show "from label" next to the default.
- **Discoverability:** add an "Adjust timing" link under each substance in the Effect chart legend that opens this setting.
- **Later, not now:** personal calibration from logged "wore off" times. It's attractive, but it turns logs into a personalized model, which is a bigger regulatory step. Park it until the legal review is done.

**Tests.**
- Picking Slow (8 h) raises the caffeine level at bedtime compared with Typical.
- Overrides are scoped per profile.
- Reset restores the preset.

## 3. Record the generic or pharmacy fill, and compare

**Design.**
- **Fills:** a "Fills" list per profile (Log > Fills), where each fill records substance, formulation, strength, manufacturer (free text plus recently used suggestions), pharmacy (optional), fill date and a note.
- **Auto-linking:** when you log a dose, it attaches to the most recent fill for the same substance and formulation that was filled on or before the dose date. You can change it in the dose sheet.
- **Wore-off check-in:** add a one-tap "It wore off" button on Today, next to the + button. It saves a `wore_off` check-in at the current time, and the time can be edited.
- **Compare (History > Compare fills):** pick two fills, and the screen shows only observed data, with how many days each comparison is based on:
  - median "wore off" time, measured as hours after the first dose of the day;
  - average focus and mood ratings, grouped by hours since the dose (0 to 2, 2 to 4, 4 to 6, 6 to 8, 8+);
  - how often side-effect tags were logged.
- **Fewer than 5 days of data:** show "Not enough data yet" instead of numbers.
- **The model curve is not compared,** since it's identical for both fills by definition. Copy states plainly: "The estimated curve is the same for every fill. This compares what you logged."
- **Context:** link the 2014 FDA Concerta generics note as background on why fills can differ. Never conclude that a fill is worse.

**Edge cases.**
- Several doses in a day: "hours since" counts from the first dose of that substance that day.
- Days on a mix of fills are excluded.
- Fills belonging to other profiles never show.

**Tests.** Auto-link picks the right fill; mixed-fill days are excluded; the median and the bucket averages are computed correctly; below 5 days the screen shows the empty state.

## 4. Profiles (a parent tracking a child)

**Design.**
- **Switching:** a profile switcher in the Today header (avatar chip). Each profile has its own doses, check-ins, fills, schedule and overrides.
- **Child profiles** default to these check-in fields: focus, mood, appetite (1 to 5) and bedtime (actual). Rated by the parent, labeled "as observed by you".
- **Child dose ranges:** no child-specific limits or dose ranges are ever shown.
- **Learn:** shows one line saying the presets use adult averages and children's timing can differ. No numbers for children.
- **Backup:** export can cover all profiles or one profile, and import keeps the profile mapping.
- **Not doing:** separate passcodes per profile. A web app can't secure that properly, so it isn't offered as a security feature (see App lock under Privacy proof).

**Edge cases.** Deleting a profile requires typing its name and deletes its data. At least one profile always exists. All switching happens on the device.

**Tests.** Today, History and Log are scoped to the active profile; switching profiles rescopes them; export of a single profile includes only that profile's rows.

## 5. Custom sleep window (shift workers)

**Today.** One global wake time and bedtime. A window that crosses midnight works, but every day is assumed the same.

**Design.**
- **Defaults:** each profile has a default wake and sleep time.
- **Per-day override:** a "Today's schedule" sheet sets wake and sleep for a single day, with presets the user saves (for example "Night shift 7p to 8a").
- **Which day is "now":** pick the most recent window whose start is at or before now. Night shift windows that cross midnight then belong to the day the shift started.
- **Labels:** History labels each day by the date its window starts.
- **Bedtime card:** renamed "At sleep", and uses that day's sleep time.
- **Overlaps:** when one day's window overlaps the next (for example a 6p to 10a shift followed by a 4p wake), each day's window is cut off where the next one starts.

**Tests.** Overnight windows; switching from day to night shift; the overlap cut; the DST-change night; History shows the override day correctly.

## 6. Summary for your prescriber

**Design.** Learn (or History) > "Summary for your prescriber" opens a printable page:
- **Range and scope:** last 7, 14 or 30 days, for one profile.
- **Contents:**
  - per substance: a dose table (date, time, amount, formulation, fill or manufacturer);
  - days with a dose;
  - typical first-dose time;
  - observed "wore off" median;
  - average focus and mood by time of day and by phase at check-in time;
  - side-effect tags with counts;
  - notes;
  - fill switches with dates.
- **Charts:** a small chart of each day's estimated curve, as an SVG strip.
- **Header:** "Estimates are based on general averages. Logged values are self-reported."
- **No recommendations or interpretation.** Statements are descriptive only, for example "Wore off logged on 9 of 14 days, median 5.1 h after first dose".
- **Output:**
  - A print stylesheet plus `window.print()`, which is "Save as PDF" on iOS and desktop. No PDF library, fully offline.
  - CSV export of doses and check-ins for the same range.
- **Sharing:** the user shares the file themselves. The app never sends it.

**Tests.** Summary math (medians, averages) is unit-tested with fixture data. A print snapshot of the layout is checked at A4 and Letter.

## Privacy proof (make "no data leaves the device" checkable)

1. **Content Security Policy** in `vercel.json` headers, plus a `<meta>` fallback: `default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`. The browser itself then blocks any request to another server, including one a future dependency might try to make. Outbound source links still work, because those are navigations, not requests.
2. **Test enforcement:**
   - A test fails the build if the bundle contains `fetch(`, `XMLHttpRequest`, `sendBeacon` or `WebSocket`, outside an allowlisted vendor list (vite-plugin-pwa's registration code needs a review).
   - An end-to-end check loads every tab and confirms that every request goes to the app's own server.
3. **"Check privacy" screen in Learn:**
   - a live list of every request this session (from the Performance API), showing they all go to this site;
   - where data is stored;
   - whether the browser has granted persistent storage;
   - the app version and build hash;
   - **Delete all data** (type DELETE to confirm).
4. **Open source:** a public GitHub repo, with Vercel deploying from it and the commit hash shown in the app. Anyone can check the code against the running app.
5. **Optional encrypted backups:** a passphrase-protected export (AES-GCM via the browser's built-in crypto). The passphrase is never stored.
6. **Honest privacy page:**
   - Vercel's hosting logs record IP addresses when the app loads.
   - Data is local, so losing the phone or clearing browser data loses it.
   - There is no app-level encryption at rest. A PWA can't guarantee it, so the page doesn't claim it.

## Legal guardrail

- **Copy lint test:** every UI string and `substances.ts` is scanned for banned phrasing, including "take more", "next dose", "safe to take", "you can take", "how much more", "should take", "redose" and "booster". The test fails on any match.
- **Feature rule, written into this doc and enforced in review:** no remaining-allowance calculations (including caffeine "how much more before bed"), no timing suggestions, no dose suggestions for children.
- **Lawyer review packet before launch:**
  - FDA General Wellness and CDS guidance (January 2026): whether estimating drug levels for consumers counts as enforcement discretion.
  - FTC Health Breach Notification Rule: likely not triggered, since the app collects nothing, but confirm.
  - Washington My Health My Data Act and similar state laws: confirm they don't apply when nothing is collected.
  - Apple App Store guidelines 1.4.1 and 1.4.2, if a native wrapper ever ships.
  - The exact wording of the disclaimers.
- **Licenses:** don't use TripSit's interaction data (non-commercial license). Keep citing primary sources (FDA labels, NIAAA, CDC, MedlinePlus).

## Build order

| Phase | Ships | Why first |
| --- | --- | --- |
| 0 | Dexie v3 migration, backup v2, profile plumbing, with "Me" as the only profile | Everything else depends on it |
| 1 | CSP, network test, copy lint test, Check privacy screen | Cheap. Protects every later phase. |
| 2 | Finer doses and split pills; half-life UX and caffeine metabolism | Smallest user-visible wins |
| 3 | Custom sleep window; profile switcher | Same day-window code |
| 4 | Fills, the "wore off" check-in, Compare fills | Needs profiles and the new check-in kinds |
| 5 | Summary for your prescriber, CSV export | Uses fills, wore-off times and profiles |
| 6 | Open-source repo, privacy page, lawyer review | Before public launch |

**Verification for each phase:** `npm test`, `npm run build`, then a pass in the browser at 390px in light and dark mode. For data features, check that the migration runs on a copy of a real v2 database.
