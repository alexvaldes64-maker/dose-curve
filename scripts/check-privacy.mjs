// Fails the build if shipped code can make network requests it should not.
// App code: no network APIs at all. Service worker (Workbox): fetch is allowed because it
// only precaches this site's own files, and the CSP's connect-src 'self' enforces that.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CSP } from '../csp.config.mjs'

const dist = fileURLToPath(new URL('../dist', import.meta.url))
const NETWORK = [/\bfetch\(/, /XMLHttpRequest/, /sendBeacon/, /new WebSocket/, /new EventSource/, /RTCPeerConnection/, /importScripts\(/]
const SERVICE_WORKER = [/^sw\.js$/, /^workbox-[\w-]+\.js$/]
const problems = []

async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await walk(p)
    else if (e.name.endsWith('.js')) await check(p, e.name)
  }
}

async function check(path, name) {
  const code = await readFile(path, 'utf8')
  const isSW = SERVICE_WORKER.some((r) => r.test(name))
  if (isSW) {
    // The service worker may only import local scripts.
    for (const m of code.matchAll(/importScripts\(([^)]*)\)/g)) {
      if (/https?:/.test(m[1])) problems.push(`${name}: importScripts loads a remote script: ${m[1]}`)
    }
    return
  }
  for (const r of NETWORK) if (r.test(code)) problems.push(`${name}: uses ${r.source.replace(/\\b|\\/g, '')}`)
}

await walk(dist)

const html = await readFile(join(dist, 'index.html'), 'utf8')
if (!html.includes(`content="${CSP}"`)) problems.push('index.html: Content-Security-Policy meta tag is missing or out of date')
if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) problems.push('index.html: has an inline <script>, which the CSP would block')

if (problems.length) {
  console.error('Privacy check failed:\n  ' + problems.join('\n  '))
  process.exit(1)
}
console.log('Privacy check passed: no network APIs in app code, CSP present.')
