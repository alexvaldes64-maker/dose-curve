// All effect-curve math lives here. Pure functions only: no DOM, no Dexie.
// Times are epoch milliseconds unless a name says hours.

export type ModelKind = 'simple' | 'tolerance'

export interface DoseLike {
  mg: number
  takenAt: string // ISO timestamp
}

export interface ModelParams {
  referenceMg: number
  model: ModelKind
  halfLifeHours: number
  kaPerHour: number
  toleranceRate: number
}

export const HOUR = 3_600_000
export const MINUTE = 60_000

/** Display range for the curve's horizontal axis, in percent of a typical peak. */
export const DISPLAY_MAX = 120
export const clampDisplay = (v: number) => Math.min(DISPLAY_MAX, Math.max(0, v))

// ---------------------------------------------------------------------------
// Simple time-based model
// ---------------------------------------------------------------------------

/** (hours since dose, percent of a reference dose's peak) */
export const SIMPLE_KNOTS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.5, 15],
  [1, 60],
  [1.5, 90],
  [2.5, 100],
  [3.5, 85],
  [5, 45],
  [6, 15],
  [7, 5],
  [8, 0],
]

/**
 * Fritsch-Carlson monotone cubic Hermite interpolator. Never overshoots the
 * knots, so the curve can't dip below 0 or bulge past a knot's value.
 */
export function monotoneCubic(knots: ReadonlyArray<readonly [number, number]>) {
  const n = knots.length
  const xs = knots.map((k) => k[0])
  const ys = knots.map((k) => k[1])
  const d: number[] = [] // secant slopes
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))

  const m: number[] = new Array(n).fill(0)
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2

  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[i] = t * a * d[i]
      m[i + 1] = t * b * d[i]
    }
  }

  return (x: number): number => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i]
    const t = (x - xs[i]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    )
  }
}

const simpleInterp = monotoneCubic(SIMPLE_KNOTS)
const SIMPLE_END = SIMPLE_KNOTS[SIMPLE_KNOTS.length - 1][0]

/** Effect percent of one reference-sized dose, `h` hours after taking it. */
export function simpleEffect(h: number): number {
  if (h <= 0 || h >= SIMPLE_END) return 0
  return Math.max(0, simpleInterp(h))
}

/** Summed simple-model effect at time `t`, scaled per dose by mg / referenceMg. */
export function simpleEffectAt(doses: DoseLike[], t: number, referenceMg: number): number {
  let sum = 0
  for (const d of doses) {
    sum += simpleEffect((t - Date.parse(d.takenAt)) / HOUR) * (d.mg / referenceMg)
  }
  return sum
}

// ---------------------------------------------------------------------------
// Tolerance-adjusted model (one-compartment oral PK + acute tolerance)
// ---------------------------------------------------------------------------

export const keFromHalfLife = (halfLifeHours: number) => Math.LN2 / halfLifeHours

/** Bateman function: relative plasma amount `t` hours after an oral dose of `mg`. */
export function plasma(mg: number, tHours: number, ka: number, ke: number): number {
  if (tHours <= 0) return 0
  if (Math.abs(ka - ke) < 1e-9) return mg * ka * tHours * Math.exp(-ke * tHours)
  return ((mg * ka) / (ka - ke)) * (Math.exp(-ke * tHours) - Math.exp(-ka * tHours))
}

/** Hours to peak for a single dose. */
export function tMax(ka: number, ke: number): number {
  if (Math.abs(ka - ke) < 1e-9) return 1 / ka
  return Math.log(ka / ke) / (ka - ke)
}

/** Peak plasma of a single reference dose; used to normalize so 100 = typical peak. */
export function referencePeak(referenceMg: number, ka: number, ke: number): number {
  return plasma(referenceMg, tMax(ka, ke), ka, ke)
}

