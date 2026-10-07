// Compare two pharmacy fills using only what the user logged. The estimated curve is the
// same for every fill by definition, so it is never part of the comparison.

import { HOUR } from './model'
import { dateKey } from './time'

export interface FillLike {
  id?: number
  profileId: number
  substance: string
  formulation: string
  filledAt: string
}
export interface DoseLike {
  profileId: number
  substance: string
  formulation: string
  takenAt: string
  fillId?: number
}
export interface CheckinLike {
  profileId: number
  kind: 'rating' | 'wore_off' | 'side_effect'
  at: string
  focus: number
  mood: number
  tags?: string[]
  substance?: string
}

/** Fewer logged days than this and the comparison says "not enough data yet". */
export const MIN_DAYS = 5

export const SIDE_EFFECT_TAGS = ['Headache', 'Low appetite', 'Trouble sleeping', 'Irritable', 'Jittery', 'Racing heart', 'Stomach upset', 'Dry mouth'] as const

/** Things about the day that can change how a dose feels. Logged, never interpreted. */
export const CONTEXT_TAGS = ['Period or PMS week', 'Short sleep', 'Skipped a meal', 'Stressful day', 'Sick'] as const

export const BUCKETS = [
  { label: '0 to 2 h', from: 0, to: 2 },
  { label: '2 to 4 h', from: 2, to: 4 },
  { label: '4 to 6 h', from: 4, to: 6 },
  { label: '6 to 8 h', from: 6, to: 8 },
  { label: '8 h and later', from: 8, to: 24 },
] as const

/**
 * The fill a dose came from: the one picked when logging, else the most recent fill of the
 * same substance and formulation for that person, filled on or before the dose's day.
 */
export function fillForDose<F extends FillLike>(dose: DoseLike, fills: F[]): F | undefined {
  if (dose.fillId) return fills.find((f) => f.id === dose.fillId)
  const day = dateKey(Date.parse(dose.takenAt))
  let best: F | undefined
  for (const f of fills) {
    if (f.profileId !== dose.profileId || f.substance !== dose.substance || f.formulation !== dose.formulation) continue
    if (dateKey(Date.parse(f.filledAt)) > day) continue
    if (!best || f.filledAt > best.filledAt) best = f
  }
  return best
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export interface FillStats {
  /** Days where every dose of this substance came from this fill. */
  days: number
  enough: boolean
  woreOffDays: number
  /** Median hours from the day's first dose to the first "wore off" check-in. */
  medianWoreOffHours: number | null
  buckets: { label: string; focus: number | null; mood: number | null; n: number }[]
  sideEffects: { tag: string; count: number }[]
}

/** Observed stats for one fill. Days that mix fills are left out. */
export function fillStats<F extends FillLike>(fill: F, fills: F[], doses: DoseLike[], checkins: CheckinLike[]): FillStats {
  const mine = doses.filter((d) => d.profileId === fill.profileId && d.substance === fill.substance)
  const byDay = new Map<string, DoseLike[]>()
  for (const d of mine) {
    const k = dateKey(Date.parse(d.takenAt))
    byDay.set(k, [...(byDay.get(k) ?? []), d])
  }

  const woreOff: number[] = []
  const buckets = BUCKETS.map((b) => ({ ...b, focus: [] as number[], mood: [] as number[] }))
  const tagCounts = new Map<string, number>()
  let days = 0

  for (const [, dayDoses] of byDay) {
    if (!dayDoses.every((d) => fillForDose(d, fills)?.id === fill.id)) continue
    days++
    const first = Math.min(...dayDoses.map((d) => Date.parse(d.takenAt)))
    const end = first + 24 * HOUR
    const dayChecks = checkins.filter((c) => c.profileId === fill.profileId && Date.parse(c.at) >= first && Date.parse(c.at) < end)

    const wo = dayChecks
      .filter((c) => c.kind === 'wore_off' && (!c.substance || c.substance === fill.substance))
      .map((c) => (Date.parse(c.at) - first) / HOUR)
      .sort((a, b) => a - b)[0]
    if (wo !== undefined) woreOff.push(wo)

    for (const c of dayChecks) {
      if (c.kind === 'rating') {
        const h = (Date.parse(c.at) - first) / HOUR
        const b = buckets.find((x) => h >= x.from && h < x.to)
        if (b) {
          b.focus.push(c.focus)
          b.mood.push(c.mood)
        }
      }
      for (const t of c.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
    }
  }

  return {
    days,
    enough: days >= MIN_DAYS,
    woreOffDays: woreOff.length,
    medianWoreOffHours: median(woreOff),
    buckets: buckets.map((b) => ({ label: b.label, focus: avg(b.focus), mood: avg(b.mood), n: b.focus.length })),
    sideEffects: [...tagCounts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
  }
}

/**
 * Across all logged days for one substance: how many hours after the day's first dose the user
 * typically marked "wore off". Observed only, never adjusted by the model.
 */
export function observedWearOff(substance: string, doses: DoseLike[], checkins: CheckinLike[]): { days: number; medianHours: number | null } {
  const firsts = new Map<string, number>()
  for (const d of doses) {
    if (d.substance !== substance) continue
    const t = Date.parse(d.takenAt)
    const k = dateKey(t)
    firsts.set(k, Math.min(firsts.get(k) ?? Infinity, t))
  }
  const hours: number[] = []
  for (const first of firsts.values()) {
    const wo = checkins
      .filter((c) => c.kind === 'wore_off' && (!c.substance || c.substance === substance))
      .map((c) => (Date.parse(c.at) - first) / HOUR)
      .filter((h) => h >= 0 && h < 24)
      .sort((a, b) => a - b)[0]
    if (wo !== undefined) hours.push(wo)
  }
  return { days: hours.length, medianHours: median(hours) }
}
