// Legal guardrail: the app describes, it never prescribes. This scans every source file the app
// ships (UI copy, presets, interaction text, comments included) for wording that would suggest
// an amount, a next dose or a "safe" time. Add phrases here; never delete them to make a build pass.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const BANNED: RegExp[] = [
  /take more/i,
  /take another/i,
  /next dose/i,
  /safe to take/i,
  /you can take/i,
  /you should take/i,
  /should take/i,
  /how much more/i,
  /\bre-?dose\b/i,
  /\bbooster\b/i,
  /increase your dose/i,
  /lower your dose/i,
  /decrease your dose/i,
  /skip (a|your) dose/i,
  /time to take/i,
  /recommended dose/i,
  /safe amount/i,
]

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return files(p)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : []
  })
}

const src = join(__dirname)
const sources = files(src).map((p) => ({ p: p.slice(src.length + 1), text: readFileSync(p, 'utf8') }))

describe('copy guardrails', () => {
  it('scans a real set of files', () => {
    expect(sources.length).toBeGreaterThan(20)
  })

  it('no dosing or timing advice anywhere in the app', () => {
    const hits = sources.flatMap(({ p, text }) =>
      text.split('\n').flatMap((line, i) => BANNED.filter((r) => r.test(line)).map((r) => `${p}:${i + 1} matches ${r}`)),
    )
    expect(hits).toEqual([])
  })

  it('no em or en dashes in app copy', () => {
    const hits = sources.flatMap(({ p, text }) => text.split('\n').flatMap((line, i) => (/[–—]/.test(line) ? [`${p}:${i + 1}`] : [])))
    expect(hits).toEqual([])
  })
})