/** Normalized plasma (1 = typical peak) at `t`, summed over every dose given. */
export function normalizedPlasmaAt(doses: DoseLike[], t: number, p: ModelParams): number {
  const ka = p.kaPerHour
  const ke = keFromHalfLife(p.halfLifeHours)
  let sum = 0
  for (const d of doses) sum += plasma(d.mg, (t - Date.parse(d.takenAt)) / HOUR, ka, ke)
  return sum / referencePeak(p.referenceMg, ka, ke)
}

/**
 * Acute tolerance factor. 1 until the day's first dose, then decays
 * exponentially with hours since that dose. `firstDoseToday` is null when no
 * dose has been taken since the day began (wake time).
 */
export function toleranceFactor(t: number, firstDoseToday: number | null, rate: number): number {
  if (firstDoseToday === null || t <= firstDoseToday) return 1
  return Math.exp((-rate * (t - firstDoseToday)) / HOUR)
}

/** Earliest dose in [dayStart, dayStart + 24h), or null. */
export function firstDoseInDay(doses: DoseLike[], dayStart: number): number | null {
  let first: number | null = null
  for (const d of doses) {
    const t = Date.parse(d.takenAt)
    if (t >= dayStart && t < dayStart + 24 * HOUR && (first === null || t < first)) first = t
  }
  return first
}

// ---------------------------------------------------------------------------
// Combined evaluation
// ---------------------------------------------------------------------------

export interface Sample {
  t: number
  /** Active model's effect, percent of typical peak (unclamped). */
  effect: number
  /** Normalized plasma, percent of typical peak. */
  plasma: number
  /** Effect with the curve shifted 45 min earlier / later (uncertainty band). */
  early: number
  late: number
}

export const BAND_SHIFT = 45 * MINUTE

/** Effect of the active model at time `t`. `dayStart` is the wake time that resets tolerance. */
export function effectAt(doses: DoseLike[], t: number, p: ModelParams, dayStart: number): number {
  if (p.model === 'simple') return simpleEffectAt(doses, t, p.referenceMg)
  const first = firstDoseInDay(doses, dayStart)
  return normalizedPlasmaAt(doses, t, p) * toleranceFactor(t, first, p.toleranceRate) * 100
}

export function plasmaPercentAt(doses: DoseLike[], t: number, p: ModelParams): number {
  return normalizedPlasmaAt(doses, t, p) * 100
}

/**
 * Sample the day from `start` to `end`. Pass every dose that could still be
 * active (e.g. the previous 48h); doses outside the window still contribute.
 */
export function computeDay(
  doses: DoseLike[],
  p: ModelParams,
  start: number,
  end: number,
  stepMin = 5,
): Sample[] {
  const step = stepMin * MINUTE
  const out: Sample[] = []
  for (let t = start; t <= end + 1; t += step) {
    out.push({
      t,
      effect: effectAt(doses, t, p, start),
      plasma: plasmaPercentAt(doses, t, p),
      early: effectAt(doses, t + BAND_SHIFT, p, start),
      late: effectAt(doses, t - BAND_SHIFT, p, start),
    })
  }
  return out
}

