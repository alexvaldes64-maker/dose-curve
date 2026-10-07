# Questions for legal review before public launch

This is a list of questions for a lawyer, not legal advice. Facts about the app are stated as they are today.

## What the app does

- A web app (PWA) that runs in the browser. Everything is stored on the device in IndexedDB. There are no accounts, analytics or ads. The browser's Content Security Policy blocks requests to any other server. The host (Vercel) receives standard web request logs, including IP addresses, when the app loads.
- Users log doses of ADHD stimulants (Adderall IR/XR, Vyvanse, Ritalin, Concerta-style methylphenidate ER) and caffeine. The app draws an **estimated** effect curve from population-average pharmacokinetics in the FDA labels (half-life, absorption, release shape), with phases (kicking in, peak, wearing off, fading, clear) and an estimated blood level at the user's sleep time.
- Users can change half-life and absorption values for themselves.
- The app shows a sourced list of interactions (from FDA labels via DailyMed, NIAAA, CDC and MedlinePlus).
- Profiles let a parent log for a child. Presets are adult averages, and the app says so.
- Users can generate a printable summary and a CSV of their own logs to share with a prescriber themselves. The app never transmits it.
- The app never suggests an amount, a next dose, a time to take something, or a remaining "allowance". A test fails the build on wording like that.

## Questions

1. **FDA device status.** Under the January 2026 General Wellness and Clinical Decision Support guidance, is a consumer app that estimates and displays drug levels over time (without dosing recommendations) under enforcement discretion, or is it a device function? Does letting users change half-life and absorption, or the child profile, change the answer?
2. **Interaction information.** Does showing sourced interaction text (no personalised alerts) stay within what FDA describes as not actively regulated?
3. **FTC Health Breach Notification Rule** (as amended in 2024). Does it apply when the developer never receives any health data? Does anything change if a future version adds optional sync or crash reporting?
4. **State consumer health data laws** (e.g. Washington My Health My Data Act, Nevada, Connecticut). Do they apply when data never leaves the device? What must a privacy policy say anyway?
5. **Children.** Does a parent-operated child profile create COPPA or state children's privacy obligations when no data is collected?
6. **Disclaimers.** Review the in-app notices ("Estimates only, based on general averages. Not medical advice. Follow your prescriber's instructions." and the summary header) for adequacy and placement.
7. **Trademarks.** Is using brand names (Adderall, Vyvanse, Ritalin, Concerta) in preset names and copy acceptable as nominative use?
8. **Content licensing.** The app cites FDA labels, NIAAA, CDC, MedlinePlus and FDA consumer pages in its own words and links to them. It does not use TripSit data, which is licensed for non-commercial use only. Confirm this is fine for a paid product.
9. **App stores.** If the app is later wrapped for the App Store or Google Play: Apple guideline 1.4.1 (methodology disclosure) and 1.4.2 (dosage calculators only from approved entities). Does an effect estimate without dose suggestions fall under 1.4.2?
10. **Liability.** Terms of use, limitation of liability, and whether an open-source license affects any of the above.
