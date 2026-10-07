// Keeps vercel.json's security headers in sync with csp.config.mjs. Run by `npm run build`.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { CSP } from '../csp.config.mjs'

const path = fileURLToPath(new URL('../vercel.json', import.meta.url))
const cfg = JSON.parse(await readFile(path, 'utf8'))
const security = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()' },
]
cfg.headers = [
  { source: '/(.*)', headers: security },
  { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
]
await writeFile(path, JSON.stringify(cfg, null, 2) + '\n')
console.log('vercel.json headers updated')
