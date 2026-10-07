// Presets: each substance and formulation fills in half-life, absorption speed and release shape.
// Values are label or reference averages, rounded. Sources are listed per preset and shown in Learn.

import { SIMPLE_KNOTS, type FormulationModel, type SubstanceModel } from './model'

export interface Source {
  label: string
  url: string
}

/** A marketed strength. `split` lists the pieces the label's score lines allow (scored tablets only). */
export interface Strength {
  mg: number
  split?: (0.5 | 0.25)[]
}

export interface FormulationPreset extends FormulationModel {
  id: string
  label: string
  /** One line on how it releases, shown in the picker and Learn. */
  blurb: string
  /** Stepper increment for this formulation, if different from the substance's. */
  step?: number
  /** Strengths from the FDA label (DOSAGE FORMS AND STRENGTHS). */
  strengths?: Strength[]
  /** Long-acting, labeled for once a day: the "already logged" check looks at the whole day, not 3 hours. */
  onceDaily?: boolean
}

/** Round a typed or computed amount to the nearest 0.25 mg. */
export const roundDose = (mg: number) => Math.round(mg * 4) / 4

/** Amount actually taken from a strength and a split (1 = whole). Exact, not rounded: a quarter of 7.5 mg is 1.875 mg. */
export const splitAmount = (strengthMg: number, split: 1 | 0.5 | 0.25) => Math.round(strengthMg * split * 1000) / 1000

/** Step to the next multiple of `step` in direction `dir`, so 7.5 up by 5 gives 10, not 12.5. Never below `min`. */
export function stepDose(value: number, step: number, dir: 1 | -1, min = 0.25): number {
  const next = dir > 0 ? Math.floor(value / step + 1e-9) * step + step : Math.ceil(value / step - 1e-9) * step - step
  return roundDose(Math.max(min, next))
}

export const SPLIT_LABEL: Record<0.5 | 0.25, string> = { 0.5: '½', 0.25: '¼' }

export interface SubstancePreset extends Omit<SubstanceModel, 'formulations'> {
  id: string
  name: string
  /** Shown under the name, e.g. the generic. */
  detail: string
  color: string
  unit: 'mg'
  defaultAmount: number
  step: number
  formulations: FormulationPreset[]
  /** Quick amounts, e.g. a cup of coffee. */
  quick?: { label: string; amount: number }[]
  sources: Source[]
}

const DAILYMED_ADDERALL_XR = 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=aff45863-ffe1-4d4f-8acf-c7081512a6c0'
const DAILYMED_ADDERALL_IR = 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=f22635fe-821d-4cde-aa12-419f8b53db81'
const DAILYMED_VYVANSE = 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=704e4378-ca83-445c-8b45-3cfa51c1ecad'
const DAILYMED_RITALIN = 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d6fb2750-cdab-4749-ba0d-7534840a5892'
const DAILYMED_CONCERTA = 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1a88218c-5b18-4220-8f56-526de1a276cd'
const DAILYMED_FOCALIN = 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2016f5c2-95d2-4655-af65-c588c2bf5e6d'
const DAILYMED_FOCALIN_XR = 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=1a1da905-42a0-4748-9c39-67eca45deccc'
const DAILYMED_DEXEDRINE = 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=cc717b9b-22ea-4c60-a1d4-ee38a40bce78'
const DAILYMED_MYDAYIS = 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=141a7970-3f06-44ea-9ab7-aeece2c085fc'

/** Adderall IR tablets are all scored (label: full and partial bisects). */
const ADDERALL_IR_STRENGTHS: Strength[] = [5, 7.5, 10, 12.5, 15, 20, 30].map((mg) => ({ mg, split: [0.5, 0.25] }))

