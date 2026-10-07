// Prescriber summary: descriptive statistics over a date range, computed from what was logged.
// Nothing here interprets or recommends. Estimated values are labeled as estimates in the UI.

import { BUCKETS, fillForDose, median, type CheckinLike, type DoseLike, type FillLike } from './compare'
import { HOUR, computeSubstanceDay, levelAt, phaseAt, phases, type Phase } from './model'
import { PHASE_LABEL } from './phaseStyle'
import { doseName, getSubstance, resolveModel, splitNote, type Overrides } from './substances'
import { addDays, dateKey, fmtTime, startOfLocalDay } from './time'

export interface SumDose extends DoseLike {
  mg: number
  strengthMg?: number
  split?: 0.5 | 0.25
}
export interface SumCheckin extends CheckinLike {
  note?: string
  appetite?: number
  context?: string[]
  reason?: string
}
export interface SumFill extends FillLike {
  id?: number
  strengthMg: number
  manufacturer: string
  pharmacy?: string
  ndc?: string
  lot?: string
}

export interface SummaryInput {
  doses: SumDose[]
  checkins: SumCheckin[]
  fills: SumFill[]
  /** Inclusive local dates. */
  from: Date
  to: Date
  model: 'simple' | 'tolerance'
  toleranceRate: number
  overrides?: Overrides
}

export const TIME_OF_DAY = [
  { label: 'Morning (5a to 12p)', from: 5, to: 12 },
  { label: 'Afternoon (12p to 5p)', from: 12, to: 17 },
  { label: 'Evening (5p to 10p)', from: 17, to: 22 },
  { label: 'Night (10p to 5a)', from: 22, to: 29 },
] as const

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const minutesOfDay = (t: number) => {
  const d = new Date(t)
  return d.getHours() * 60 + d.getMinutes()
}
/** "8:15a" from minutes after midnight. */
export function fmtMinutes(m: number): string {
  const d = new Date(2000, 0, 1, 0, Math.round(m))
  return fmtTime(d.getTime())
}

export interface SubstanceSummary {
  id: string
  name: string
  color: string
  doseCount: number
  daysWithDose: number
  totalDays: number
  /** Median clock time of the day's first dose. */
  typicalFirstDose: string | null
  /** Median hours from first dose to the first "wore off" check-in, and on how many days. */
  woreOffMedianHours: number | null
  woreOffDays: number
  /** Days logged as skipped or paused, and why. */
  skippedDays: number
  skipReasons: { reason: string; count: number }[]
  rows: { date: string; time: string; what: string; fill: string }[]
}

export interface Summary {
  from: string
  to: string
  totalDays: number
  substances: SubstanceSummary[]
  ratings: {
    count: number
    byTimeOfDay: { label: string; focus: number | null; mood: number | null; n: number }[]
    byHoursSinceDose: { label: string; focus: number | null; mood: number | null; n: number }[]
    byPhase: { label: string; focus: number | null; mood: number | null; n: number }[]
    appetite: number | null
  }
  sideEffects: { tag: string; count: number }[]
  /** Context tags (e.g. period week), counted separately from side effects. */
  context: { tag: string; count: number }[]
  notes: { date: string; time: string; text: string }[]
  fillChanges: { date: string; what: string }[]
  /** One estimated curve per day with a dose, for the small charts. */
  dailyCurves: { date: string; series: { id: string; color: string; points: [number, number][] }[] }[]
}

