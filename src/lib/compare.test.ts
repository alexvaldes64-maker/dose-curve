import { describe, expect, it } from 'vitest'
import { fillForDose, fillStats, median, type CheckinLike, type DoseLike, type FillLike } from './compare'

// Local times (TZ set in vitest.config.ts).
const t = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString()
const A: FillLike = { id: 1, profileId: 1, substance: 'adderall', formulation: 'IR', filledAt: t(1, 12) }
const B: FillLike = { id: 2, profileId: 1, substance: 'adderall', formulation: 'IR', filledAt: t(10, 12) }
const fills = [A, B]
const dose = (d: number, h: number, extra: Partial<DoseLike> = {}): DoseLike => ({ profileId: 1, substance: 'adderall', formulation: 'IR', takenAt: t(d, h), ...extra })

describe('fillForDose', () => {
  it('uses the latest fill on or before the dose day', () => {
    expect(fillForDose(dose(5, 9), fills)?.id).toBe(1)
    expect(fillForDose(dose(10, 8), fills)?.id).toBe(2) // filled later that same day still counts
    expect(fillForDose(dose(12, 9), fills)?.id).toBe(2)
  })
  it('an explicit pick wins, and other people or formulations never match', () => {
    expect(fillForDose(dose(12, 9, { fillId: 1 }), fills)?.id).toBe(1)
    expect(fillForDose(dose(5, 9, { profileId: 2 }), fills)).toBeUndefined()
    expect(fillForDose(dose(5, 9, { formulation: 'XR' }), fills)).toBeUndefined()
    expect(fillForDose(dose(5, 9), [])).toBeUndefined()
  })
})

describe('fillStats', () => {
  const doses = [2, 3, 4, 5, 6].map((d) => dose(d, 8)).concat([dose(6, 13)]) // day 6 has a second dose
  const checkins: CheckinLike[] = [
    { profileId: 1, kind: 'wore_off', at: t(2, 13), focus: 0, mood: 0 }, // 5 h
    { profileId: 1, kind: 'wore_off', at: t(3, 14), focus: 0, mood: 0 }, // 6 h
    { profileId: 1, kind: 'wore_off', at: t(3, 16), focus: 0, mood: 0 }, // later one ignored
    { profileId: 1, kind: 'wore_off', at: t(4, 12), focus: 0, mood: 0 }, // 4 h
    { profileId: 1, kind: 'rating', at: t(2, 9), focus: 4, mood: 3 }, // 1 h
    { profileId: 1, kind: 'rating', at: t(3, 9, 30), focus: 2, mood: 5, tags: ['Headache'] }, // 1.5 h
    { profileId: 1, kind: 'rating', at: t(4, 11), focus: 5, mood: 4, tags: ['Headache', 'Jittery'] }, // 3 h
    { profileId: 2, kind: 'wore_off', at: t(5, 10), focus: 0, mood: 0 }, // someone else
  ]

  it('counts days, takes the median first wore-off time, and buckets ratings by hours since the first dose', () => {
    const s = fillStats(A, fills, doses, checkins)
    expect(s.days).toBe(5)
    expect(s.enough).toBe(true)
    expect(s.woreOffDays).toBe(3)
    expect(s.medianWoreOffHours).toBe(5)
    expect(s.buckets[0]).toMatchObject({ focus: 3, mood: 4, n: 2 })
    expect(s.buckets[1]).toMatchObject({ focus: 5, mood: 4, n: 1 })
    expect(s.buckets[2].n).toBe(0)
    expect(s.sideEffects).toEqual([
      { tag: 'Headache', count: 2 },
      { tag: 'Jittery', count: 1 },
    ])
  })

  it('leaves out days that mix fills', () => {
    const mixed = [...doses, dose(5, 14, { fillId: 2 })]
    expect(fillStats(A, fills, mixed, checkins).days).toBe(4)
  })

  it('reports not enough data under five days', () => {
    const s = fillStats(B, fills, [dose(11, 8), dose(12, 8)], [])
    expect(s.days).toBe(2)
    expect(s.enough).toBe(false)
    expect(s.medianWoreOffHours).toBeNull()
  })

  it('median of even and odd lists', () => {
    expect(median([4, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

import { observedWearOff } from './compare'

describe('observedWearOff', () => {
  it('takes the median first wear-off per day, for that substance only', () => {
    const doses = [2, 3, 4].map((d) => dose(d, 8)).concat([dose(3, 7, { substance: 'caffeine', formulation: 'drink' })])
    const checkins: CheckinLike[] = [
      { profileId: 1, kind: 'wore_off', substance: 'adderall', at: t(2, 12), focus: 0, mood: 0 }, // 4 h
      { profileId: 1, kind: 'wore_off', substance: 'adderall', at: t(3, 13), focus: 0, mood: 0 }, // 5 h
      { profileId: 1, kind: 'wore_off', substance: 'caffeine', at: t(3, 9), focus: 0, mood: 0 }, // other substance
      { profileId: 1, kind: 'wore_off', substance: 'adderall', at: t(4, 14, 30), focus: 0, mood: 0 }, // 6.5 h
    ]
    expect(observedWearOff('adderall', doses, checkins)).toEqual({ days: 3, medianHours: 5 })
    expect(observedWearOff('vyvanse', doses, checkins)).toEqual({ days: 0, medianHours: null })
  })
})

import { supplyFor, type SupplyDose, type SupplyFill } from './compare'

describe('supplyFor', () => {
  const fill: SupplyFill = { id: 7, profileId: 1, substance: 'adderall', formulation: 'IR', filledAt: t(1, 9), strengthMg: 20, quantity: 30 }
  const d = (day: number, h: number, mg: number): SupplyDose => ({ profileId: 1, substance: 'adderall', formulation: 'IR', takenAt: t(day, h), mg })

  it('counts whole and split tablets and projects days left at the logged pace', () => {
    // Oct 2 to 7: 20 mg in the morning, 10 mg (half a tablet) after lunch = 1.5 tablets a day
    const doses = [2, 3, 4, 5, 6, 7].flatMap((day) => [d(day, 8, 20), d(day, 13, 10)])
    const now = Date.parse(t(7, 20))
    const s = supplyFor(fill, [fill], doses, now)!
    expect(s.used).toBe(9)
    expect(s.left).toBe(21)
    expect(s.perDay).toBeGreaterThan(1.3)
    expect(s.perDay).toBeLessThan(1.6)
    expect(s.daysLeft).toBeGreaterThan(13)
    expect(s.daysLeft).toBeLessThan(16)
    expect(s.runOut!.getTime()).toBeGreaterThan(now)
  })

  it('needs a count, and three logged days before projecting', () => {
    expect(supplyFor({ ...fill, quantity: undefined }, [fill], [], Date.parse(t(5, 9)))).toBeNull()
    const s = supplyFor(fill, [fill], [d(2, 8, 20), d(3, 8, 20)], Date.parse(t(3, 20)))!
    expect(s.left).toBe(28)
    expect(s.perDay).toBeNull()
    expect(s.runOut).toBeNull()
  })

  it('never goes below zero and ignores doses from other fills or people', () => {
    const doses = [d(2, 8, 20), { ...d(2, 9, 20), profileId: 2 }, { ...d(2, 10, 20), fillId: 99 }]
    const s = supplyFor({ ...fill, quantity: 0.5 }, [fill], doses, Date.parse(t(3, 9)))!
    expect(s.used).toBe(1)
    expect(s.left).toBe(0)
  })
})