/** Linear interpolation of a sample field at time `t`. */
export function levelAt(samples: Sample[], t: number, key: 'effect' | 'plasma' = 'effect'): number {
  if (!samples.length) return 0
  if (t <= samples[0].t) return samples[0][key]
  for (let i = 1; i < samples.length; i++) {
    const b = samples[i]
    if (t <= b.t) {
      const a = samples[i - 1]
      const f = (t - a.t) / (b.t - a.t)
      return a[key] + (b[key] - a[key]) * f
    }
  }
  return samples[samples.length - 1][key]
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

export type Phase = 'Onset' | 'Peak' | 'Taper' | 'Comedown' | 'Clear'

export interface PhaseSegment {
  phase: Phase
  start: number
  end: number
}

const MIN_SEGMENT = 10 * MINUTE

/**
 * Label each sample relative to the day's max M, then merge into segments.
 * - Clear: below 10% of M
 * - Peak: at or above 80%
 * - Onset: rising, 10% to 80% (spec says 10 to 70; the 70 to 80 rising gap is folded in)
 * - Taper: falling, 40% to 80%
 * - Comedown: falling, 10% to 40%
 * Flat stretches keep the previous label. Segments under 10 minutes are absorbed
 * into their neighbor to avoid flicker.
 */
export function phases(samples: Sample[]): PhaseSegment[] {
  if (!samples.length) return []
  const max = Math.max(...samples.map((s) => s.effect))
  const first = samples[0].t
  const last = samples[samples.length - 1].t
  if (max < 1e-6) return [{ phase: 'Clear', start: first, end: last }]

  const labels: Phase[] = []
  for (let i = 0; i < samples.length; i++) {
    const r = samples[i].effect / max
    const prev = samples[Math.max(0, i - 1)].effect
    const next = samples[Math.min(samples.length - 1, i + 1)].effect
    const slope = next - prev
    let label: Phase
    if (r < 0.1) label = 'Clear'
    else if (r >= 0.8) label = 'Peak'
    else if (slope > 1e-9) label = 'Onset'
    else if (slope < -1e-9) label = r >= 0.4 ? 'Taper' : 'Comedown'
    else label = labels[i - 1] ?? 'Clear'
    labels.push(label)
  }

  let segs: PhaseSegment[] = []
  for (let i = 0; i < samples.length; i++) {
    const cur = segs[segs.length - 1]
    if (cur && cur.phase === labels[i]) cur.end = samples[i].t
    else segs.push({ phase: labels[i], start: samples[i].t, end: samples[i].t })
  }
  // Make segments contiguous: each ends where the next starts.
  for (let i = 0; i < segs.length - 1; i++) segs[i].end = segs[i + 1].start

  // Absorb short segments into the previous one (or the next, if first).
  let changed = true
  while (changed && segs.length > 1) {
    changed = false
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]
      if (s.end - s.start >= MIN_SEGMENT) continue
      if (i > 0) segs[i - 1].end = s.end
      else segs[1].start = s.start
      segs.splice(i, 1)
      changed = true
      break
    }
    // Re-merge equal neighbors.
    const merged: PhaseSegment[] = []
    for (const s of segs) {
      const prev = merged[merged.length - 1]
      if (prev && prev.phase === s.phase) prev.end = s.end
      else merged.push({ ...s })
    }
    segs = merged
  }
  return segs
}

export function phaseAt(segs: PhaseSegment[], t: number): Phase {
  for (const s of segs) if (t >= s.start && t <= s.end) return s.phase
  return 'Clear'
}

// ---------------------------------------------------------------------------
// Presets: release shapes and multi-formulation substances
// ---------------------------------------------------------------------------

/** How a formulation releases its dose into the gut. */
export type ReleaseShape =
  | { kind: 'single' }
  /** Two bead types: `firstFraction` now, the rest `delayHours` later (e.g. Adderall XR). */
  | { kind: 'two-pulse'; firstFraction: number; delayHours: number }
  /** Immediate overcoat `immediateFraction`, the rest released evenly over `durationHours` (e.g. OROS). */
  | { kind: 'slow'; immediateFraction: number; durationHours: number }

export interface FormulationModel {
  halfLifeHours: number
  kaPerHour: number
  shape: ReleaseShape
  /** Optional time-based effect knots (simple model). Without them the simple model uses the plasma shape. */
  knots?: ReadonlyArray<readonly [number, number]>
}

export interface SubstanceModel {
  /** Formulations by id. */
  formulations: Record<string, FormulationModel>
  /** Formulation and amount whose peak defines 100%. */
  reference: { formulation: string; amount: number }
  /** Whether acute (same-day) tolerance applies. */
  acuteTolerance: boolean
}

export interface SubstanceDose {
  amount: number
  takenAt: string
  formulation: string
}

/** Zero-order release over `D` hours straight into circulation, then first-order elimination. */
function infusion(amount: number, t: number, D: number, ke: number): number {
  if (t <= 0 || D <= 0) return 0
  const R = amount / D
  if (t <= D) return (R / ke) * (1 - Math.exp(-ke * t))
  return (R / ke) * (1 - Math.exp(-ke * D)) * Math.exp(-ke * (t - D))
}