export function buildSummary(input: SummaryInput): Summary {
  const start = startOfLocalDay(input.from).getTime()
  const end = addDays(startOfLocalDay(input.to), 1).getTime()
  const inRange = (t: number) => t >= start && t < end
  const totalDays = Math.round((end - start) / (24 * HOUR))
  const doses = input.doses.filter((d) => inRange(Date.parse(d.takenAt))).sort((a, b) => a.takenAt.localeCompare(b.takenAt))
  const checkins = input.checkins.filter((c) => inRange(Date.parse(c.at)))
  const ratings = checkins.filter((c) => c.kind === 'rating')

  const fillLabel = (d: SumDose) => {
    const f = fillForDose(d, input.fills)
    return f ? `${f.manufacturer}${f.pharmacy ? `, ${f.pharmacy}` : ''}` : ''
  }

  // Per substance
  const skips = checkins.filter((c) => c.kind === 'skipped' && c.substance)
  const ids = [...new Set([...doses.map((d) => d.substance), ...skips.map((c) => c.substance!)])]
  const substances: SubstanceSummary[] = ids.map((id) => {
    const preset = getSubstance(id)
    const mine = doses.filter((d) => d.substance === id)
    const byDay = new Map<string, SumDose[]>()
    for (const d of mine) byDay.set(dateKey(Date.parse(d.takenAt)), [...(byDay.get(dateKey(Date.parse(d.takenAt))) ?? []), d])
    const firsts = [...byDay.values()].map((ds) => Math.min(...ds.map((d) => Date.parse(d.takenAt))))
    const woreOff: number[] = []
    for (const first of firsts) {
      const wo = checkins
        .filter((c) => c.kind === 'wore_off' && (!c.substance || c.substance === id))
        .map((c) => (Date.parse(c.at) - first) / HOUR)
        .filter((h) => h >= 0 && h < 24)
        .sort((a, b) => a - b)[0]
      if (wo !== undefined) woreOff.push(wo)
    }
    const typical = median(firsts.map(minutesOfDay))
    const mySkips = skips.filter((c) => c.substance === id)
    const reasonCounts = new Map<string, number>()
    for (const c of mySkips) reasonCounts.set(c.reason ?? 'Other', (reasonCounts.get(c.reason ?? 'Other') ?? 0) + 1)
    return {
      id,
      name: preset.name,
      color: preset.color,
      doseCount: mine.length,
      daysWithDose: byDay.size,
      totalDays,
      typicalFirstDose: typical === null ? null : fmtMinutes(typical),
      woreOffMedianHours: median(woreOff),
      woreOffDays: woreOff.length,
      skippedDays: new Set(mySkips.map((c) => dateKey(Date.parse(c.at)))).size,
      skipReasons: [...reasonCounts].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      rows: mine.map((d) => {
        const t = Date.parse(d.takenAt)
        const split = splitNote(d)
        return {
          date: new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          time: fmtTime(t),
          what: `${doseName({ substance: d.substance, formulation: d.formulation, mg: d.mg })}${split ? ` (${split})` : ''}`,
          fill: fillLabel(d),
        }
      }),
    }
  })

  // Daily estimated curves and phase at each rating
  const dailyCurves: Summary['dailyCurves'] = []
  const phaseOf = new Map<SumCheckin, Phase>()
  for (let day = start; day < end; day = addDays(new Date(day), 1).getTime()) {
    const dayEnd = addDays(new Date(day), 1).getTime()
    const dayDoses = doses.filter((d) => Date.parse(d.takenAt) >= day && Date.parse(d.takenAt) < dayEnd)
    if (!dayDoses.length) continue
    const lookback = input.doses.filter((d) => Date.parse(d.takenAt) >= day - 48 * HOUR && Date.parse(d.takenAt) < dayEnd)
    const series: Summary['dailyCurves'][number]['series'] = []
    // Ratings are matched to the day's first medication (caffeine only if nothing else).
    const primary = [...new Set(dayDoses.map((d) => d.substance))].sort((a, b) => Number(a === 'caffeine') - Number(b === 'caffeine'))[0]
    for (const id of [...new Set(dayDoses.map((d) => d.substance))]) {
      const preset = getSubstance(id)
      const samples = computeSubstanceDay(
        lookback.filter((d) => d.substance === id).map((d) => ({ amount: d.mg, takenAt: d.takenAt, formulation: d.formulation })),
        resolveModel(preset, input.overrides),
        { model: input.model, toleranceRate: input.toleranceRate },
        day,
        dayEnd,
        15,
      )
      series.push({ id, color: preset.color, points: samples.map((s) => [(s.t - day) / HOUR, Math.max(0, s.effect)]) })
      if (id === primary) {
        const segs = phases(samples)
        for (const c of ratings) {
          const t = Date.parse(c.at)
          if (t >= day && t < dayEnd && levelAt(samples, t) > 0) phaseOf.set(c, phaseAt(segs, t))
        }
      }
    }
    dailyCurves.push({ date: new Date(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), series })
  }

  // Ratings
  const group = <K extends string>(labels: readonly K[], key: (c: SumCheckin) => K | null) =>
    labels.map((label) => {
      const xs = ratings.filter((c) => key(c) === label)
      return { label, focus: avg(xs.map((c) => c.focus)), mood: avg(xs.map((c) => c.mood)), n: xs.length }
    })
  const hourOfDay = (c: SumCheckin) => {
    const h = new Date(Date.parse(c.at)).getHours()
    return h < 5 ? h + 24 : h
  }
  const byTimeOfDay = group(
    TIME_OF_DAY.map((x) => x.label),
    (c) => TIME_OF_DAY.find((x) => hourOfDay(c) >= x.from && hourOfDay(c) < x.to)?.label ?? null,
  )
  const firstDoseBefore = (t: number) => {
    const day = startOfLocalDay(t).getTime()
    const ds = doses.filter((d) => Date.parse(d.takenAt) >= day && Date.parse(d.takenAt) <= t && d.substance !== 'caffeine')
    return ds.length ? Math.min(...ds.map((d) => Date.parse(d.takenAt))) : null
  }
  const byHoursSinceDose = group(
    BUCKETS.map((b) => b.label),
    (c) => {
      const first = firstDoseBefore(Date.parse(c.at))
      if (first === null) return null
      const h = (Date.parse(c.at) - first) / HOUR
      return BUCKETS.find((b) => h >= b.from && h < b.to)?.label ?? null
    },
  )
  const phaseLabels = (['Onset', 'Peak', 'Taper', 'Comedown', 'Clear'] as Phase[]).map((p) => PHASE_LABEL[p])
  const byPhase = group(phaseLabels, (c) => (phaseOf.has(c) ? PHASE_LABEL[phaseOf.get(c)!] : null))

  const count = (pick: (c: SumCheckin) => string[] | undefined) => {
    const m = new Map<string, number>()
    for (const c of checkins) for (const t of pick(c) ?? []) m.set(t, (m.get(t) ?? 0) + 1)
    return [...m].map(([tag, n]) => ({ tag, count: n })).sort((a, b) => b.count - a.count)
  }

  const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return {
    from: new Date(start).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
    to: new Date(end - 1).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
    totalDays,
    substances,
    ratings: {
      count: ratings.length,
      byTimeOfDay,
      byHoursSinceDose,
      byPhase,
      appetite: avg(ratings.map((c) => c.appetite).filter((x): x is number => typeof x === 'number')),
    },
    sideEffects: count((c) => c.tags),
    context: count((c) => c.context),
    notes: checkins
      .filter((c) => c.note)
      .map((c) => ({ date: fmtDate(Date.parse(c.at)), time: fmtTime(Date.parse(c.at)), text: c.note! })),
    fillChanges: input.fills
      .filter((f) => inRange(Date.parse(f.filledAt)))
      .sort((a, b) => a.filledAt.localeCompare(b.filledAt))
      .map((f) => ({
        date: fmtDate(Date.parse(f.filledAt)),
        what: `${getSubstance(f.substance).name} ${f.formulation} ${f.strengthMg} mg, ${f.manufacturer}${f.pharmacy ? `, ${f.pharmacy}` : ''}${f.ndc ? `, NDC ${f.ndc}` : ''}${f.lot ? `, lot ${f.lot}` : ''}`,
      })),
    dailyCurves,
  }
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** RFC 4180 field: quote when needed, double inner quotes, and neutralize spreadsheet formulas. */
export function csvField(v: unknown): string {
  let s = v === undefined || v === null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** One row per dose or check-in in range, oldest first. */
export function toCsv(input: Pick<SummaryInput, 'doses' | 'checkins' | 'fills' | 'from' | 'to'>, profileName: string): string {
  const start = startOfLocalDay(input.from).getTime()
  const end = addDays(startOfLocalDay(input.to), 1).getTime()
  const header = ['profile', 'type', 'date', 'time', 'substance', 'formulation', 'amount_mg', 'split_of_mg', 'fill', 'focus', 'mood', 'appetite', 'side_effects', 'context', 'note']
  const rows: { t: number; cells: unknown[] }[] = []
  for (const d of input.doses) {
    const t = Date.parse(d.takenAt)
    if (t < start || t >= end) continue
    const f = fillForDose(d, input.fills)
    rows.push({
      t,
      cells: [profileName, 'dose', dateKey(t), fmtTime(t), getSubstance(d.substance).name, d.formulation, d.mg, d.split && d.strengthMg ? `${d.split} of ${d.strengthMg}` : '', f ? `${f.manufacturer}${f.lot ? ` lot ${f.lot}` : ''}` : '', '', '', '', '', '', ''],
    })
  }
  for (const c of input.checkins) {
    const t = Date.parse(c.at)
    if (t < start || t >= end) continue
    const rating = c.kind === 'rating'
    rows.push({
      t,
      cells: [
        profileName,
        c.kind === 'wore_off' ? 'wore_off' : c.kind === 'skipped' ? 'skipped' : 'check_in',
        dateKey(t),
        fmtTime(t),
        c.substance ? getSubstance(c.substance).name : '',
        '',
        '',
        '',
        '',
        rating ? c.focus : '',
        rating ? c.mood : '',
        c.appetite ?? '',
        (c.tags ?? []).join('; '),
        (c.context ?? []).join('; '),
        [c.reason ? `Reason: ${c.reason}` : '', c.note ?? ''].filter(Boolean).join('. '),
      ],
    })
  }
  rows.sort((a, b) => a.t - b.t)
  return [header, ...rows.map((r) => r.cells)].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n'
}
