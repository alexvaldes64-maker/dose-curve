import { useMemo } from 'react'
import { LOOKBACK, useCheckins, useDoses, type Checkin, type Dose, type Settings } from '../db'
import { HOUR, computeSubstanceDay, levelAt, phases, type PhaseSegment, type Sample } from '../lib/model'
import { SUBSTANCES, getSubstance, resolveModel, type SubstancePreset } from '../lib/substances'
import { addDays, dayWindowFor, startOfLocalDay } from '../lib/time'

/** One substance's day: its doses, sampled curve and phases. Components draw one of these. */
export interface SubstanceDay {
  id: string
  preset: SubstancePreset
  start: number
  end: number
  /** This substance's doses inside the window. */
  doses: Dose[]
  checkins: Checkin[]
  samples: Sample[]
  segments: PhaseSegment[]
  maxEffect: number
  bedtimePlasma: number
  dataKey: string
}

/** Kept for components that draw a single substance. */
export type DayModel = SubstanceDay

/**
 * Everything needed to draw one day, per substance. The window runs wake to bedtime,
 * starting earlier if a dose that calendar day was logged before wake.
 */
export function useDayModel(day: Date, s: Settings, preferred?: string) {
  const win = dayWindowFor(day, s.wakeTime, s.bedtime, s.daySchedules)
  const midnight = startOfLocalDay(day).getTime()
  const nextMidnight = addDays(startOfLocalDay(day), 1).getTime()
  const allDoses = useDoses(midnight - LOOKBACK, win.end)

  const earliestToday = allDoses.map((d) => Date.parse(d.takenAt)).find((t) => t >= midnight && t < nextMidnight)
  const start = earliestToday !== undefined && earliestToday < win.start ? Math.floor(earliestToday / HOUR) * HOUR : win.start
  const end = win.end
  const checkins = useCheckins(start, end)

  const overridesKey = JSON.stringify(s.overrides ?? {})
  const substances = useMemo(() => {
    const out: SubstanceDay[] = []
    for (const preset of SUBSTANCES) {
      const mine = allDoses.filter((d) => (d.substance ?? 'adderall') === preset.id)
      const inWindow = mine.filter((d) => {
        const t = Date.parse(d.takenAt)
        return t >= start && t < end
      })
      if (!mine.length) continue
      const model = resolveModel(preset, s.overrides)
      const samples = computeSubstanceDay(
        mine.map((d) => ({ amount: d.mg, takenAt: d.takenAt, formulation: d.formulation })),
        model,
        { model: s.model, toleranceRate: s.toleranceRate },
        start,
        end,
        5,
      )
      const maxEffect = Math.max(0, ...samples.map((x) => x.effect))
      // Skip substances whose leftovers from earlier days are negligible here.
      if (!inWindow.length && maxEffect < 2) continue
      out.push({
        id: preset.id,
        preset,
        start,
        end,
        doses: inWindow,
        checkins,
        samples,
        segments: phases(samples),
        maxEffect,
        bedtimePlasma: levelAt(samples, end, 'plasma'),
        dataKey: [preset.id, s.model, s.toleranceRate, overridesKey, start, end, ...mine.map((d) => `${d.id}:${d.mg}:${d.formulation}:${d.takenAt}`)].join('|'),
      })
    }
    return out
  }, [allDoses, start, end, checkins, s.model, s.toleranceRate, overridesKey, s.overrides])

  const empty = useMemo(() => emptyDay(getSubstance(preferred), start, end, checkins), [preferred, start, end, checkins])
  const allInWindow = useMemo(
    () => allDoses.filter((d) => Date.parse(d.takenAt) >= start && Date.parse(d.takenAt) < end),
    [allDoses, start, end],
  )

  return { start, end, checkins, substances, empty, doses: allInWindow }
}

function emptyDay(preset: SubstancePreset, start: number, end: number, checkins: Checkin[]): SubstanceDay {
  const samples: Sample[] = []
  for (let t = start; t <= end + 1; t += 5 * 60_000) samples.push({ t, effect: 0, plasma: 0, early: 0, late: 0 })
  return {
    id: preset.id,
    preset,
    start,
    end,
    doses: [],
    checkins,
    samples,
    segments: phases(samples),
    maxEffect: 0,
    bedtimePlasma: 0,
    dataKey: `empty|${preset.id}|${start}|${end}`,
  }
}

/** Pick which substance to focus: the requested one if present, else the latest dose at or before `now`. */
export function pickSubstance(days: SubstanceDay[], requested: string | null, now: number): SubstanceDay | undefined {
  if (requested) {
    const hit = days.find((d) => d.id === requested)
    if (hit) return hit
  }
  let best: SubstanceDay | undefined
  let bestT = -Infinity
  for (const d of days) {
    for (const x of d.doses) {
      const t = Date.parse(x.takenAt)
      if (t <= now && t > bestT) {
        bestT = t
        best = d
      }
    }
  }
  return best ?? days[0]
}
