import { describe, expect, it } from 'vitest'
import { HOUR, amountInBody, computeDay, computeSubstanceDay, shapePeak, type ModelParams } from './model'
import { SUBSTANCES, getSubstance, resolveModel } from './substances'

const T0 = Date.UTC(2026, 9, 6, 7, 0)
const AT = T0 + 2 * HOUR
const iso = (t: number) => new Date(t).toISOString()
const model = (id: string) => resolveModel(getSubstance(id))
const f = (id: string, form: string) => model(id).formulations[form]

function argmaxHours(samples: { t: number; effect: number }[]) {
  let best = samples[0]
  for (const s of samples) if (s.effect > best.effect) best = s
  return (best.t - AT) / HOUR
}

describe('presets', () => {
  it('every preset has a reference formulation and sources', () => {
    for (const s of SUBSTANCES) {
      expect(s.formulations.some((x) => x.id === s.reference.formulation)).toBe(true)
      expect(s.sources.length).toBeGreaterThan(0)
    }
  })

  it('Adderall IR preset matches the original model in both modes', () => {
    const doses = [{ amount: 20, takenAt: iso(AT), formulation: 'IR' }]
    const legacy = [{ mg: 20, takenAt: iso(AT) }]
    for (const m of ['simple', 'tolerance'] as const) {
      const p: ModelParams = { referenceMg: 20, model: m, halfLifeHours: 11, kaPerHour: 1, toleranceRate: 0.12 }
      const a = computeSubstanceDay(doses, model('adderall'), { model: m, toleranceRate: 0.12 }, T0, T0 + 16 * HOUR, 10)
      const b = computeDay(legacy, p, T0, T0 + 16 * HOUR, 10)
      a.forEach((s, i) => {
        expect(s.effect).toBeCloseTo(b[i].effect, 3)
        expect(s.plasma).toBeCloseTo(b[i].plasma, 3)
      })
    }
  })
})

describe('release shapes', () => {
  it('Adderall IR peaks around 3h, XR (two-pulse) around 7h as the label says', () => {
    expect(shapePeak(20, f('adderall', 'IR')).tMax).toBeGreaterThan(2.5)
    expect(shapePeak(20, f('adderall', 'IR')).tMax).toBeLessThan(3.5)
    const xr = shapePeak(20, f('adderall', 'XR')).tMax
    expect(xr).toBeGreaterThan(5.5)
    expect(xr).toBeLessThan(8)
  })

  it('XR peaks lower than the same amount of IR, and lasts longer', () => {
    const ir = shapePeak(20, f('adderall', 'IR')).peak
    const xr = shapePeak(20, f('adderall', 'XR')).peak
    expect(xr).toBeLessThan(ir)
  })

  it('slow release (Concerta style) peaks late and stays near its peak for hours', () => {
    const er = f('methylphenidate', 'ER')
    const { peak, tMax } = shapePeak(36, er)
    expect(tMax).toBeGreaterThan(5)
    expect(tMax).toBeLessThan(11)
    const sub = model('methylphenidate')
    const doses = [{ amount: 36, takenAt: iso(AT), formulation: 'ER' }]
    const s = computeSubstanceDay(doses, sub, { model: 'simple', toleranceRate: 0 }, AT, AT + 16 * HOUR, 10)
    const top = Math.max(...s.map((x) => x.plasma))
    const hoursAbove70 = s.filter((x) => x.plasma >= 0.7 * top).length / 6
    expect(hoursAbove70).toBeGreaterThan(5)
    expect(peak).toBeGreaterThan(0)
  })

  it('Ritalin IR peaks around 2h; Vyvanse around 3.5h', () => {
    const r = shapePeak(10, f('methylphenidate', 'IR')).tMax
    expect(r).toBeGreaterThan(1.5)
    expect(r).toBeLessThan(2.5)
    const v = shapePeak(40, f('vyvanse', 'cap')).tMax
    expect(v).toBeGreaterThan(3)
    expect(v).toBeLessThan(4.5)
  })
})

describe('caffeine', () => {
  const doses = [{ amount: 95, takenAt: iso(AT), formulation: 'drink' }]
  const s = computeSubstanceDay(doses, model('caffeine'), { model: 'tolerance', toleranceRate: 0.12 }, T0, T0 + 20 * HOUR, 5)

  it('peaks within about an hour and a reference cup reads 100', () => {
    expect(argmaxHours(s)).toBeLessThan(1.5)
    expect(Math.max(...s.map((x) => x.plasma))).toBeCloseTo(100, 0)
  })

  it('about half is left five hours after the peak', () => {
    const tPeak = AT + argmaxHours(s) * HOUR
    const later = s.find((x) => x.t >= tPeak + 5 * HOUR)!
    expect(later.plasma).toBeGreaterThan(40)
    expect(later.plasma).toBeLessThan(60)
  })

  it('no acute tolerance, so felt effect equals blood level', () => {
    for (const x of s) expect(x.effect).toBeCloseTo(x.plasma, 9)
  })
})

import { roundDose, splitAmount, splitNote, stepDose } from './substances'