/** Relative amount in circulation `tHours` after a dose with the given release shape. */
export function amountInBody(amount: number, tHours: number, f: FormulationModel): number {
  const ka = f.kaPerHour
  const ke = keFromHalfLife(f.halfLifeHours)
  const s = f.shape
  switch (s.kind) {
    case 'single':
      return plasma(amount, tHours, ka, ke)
    case 'two-pulse':
      return plasma(amount * s.firstFraction, tHours, ka, ke) + plasma(amount * (1 - s.firstFraction), tHours - s.delayHours, ka, ke)
    case 'slow':
      return plasma(amount * s.immediateFraction, tHours, ka, ke) + infusion(amount * (1 - s.immediateFraction), tHours, s.durationHours, ke)
  }
}

const peakCache = new Map<string, { peak: number; tMax: number }>()

/** Peak and time to peak of one dose, found numerically (works for every shape). */
export function shapePeak(amount: number, f: FormulationModel): { peak: number; tMax: number } {
  const key = JSON.stringify([amount, f.halfLifeHours, f.kaPerHour, f.shape])
  const hit = peakCache.get(key)
  if (hit) return hit
  let peak = 0
  let at = 0
  for (let h = 0; h <= 48; h += 1 / 60) {
    const v = amountInBody(amount, h, f)
    if (v > peak) {
      peak = v
      at = h
    }
  }
  const res = { peak, tMax: at }
  peakCache.set(key, res)
  return res
}

/** Knot-based effect for one dose, following the release shape (two pulses become two knot curves). */
function knotEffect(d: SubstanceDose, h: number, f: FormulationModel, refAmount: number): number {
  const scale = d.amount / refAmount
  const s = f.shape
  if (s.kind === 'two-pulse') return scale * (s.firstFraction * simpleEffect(h) + (1 - s.firstFraction) * simpleEffect(h - s.delayHours))
  return scale * simpleEffect(h)
}

export interface SubstanceOptions {
  model: ModelKind
  toleranceRate: number
}

/** Effect and plasma percent of one substance at time `t`. 100 = peak of the reference dose. */
export function substanceAt(doses: SubstanceDose[], t: number, sub: SubstanceModel, opts: SubstanceOptions, dayStart: number) {
  const ref = sub.formulations[sub.reference.formulation]
  const refPeak = shapePeak(sub.reference.amount, ref).peak
  let plasmaSum = 0
  let knotSum = 0
  for (const d of doses) {
    const f = sub.formulations[d.formulation] ?? ref
    const h = (t - Date.parse(d.takenAt)) / HOUR
    const p = amountInBody(d.amount, h, f) / refPeak
    plasmaSum += p
    knotSum += f.knots ? knotEffect(d, h, f, sub.reference.amount) : p * 100
  }
  const plasmaPct = plasmaSum * 100
  if (opts.model === 'simple') return { effect: knotSum, plasma: plasmaPct }
  const tf = sub.acuteTolerance
    ? toleranceFactor(t, firstDoseInDay(doses.map((d) => ({ mg: d.amount, takenAt: d.takenAt })), dayStart), opts.toleranceRate)
    : 1
  return { effect: plasmaPct * tf, plasma: plasmaPct }
}

/** Sample one substance across [start, end]. */
export function computeSubstanceDay(
  doses: SubstanceDose[],
  sub: SubstanceModel,
  opts: SubstanceOptions,
  start: number,
  end: number,
  stepMin = 5,
): Sample[] {
  const step = stepMin * MINUTE
  const out: Sample[] = []
  for (let t = start; t <= end + 1; t += step) {
    const now = substanceAt(doses, t, sub, opts, start)
    out.push({
      t,
      effect: now.effect,
      plasma: now.plasma,
      early: substanceAt(doses, t + BAND_SHIFT, sub, opts, start).effect,
      late: substanceAt(doses, t - BAND_SHIFT, sub, opts, start).effect,
    })
  }
  return out
}