export const SUBSTANCES: SubstancePreset[] = [
  {
    id: 'adderall',
    name: 'Adderall',
    detail: 'Amphetamine salts',
    color: '#5E5CE6',
    unit: 'mg',
    defaultAmount: 20,
    step: 2.5,
    acuteTolerance: true,
    reference: { formulation: 'IR', amount: 20 },
    formulations: [
      {
        id: 'IR',
        label: 'IR',
        blurb: 'Immediate release. Peaks around 3 hours.',
        step: 1.25,
        strengths: ADDERALL_IR_STRENGTHS,
        halfLifeHours: 11,
        kaPerHour: 1.0,
        shape: { kind: 'single' },
        knots: SIMPLE_KNOTS,
      },
      {
        id: 'XR',
        label: 'XR',
        blurb: 'Two bead types: half now, half about 4 hours later. Peaks around 7 hours.',
        onceDaily: true,
        step: 5,
        strengths: [5, 10, 15, 20, 25, 30].map((mg) => ({ mg })),
        halfLifeHours: 11,
        kaPerHour: 1.0,
        shape: { kind: 'two-pulse', firstFraction: 0.5, delayHours: 4 },
        knots: SIMPLE_KNOTS,
      },
    ],
    sources: [
      { label: 'Adderall prescribing information (DailyMed)', url: DAILYMED_ADDERALL_IR },
      { label: 'Adderall XR prescribing information (DailyMed)', url: DAILYMED_ADDERALL_XR },
    ],
  },
  {
    id: 'vyvanse',
    name: 'Vyvanse',
    detail: 'Lisdexamfetamine',
    color: '#30B0C7',
    unit: 'mg',
    defaultAmount: 30,
    step: 5,
    acuteTolerance: true,
    reference: { formulation: 'cap', amount: 40 },
    formulations: [
      {
        id: 'cap',
        label: 'Capsule',
        blurb: 'Converted to dextroamphetamine in the body, so it builds gradually. Blood levels peak around 3.5 hours.',
        onceDaily: true,
        strengths: [10, 20, 30, 40, 50, 60, 70].map((mg) => ({ mg })),
        halfLifeHours: 12,
        kaPerHour: 0.8,
        shape: { kind: 'single' },
      },
    ],
    sources: [
      { label: 'Vyvanse prescribing information (DailyMed)', url: DAILYMED_VYVANSE },
      { label: 'Vyvanse pharmacokinetics', url: 'https://medlibrary.org/lib/rx/meds/vyvanse-1/page/5/' },
    ],
  },
  {
    id: 'methylphenidate',
    name: 'Ritalin / Concerta',
    detail: 'Methylphenidate',
    color: '#FF2D55',
    unit: 'mg',
    defaultAmount: 10,
    step: 5,
    acuteTolerance: true,
    reference: { formulation: 'IR', amount: 10 },
    formulations: [
      {
        id: 'IR',
        label: 'IR',
        blurb: 'Immediate release (Ritalin). Peaks around 2 hours, short half-life.',
        step: 2.5,
        strengths: [{ mg: 5 }, { mg: 10, split: [0.5] }, { mg: 20, split: [0.5] }],
        halfLifeHours: 2.1,
        kaPerHour: 0.8,
        shape: { kind: 'single' },
      },
      {
        id: 'ER',
        label: 'ER',
        blurb: 'Slow release (Concerta style): about 22% right away, the rest released steadily over about 10 hours.',
        onceDaily: true,
        step: 9,
        strengths: [18, 27, 36, 54].map((mg) => ({ mg })),
        halfLifeHours: 3.5,
        kaPerHour: 0.8,
        shape: { kind: 'slow', immediateFraction: 0.22, durationHours: 10 },
      },
    ],
    sources: [
      { label: 'Ritalin prescribing information (DailyMed)', url: DAILYMED_RITALIN },
      { label: 'Concerta prescribing information (DailyMed)', url: DAILYMED_CONCERTA },
      { label: 'Ritalin pharmacokinetics (FDA)', url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2013/010187s077lbl.pdf' },
      { label: 'Concerta pharmacokinetics', url: 'https://medlibrary.org/lib/rx/meds/concerta-1/page/5/' },
    ],
  },
  {
    id: 'focalin',
    name: 'Focalin',
    detail: 'Dexmethylphenidate',
    color: '#BF5AF2',
    unit: 'mg',
    defaultAmount: 10,
    step: 2.5,
    acuteTolerance: true,
    reference: { formulation: 'IR', amount: 10 },
    formulations: [
      {
        id: 'IR',
        label: 'IR',
        blurb: 'Immediate release tablet. Peaks around 1 to 1.5 hours, half-life about 2.2 hours.',
        step: 2.5,
        strengths: [2.5, 5, 10].map((mg) => ({ mg })),
        halfLifeHours: 2.2,
        kaPerHour: 1.6,
        shape: { kind: 'single' },
      },
      {
        id: 'XR',
        label: 'XR',
        blurb: 'Half immediate, half delayed beads: a first peak around 1.5 hours and a second around 6.5 hours.',
        onceDaily: true,
        step: 5,
        strengths: [5, 10, 15, 20, 25, 30, 35, 40].map((mg) => ({ mg })),
        halfLifeHours: 3,
        kaPerHour: 1.5,
        shape: { kind: 'two-pulse', firstFraction: 0.5, delayHours: 5 },
      },
    ],
    sources: [
      { label: 'Focalin prescribing information (DailyMed)', url: DAILYMED_FOCALIN },
      { label: 'Focalin XR prescribing information (DailyMed)', url: DAILYMED_FOCALIN_XR },
    ],
  },
  {
    id: 'dexedrine',
    name: 'Dexedrine',
    detail: 'Dextroamphetamine',
    color: '#FF6482',
    unit: 'mg',
    defaultAmount: 10,
    step: 2.5,
    acuteTolerance: true,
    reference: { formulation: 'IR', amount: 10 },
    formulations: [
      {
        id: 'IR',
        label: 'IR',
        blurb: 'Immediate release tablet. Peaks around 3 hours, half-life about 12 hours.',
        step: 2.5,
        halfLifeHours: 12,
        kaPerHour: 1.0,
        shape: { kind: 'single' },
      },
      {
        id: 'spansule',
        label: 'Spansule',
        blurb: 'Part released right away, the rest gradually. The label gives a peak around 8 hours; the curve is fitted to that peak and the 12 hour half-life.',
        onceDaily: true,
        step: 5,
        strengths: [5, 10, 15].map((mg) => ({ mg })),
        halfLifeHours: 12,
        kaPerHour: 0.23,
        shape: { kind: 'single' },
      },
    ],
    sources: [{ label: 'Dexedrine Spansule prescribing information (DailyMed)', url: DAILYMED_DEXEDRINE }],
  },
  {
    id: 'mydayis',
    name: 'Mydayis',
    detail: 'Amphetamine salts, three bead types',
    color: '#32ADE6',
    unit: 'mg',
    defaultAmount: 25,
    step: 12.5,
    acuteTolerance: true,
    reference: { formulation: 'cap', amount: 25 },
    formulations: [
      {
        id: 'cap',
        label: 'Capsule',
        blurb: 'One immediate and two delayed bead types. The label gives a peak around 8 hours in adults; the curve is fitted to that peak and an 11 hour half-life. Its milligrams do not match other amphetamine products.',
        onceDaily: true,
        strengths: [12.5, 25, 37.5, 50].map((mg) => ({ mg })),
        halfLifeHours: 11,
        kaPerHour: 0.22,
        shape: { kind: 'single' },
      },
    ],
    sources: [{ label: 'Mydayis prescribing information (DailyMed)', url: DAILYMED_MYDAYIS }],
  },
  {
    id: 'caffeine',
    name: 'Caffeine',
    detail: 'Coffee, tea, energy drinks',
    color: '#A2845E',
    unit: 'mg',
    defaultAmount: 95,
    step: 5,
    acuteTolerance: false,
    reference: { formulation: 'drink', amount: 95 },
    formulations: [
      {
        id: 'drink',
        label: 'Drink',
        blurb: 'Absorbed fast, peaks within about an hour. Half-life about 5 hours, so half of it is still around 5 hours later.',
        halfLifeHours: 5,
        kaPerHour: 4,
        shape: { kind: 'single' },
      },
    ],
    quick: [
      { label: 'Coffee', amount: 95 },
      { label: 'Espresso', amount: 63 },
      { label: 'Black tea', amount: 47 },
      { label: 'Energy drink', amount: 80 },
      { label: 'Cold brew', amount: 200 },
    ],
    sources: [
      { label: 'Pharmacology of caffeine (National Academies, NCBI Bookshelf)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK223808/' },
      { label: 'FDA: How much caffeine is too much?', url: 'https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much' },
    ],
  },
]

export const DEFAULT_SUBSTANCE = 'adderall'

export function getSubstance(id: string | undefined): SubstancePreset {
  return SUBSTANCES.find((s) => s.id === id) ?? SUBSTANCES[0]
}

export function getFormulation(sub: SubstancePreset, id: string | undefined): FormulationPreset {
  return sub.formulations.find((f) => f.id === id) ?? sub.formulations[0]
}

/** "20 mg Adderall XR", "95 mg caffeine". */
/** "½ of a 10 mg tablet" style suffix, if the dose was split. */
export function splitNote(d: { strengthMg?: number; split?: 0.5 | 0.25 }): string {
  return d.split && d.strengthMg ? `${SPLIT_LABEL[d.split]} of ${d.strengthMg} mg` : ''
}

export function doseName(d: { substance?: string; formulation: string; mg: number }): string {
  const sub = getSubstance(d.substance)
  if (sub.id === 'caffeine') return `${d.mg} mg caffeine`
  if (sub.id === 'methylphenidate') return d.formulation === 'ER' ? `${d.mg} mg methylphenidate ER` : `${d.mg} mg Ritalin`
  const form = getFormulation(sub, d.formulation)
  const formText = form.id === 'cap' ? '' : ` ${form.label}`
  return `${d.mg} mg ${sub.name.split(' / ')[0]}${formText}`
}

/** Caffeine metabolism choices. Typical matches the preset; the others sit inside the cited 1.5 to 9.5 hour range. */
export const CAFFEINE_METABOLISM = [
  { id: 'fast', label: 'Fast', halfLifeHours: 3 },
  { id: 'typical', label: 'Typical', halfLifeHours: 5 },
  { id: 'slow', label: 'Slow', halfLifeHours: 8 },
] as const

export const CAFFEINE_METABOLISM_NOTE =
  'Caffeine half-life averages about 5 hours but ranges from about 1.5 to 9.5 hours between people. The reference lists pregnancy, oral contraceptives and obesity among things linked to slower clearance, and smoking with faster clearance.'

export interface Override {
  halfLifeHours?: number
  kaPerHour?: number
}
export type Overrides = Record<string, Override>
export const overrideKey = (substance: string, formulation: string) => `${substance}:${formulation}`

/** The model for a substance with any user overrides applied per formulation. */
export function resolveModel(sub: SubstancePreset, overrides: Overrides = {}): SubstanceModel {
  const formulations: SubstanceModel['formulations'] = {}
  for (const f of sub.formulations) {
    const o = overrides[overrideKey(sub.id, f.id)] ?? {}
    formulations[f.id] = {
      halfLifeHours: o.halfLifeHours ?? f.halfLifeHours,
      kaPerHour: o.kaPerHour ?? f.kaPerHour,
      shape: f.shape,
      knots: f.knots,
    }
  }
  return { formulations, reference: sub.reference, acuteTolerance: sub.acuteTolerance }
}

// ---------------------------------------------------------------------------
// What not to mix (shown in Learn). Informational only.
// ---------------------------------------------------------------------------

export interface Interaction {
  pair: string
  why: string
  sources: Source[]
}

export const INTERACTIONS: Interaction[] = [
  {
    pair: 'Stimulants and alcohol',
    why: 'The US alcohol research institute lists ADHD stimulants among medicines that react with alcohol: a possible higher risk of heart problems with amphetamines (Adderall, Vyvanse, Dexedrine, Mydayis) and dizziness, drowsiness and poor concentration with methylphenidate and dexmethylphenidate (Ritalin, Concerta, Focalin). MedlinePlus adds that alcohol can make methylphenidate side effects worse.',
    sources: [
      { label: 'NIAAA: Harmful interactions, mixing alcohol with medicines', url: 'https://www.niaaa.nih.gov/publications/brochures-and-fact-sheets/harmful-interactions-mixing-alcohol-with-medicines' },
      { label: 'MedlinePlus: Methylphenidate', url: 'https://medlineplus.gov/druginfo/meds/a682188.html' },
    ],
  },
  {
    pair: 'Caffeine and alcohol',
    why: 'Caffeine does not reduce the effects of alcohol. It can make you feel less impaired than you are, which can lead to drinking more. The CDC also lists higher blood pressure, irregular heartbeat and dehydration.',
    sources: [{ label: 'CDC: Effects of mixing alcohol and caffeine', url: 'https://www.cdc.gov/alcohol/fact-sheets/caffeine-and-alcohol.htm' }],
  },
  {
    pair: 'Stimulants and MAOI antidepressants',
    why: 'Amphetamine labels say not to take them with MAOIs (such as phenelzine, selegiline or linezolid) or within 14 days of stopping one, because of the risk of a dangerous spike in blood pressure (hypertensive crisis). Methylphenidate carries the same two-week warning.',
    sources: [
      { label: 'Adderall XR prescribing information (DailyMed)', url: DAILYMED_ADDERALL_XR },
      { label: 'MedlinePlus: Dextroamphetamine and amphetamine', url: 'https://medlineplus.gov/druginfo/meds/a601234.html' },
      { label: 'MedlinePlus: Methylphenidate', url: 'https://medlineplus.gov/druginfo/meds/a682188.html' },
    ],
  },
  {
    pair: 'Amphetamines and SSRIs, SNRIs or triptans',
    why: 'Combined with drugs that raise serotonin, such as many antidepressants (SSRIs, SNRIs) and migraine triptans, amphetamines can contribute to serotonin syndrome, a rare but serious reaction. These are often prescribed together, so this is something to review with your prescriber rather than a reason to stop anything.',
    sources: [{ label: 'Adderall XR prescribing information (DailyMed)', url: DAILYMED_ADDERALL_XR }],
  },
  {
    pair: 'Amphetamines with antacids or vitamin C and juice',
    why: 'Stomach pH changes how much amphetamine is absorbed. Antacids and other alkalinizing agents raise blood levels. Acidic things like vitamin C (ascorbic acid) and fruit juice lower them. This app does not adjust the curve for either.',
    sources: [{ label: 'Adderall XR prescribing information (DailyMed)', url: DAILYMED_ADDERALL_XR }],
  },
  {
    pair: 'Stimulants and caffeine',
    why: 'Caffeine is a stimulant too, and the FDA notes that some medications make people more sensitive to its effects. For most adults the FDA cites 400 mg a day, about two to three 12 oz cups of coffee. The chart shows both on the same day so you can see how they overlap and what is left at sleep time.',
    sources: [{ label: 'FDA: How much caffeine is too much?', url: 'https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much' }],
  },
]