describe('finer doses', () => {
  it('rounds typed amounts to 0.25 mg', () => {
    expect(roundDose(7.3)).toBe(7.25)
    expect(roundDose(2.6)).toBe(2.5)
    expect(roundDose(12.5)).toBe(12.5)
  })

  it('splits scored tablets into the amount actually taken', () => {
    expect(splitAmount(10, 0.5)).toBe(5)
    expect(splitAmount(7.5, 0.25)).toBe(1.875) // exact, never rounded
    expect(splitAmount(20, 1)).toBe(20)
    expect(splitNote({ strengthMg: 10, split: 0.5 })).toBe('½ of 10 mg')
    expect(splitNote({})).toBe('')
  })

  it('steps to the next multiple and never below the minimum', () => {
    expect(stepDose(7.5, 5, 1)).toBe(10)
    expect(stepDose(10, 5, 1)).toBe(15)
    expect(stepDose(12.5, 5, -1)).toBe(10)
    expect(stepDose(1.25, 1.25, -1)).toBe(0.25)
    expect(stepDose(18, 9, 1)).toBe(27)
  })

  it('split options only exist on scored tablets', () => {
    for (const s of SUBSTANCES)
      for (const f of s.formulations)
        for (const x of f.strengths ?? []) {
          if (x.split) expect(['adderall:IR', 'methylphenidate:IR']).toContain(`${s.id}:${f.id}`)
        }
    const ritalin = getSubstance('methylphenidate').formulations.find((f) => f.id === 'IR')!
    expect(ritalin.strengths?.find((x) => x.mg === 5)?.split).toBeUndefined()
  })
})

import { CAFFEINE_METABOLISM } from './substances'
import { levelAt } from './model'

describe('personal half-life', () => {
  const doses = [{ amount: 95, takenAt: iso(T0 + 8 * HOUR), formulation: 'drink' }]
  const bedtime = T0 + 16 * HOUR
  const atBed = (halfLifeHours?: number) => {
    const m = resolveModel(getSubstance('caffeine'), halfLifeHours ? { 'caffeine:drink': { halfLifeHours } } : {})
    return levelAt(computeSubstanceDay(doses, m, { model: 'simple', toleranceRate: 0 }, T0, bedtime, 5), bedtime, 'plasma')
  }

  it('slow metabolism leaves more caffeine at bedtime, fast leaves less', () => {
    const [fast, typical, slow] = CAFFEINE_METABOLISM.map((m) => atBed(m.halfLifeHours))
    expect(typical).toBeCloseTo(atBed(), 6) // Typical equals the preset
    expect(slow).toBeGreaterThan(typical)
    expect(fast).toBeLessThan(typical)
  })

  it('overrides apply only to the formulation they name', () => {
    const m = resolveModel(getSubstance('adderall'), { 'adderall:XR': { halfLifeHours: 9 } })
    expect(m.formulations.XR.halfLifeHours).toBe(9)
    expect(m.formulations.IR.halfLifeHours).toBe(11)
  })
})

describe('added presets match their labels', () => {
  it('Focalin IR peaks at 1 to 1.5 h; Focalin XR has peaks near 1.5 h and 6.5 h', () => {
    const ir = shapePeak(10, f('focalin', 'IR')).tMax
    expect(ir).toBeGreaterThanOrEqual(1)
    expect(ir).toBeLessThanOrEqual(1.5)
    // Two local maxima for XR
    const xr = f('focalin', 'XR')
    const pts = Array.from({ length: 12 * 60 }, (_, i) => i / 60).map((h) => ({ h, v: amountInBody(20, h, xr) }))
    const peaks = pts.filter((p, i) => i > 0 && i < pts.length - 1 && p.v > pts[i - 1].v && p.v >= pts[i + 1].v).map((p) => p.h)
    expect(peaks).toHaveLength(2)
    expect(peaks[0]).toBeGreaterThan(1)
    expect(peaks[0]).toBeLessThan(2)
    expect(peaks[1]).toBeGreaterThan(6)
    expect(peaks[1]).toBeLessThan(7)
  })

  it('Dexedrine IR peaks near 3 h and the Spansule near 8 h', () => {
    expect(shapePeak(10, f('dexedrine', 'IR')).tMax).toBeCloseTo(3, 0)
    expect(Math.abs(shapePeak(15, f('dexedrine', 'spansule')).tMax - 8)).toBeLessThan(0.5)
  })

  it('Mydayis peaks near 8 h', () => {
    expect(Math.abs(shapePeak(25, f('mydayis', 'cap')).tMax - 8)).toBeLessThan(0.5)
  })
})

describe('once-daily flags', () => {
  it('flags every long-acting formulation and no immediate-release one', () => {
    for (const sub of SUBSTANCES)
      for (const f of sub.formulations) {
        const longActing = f.shape.kind !== 'single' || f.halfLifeHours >= 10 && f.kaPerHour < 0.9 || ['spansule', 'ER'].includes(f.id)
        if (sub.id === 'caffeine') expect(f.onceDaily).toBeUndefined()
        else expect(!!f.onceDaily).toBe(longActing)
      }
  })
})
