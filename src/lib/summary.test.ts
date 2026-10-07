import { describe, expect, it } from 'vitest'
import { buildSummary, csvField, toCsv, type SumCheckin, type SumDose, type SumFill } from './summary'

const t = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString()
const dose = (d: number, h: number, m = 0, extra: Partial<SumDose> = {}): SumDose => ({ profileId: 1, substance: 'adderall', formulation: 'IR', takenAt: t(d, h, m), mg: 20, ...extra })
const fills: SumFill[] = [{ id: 1, profileId: 1, substance: 'adderall', formulation: 'IR', filledAt: t(1, 12), strengthMg: 20, manufacturer: 'Teva', pharmacy: 'CVS', lot: 'A123' }]

const doses: SumDose[] = [dose(2, 8), dose(3, 8, 30), dose(4, 9), dose(4, 13, 0, { mg: 10, strengthMg: 20, split: 0.5 }), dose(3, 7, 45, { substance: 'caffeine', formulation: 'drink', mg: 95 })]
const checkins: SumCheckin[] = [
  { profileId: 1, kind: 'rating', at: t(2, 10), focus: 4, mood: 4, tags: ['Headache'] }, // morning, 2 h after dose
  { profileId: 1, kind: 'rating', at: t(3, 15), focus: 2, mood: 3, note: 'crashed after lunch', context: ['Period or PMS week'] }, // afternoon, 6.5 h
  { profileId: 1, kind: 'wore_off', substance: 'adderall', at: t(2, 13), focus: 0, mood: 0 }, // 5 h
  { profileId: 1, kind: 'wore_off', substance: 'adderall', at: t(3, 14, 30), focus: 0, mood: 0 }, // 6 h
  { profileId: 1, kind: 'skipped', substance: 'adderall', reason: 'Planned break', at: t(6, 9), focus: 0, mood: 0 },
  { profileId: 1, kind: 'skipped', substance: 'vyvanse', reason: 'Could not get a refill', at: t(6, 9), focus: 0, mood: 0 },
]
const base = { doses, checkins, fills, from: new Date(2026, 9, 1), to: new Date(2026, 9, 7), model: 'simple' as const, toleranceRate: 0.12 }

describe('prescriber summary', () => {
  const s = buildSummary(base)

  it('covers the range and lists each substance', () => {
    expect(s.totalDays).toBe(7)
    expect(s.substances.map((x) => x.id).sort()).toEqual(['adderall', 'caffeine', 'vyvanse'])
  })

  it('describes dosing days, typical first dose time and observed wear-off', () => {
    const a = s.substances.find((x) => x.id === 'adderall')!
    expect(a.doseCount).toBe(4)
    expect(a.daysWithDose).toBe(3)
    expect(a.typicalFirstDose).toBe('8:30a') // median of 8:00, 8:30, 9:00
    expect(a.woreOffDays).toBe(2)
    expect(a.woreOffMedianHours).toBe(5.5)
    expect(a.skippedDays).toBe(1)
    expect(a.skipReasons).toEqual([{ reason: 'Planned break', count: 1 }])
    const v = s.substances.find((x) => x.id === 'vyvanse')!
    expect(v).toMatchObject({ doseCount: 0, skippedDays: 1 })
    expect(a.rows.at(-1)).toMatchObject({ what: '10 mg Adderall IR (½ of 20 mg)', fill: 'Teva, CVS' })
  })

  it('groups ratings by time of day and hours since the first medication dose', () => {
    expect(s.ratings.count).toBe(2)
    expect(s.ratings.byTimeOfDay[0]).toMatchObject({ n: 1, focus: 4 })
    expect(s.ratings.byTimeOfDay[1]).toMatchObject({ n: 1, focus: 2 })
    expect(s.ratings.byHoursSinceDose.find((b) => b.label === '0 to 2 h')?.n).toBe(0)
    expect(s.ratings.byHoursSinceDose.find((b) => b.label === '2 to 4 h')?.n).toBe(1)
    expect(s.ratings.byHoursSinceDose.find((b) => b.label === '6 to 8 h')?.n).toBe(1)
  })

  it('assigns each rating the estimated phase of that day’s medication', () => {
    const total = s.ratings.byPhase.reduce((a, b) => a + b.n, 0)
    expect(total).toBe(2)
    expect(s.ratings.byPhase.find((p) => p.label === 'Peak')?.n).toBe(1) // 2 h after an IR dose
  })

  it('counts side effects, keeps notes, lists fills and draws one curve per dosing day', () => {
    expect(s.sideEffects).toEqual([{ tag: 'Headache', count: 1 }])
    expect(s.context).toEqual([{ tag: 'Period or PMS week', count: 1 }])
    expect(s.notes).toEqual([expect.objectContaining({ text: 'crashed after lunch' })])
    expect(s.fillChanges).toEqual([expect.objectContaining({ what: 'Adderall IR 20 mg, Teva, CVS, lot A123' })])
    expect(s.dailyCurves).toHaveLength(3)
    expect(s.dailyCurves[1].series.map((x) => x.id).sort()).toEqual(['adderall', 'caffeine'])
  })

  it('leaves out anything outside the range', () => {
    const narrow = buildSummary({ ...base, from: new Date(2026, 9, 4), to: new Date(2026, 9, 4) })
    expect(narrow.substances.map((x) => x.doseCount)).toEqual([2])
    expect(narrow.ratings.count).toBe(0)
  })
})

describe('CSV', () => {
  it('quotes and escapes fields, and neutralizes spreadsheet formulas', () => {
    expect(csvField('plain')).toBe('plain')
    expect(csvField('a, b')).toBe('"a, b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvField('-5')).toBe("'-5")
    expect(csvField(undefined)).toBe('')
  })

  it('has one row per dose and check-in in range, oldest first', () => {
    const csv = toCsv(base, 'Me')
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe('profile,type,date,time,substance,formulation,amount_mg,split_of_mg,fill,focus,mood,appetite,side_effects,context,note')
    expect(lines).toHaveLength(1 + doses.length + checkins.length)
    expect(lines[1]).toBe('Me,dose,2026-10-02,8:00a,Adderall,IR,20,,Teva lot A123,,,,,,')
    expect(csv).toContain('Period or PMS week')
    expect(csv).toContain(',skipped,')
    expect(csv).toContain('Reason: Planned break')
    expect(csv).toContain('wore_off')
    expect(csv).toContain('0.5 of 20')
  })
})
