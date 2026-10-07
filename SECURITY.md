# Security policy

Dose Curve stores health information on the user's device and is designed so that nothing is ever sent anywhere. We treat anything that could break that promise as a security issue.

## What counts

- Any way for app data to leave the device (network requests, beacons, third-party scripts, a bypass of the Content Security Policy).
- Anything that lets another website or app read Dose Curve's stored data.
- Cross-site scripting or injection, including through imported backup files or CSV exports opened in a spreadsheet.
- A dependency with a known vulnerability that affects the shipped app.

## How to report

Please report privately through GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue for security problems.

Include what you found, how to reproduce it, and which version you saw it in (Learn > Check privacy shows the version and build). We aim to reply within 7 days. This is a volunteer project, so there is no bug bounty.

## Supported versions

Only the latest version on the `main` branch is supported.
