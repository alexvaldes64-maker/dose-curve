import { describe, expect, it } from 'vitest'
import {
  HOUR,
  MINUTE,
  SIMPLE_KNOTS,
  computeDay,
  effectAt,
  firstDoseInDay,
  keFromHalfLife,
  monotoneCubic,
  normalizedPlasmaAt,
  phases,
  plasma,
  referencePeak,
  simpleEffect,
  simpleEffectAt,
  tMax,
  toleranceFactor,
  type DoseLike,
  type ModelParams,
} from './model'

const T0 = Date.UTC(2026, 9, 6, 7, 0) // day start (wake)
const DOSE_AT = T0 + 2.5 * HOUR
const iso = (t: number) => new Date(t).toISOString()

const base: Omit<ModelParams, 'model'> = {
  referenceMg: 20,
  halfLifeHours: 11,
  kaPerHour: 1.0,
  toleranceRate: 0.12,
}
const simple: ModelParams = { ...base, model: 'simple' }
const tolerance: ModelParams = { ...base, model: 'tolerance' }

function argmaxHours(doses: DoseLike[], p: ModelParams, key: 'effect' | 'plasma' = 'effect') {
  const samples = computeDay(doses, p, T0, T0 + 16 * HOUR, 1)
  let best = samples[0]
  for (const s of samples) if (s[key] > best[key]) best = s
  return (best.t - DOSE_AT) / HOUR
}

describe('simple model', () => {
  it('interpolator passes through every knot', () => {
    for (const [h, v] of SIMPLE_KNOTS) expect(simpleEffect(h)).toBeCloseTo(v, 6)
  })

  it('interpolator is monotone between knots (no overshoot)', () => {
    const f = monotoneCubic(SIMPLE_KNOTS)
    for (let i = 0; i < SIMPLE_KNOTS.length - 1; i++) {
      const [x0, y0] = SIMPLE_KNOTS[i]
      const [x1, y1] = SIMPLE_KNOTS[i + 1]
      let prev = y0
      for (let k = 1; k <= 20; k++) {
        const y = f(x0 + ((x1 - x0) * k) / 20)
        if (y1 >= y0) expect(y).toBeGreaterThanOrEqual(prev - 1e-9)
        else expect(y).toBeLessThanOrEqual(prev + 1e-9)
        prev = y
      }
    }
  })

  it('single 20mg dose peaks between 1.5 and 3 hours', () => {
    const h = argmaxHours([{ mg: 20, takenAt: iso(DOSE_AT) }], simple)
    expect(h).toBeGreaterThanOrEqual(1.5)
    expect(h).toBeLessThanOrEqual(3)
  })

  it('effect is under 20% by hour 7', () => {
    const doses = [{ mg: 20, takenAt: iso(DOSE_AT) }]
    expect(simpleEffectAt(doses, DOSE_AT + 7 * HOUR, 20)).toBeLessThan(20)
  })

  it('scales by mg / referenceMg', () => {
    const t = DOSE_AT + 2.5 * HOUR
    expect(simpleEffectAt([{ mg: 10, takenAt: iso(DOSE_AT) }], t, 20)).toBeCloseTo(50, 6)
  })

  it('two doses sum correctly', () => {
    const a = { mg: 20, takenAt: iso(DOSE_AT) }
    const b = { mg: 10, takenAt: iso(DOSE_AT + 3 * HOUR) }
    for (let m = 0; m <= 12 * 60; m += 17) {
      const t = DOSE_AT + m * MINUTE
      const both = effectAt([a, b], t, simple, T0)
      expect(both).toBeCloseTo(effectAt([a], t, simple, T0) + effectAt([b], t, simple, T0), 9)
    }
  })
})

describe('tolerance model', () => {
  const ka = base.kaPerHour
  const ke = keFromHalfLife(base.halfLifeHours)

  it('plasma is zero before the dose', () => {
    expect(plasma(20, -1, ka, ke)).toBe(0)
    expect(plasma(20, 0, ka, ke)).toBe(0)
  })

  it('a reference dose normalizes to 100 at its peak', () => {
    const doses = [{ mg: 20, takenAt: iso(DOSE_AT) }]
    expect(normalizedPlasmaAt(doses, DOSE_AT + tMax(ka, ke) * HOUR, tolerance) * 100).toBeCloseTo(100, 6)
    expect(referencePeak(20, ka, ke)).toBeGreaterThan(0)
  })

  it('single 20mg dose peaks between 1.5 and 3 hours (felt and plasma)', () => {
    const doses = [{ mg: 20, takenAt: iso(DOSE_AT) }]
    const felt = argmaxHours(doses, tolerance, 'effect')
    const pl = argmaxHours(doses, tolerance, 'plasma')
    expect(felt).toBeGreaterThanOrEqual(1.5)
    expect(felt).toBeLessThanOrEqual(3)
    expect(pl).toBeGreaterThanOrEqual(1.5)
    expect(pl).toBeLessThanOrEqual(3)
    expect(felt).toBeLessThan(pl) // felt effect fades before blood levels
  })

  it('two doses sum by superposition, scaled by the shared tolerance factor', () => {
    const a = { mg: 20, takenAt: iso(DOSE_AT) }
    const b = { mg: 10, takenAt: iso(DOSE_AT + 3 * HOUR) }
    for (let m = 0; m <= 12 * 60; m += 17) {
      const t = DOSE_AT + m * MINUTE
      const pa = normalizedPlasmaAt([a], t, tolerance)
      const pb = normalizedPlasmaAt([b], t, tolerance)
      expect(normalizedPlasmaAt([a, b], t, tolerance)).toBeCloseTo(pa + pb, 12)
      const tf = toleranceFactor(t, DOSE_AT, base.toleranceRate)
      expect(effectAt([a, b], t, tolerance, T0)).toBeCloseTo((pa + pb) * tf * 100, 9)
    }
  })

  it("counts yesterday's doses in plasma but not in today's tolerance clock", () => {
    const yesterday = { mg: 20, takenAt: iso(T0 - 14 * HOUR) }
    expect(normalizedPlasmaAt([yesterday], T0, tolerance)).toBeGreaterThan(0)
    expect(firstDoseInDay([yesterday], T0)).toBeNull()
    expect(toleranceFactor(T0 + HOUR, null, 0.12)).toBe(1)
  })
})

describe('phases', () => {
  it('one dose yields Onset, Peak, Taper, Comedown, Clear in order', () => {
    const doses = [{ mg: 20, takenAt: iso(DOSE_AT) }]
    const samples = computeDay(doses, simple, DOSE_AT, DOSE_AT + 10 * HOUR, 5)
    const order = phases(samples).map((s) => s.phase)
    expect(order).toEqual(['Clear', 'Onset', 'Peak', 'Taper', 'Comedown', 'Clear'])
  })

  it('no doses is all Clear', () => {
    const samples = computeDay([], simple, T0, T0 + 16 * HOUR)
    expect(phases(samples)).toEqual([{ phase: 'Clear', start: T0, end: T0 + 16 * HOUR }])
  })
})
