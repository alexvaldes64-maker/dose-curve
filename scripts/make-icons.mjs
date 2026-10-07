// Renders public/favicon.svg into the PNG icons used by the PWA manifest.
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url))
// Full-bleed square (no rounded corners) for maskable and Apple icons.
const square = Buffer.from(svg.toString().replace('rx="112"', 'rx="0"'))
const out = (f) => fileURLToPath(new URL(`../public/${f}`, import.meta.url))

await sharp(svg).resize(192, 192).png().toFile(out('icon-192.png'))
await sharp(svg).resize(512, 512).png().toFile(out('icon-512.png'))
await sharp(square).resize(512, 512).png().toFile(out('icon-maskable-512.png'))
await sharp(square).resize(180, 180).png().toFile(out('apple-touch-icon.png'))
console.log('icons written')
