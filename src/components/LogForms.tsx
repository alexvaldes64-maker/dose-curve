import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { HOUR } from '../lib/model'
import { db, getActiveProfileId, useActiveProfile, useFills, useLastAmount, useLastSubstance, type Checkin, type Dose } from '../db'
import { fillName } from './FillSheet'
import { DEFAULT_SUBSTANCE, SPLIT_LABEL, SUBSTANCES, getFormulation, getSubstance, roundDose, splitAmount, stepDose, doseName } from '../lib/substances'
import { FOCUS_COLORS } from '../lib/phaseStyle'
import { atTime, fmtTime, toTimeInput } from '../lib/time'
import { SIDE_EFFECT_TAGS, fillForDose } from '../lib/compare'

export const fieldCls = 'w-full rounded-xl bg-fill px-3 py-3 text-[16px] text-text outline-none placeholder:text-muted focus:ring-2 focus:ring-[var(--onset)]'
export const labelCls = 'mb-1.5 block text-[14px] text-muted'
const primary = 'flex-1 rounded-full bg-text py-3.5 text-[16px] font-semibold text-card active:opacity-80 disabled:opacity-40'
const danger = 'rounded-full px-5 py-3.5 text-[16px] font-semibold text-danger active:opacity-70'

/** Amount picker: tap the number to type an exact amount (0.25 mg precision), or step with the buttons. */
export function Stepper({ value, onChange, step = 2.5, min = 0.25, max = 100 }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  const [typing, setTyping] = useState<string | null>(null)
  const clamp = (v: number) => Math.min(max, Math.max(min, roundDose(v)))
  const stepBy = (dir: 1 | -1) => onChange(clamp(stepDose(value, step, dir, min)))
  const commit = () => {
    const v = Number(typing)
    if (typing !== null && Number.isFinite(v) && v > 0) onChange(clamp(v))
    setTyping(null)
  }
  const btn = 'grid h-12 w-12 place-items-center rounded-full bg-fill text-[26px] leading-none text-text active:bg-line'
  return (
    <div className="flex items-center justify-between">
      <button type="button" aria-label="Less" className={btn} onClick={() => stepBy(-1)}>
        −
      </button>
      {typing === null ? (
        <button type="button" aria-label={`Amount ${value} mg. Tap to type an exact amount.`} onClick={() => setTyping(String(value))} className="num text-[48px] leading-none">
          {value}
          <span className="ml-1.5 text-[20px] font-medium text-muted">mg</span>
        </button>
      ) : (
        <input
          autoFocus
          aria-label="Exact amount in mg"
          type="number"
          inputMode="decimal"
          step={0.25}
          min={min}
          max={max}
          value={typing}
          onChange={(e) => setTyping(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="num w-32 rounded-xl bg-fill py-1 text-center text-[40px] leading-none outline-none"
        />
      )}
      <button type="button" aria-label="More" className={btn} onClick={() => stepBy(1)}>
        +
      </button>
    </div>
  )
}

export function ScorePicker({ value, onChange, name, low, high, colored }: { value: number; onChange: (v: number) => void; name: string; low: string; high: string; colored?: boolean }) {
  return (
    <div>
      <div className="flex justify-between gap-2" role="radiogroup" aria-label={name}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n === value
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${name} ${n}`}
              onClick={() => onChange(n)}
              className={`grid h-12 w-12 place-items-center rounded-full text-[17px] font-semibold ${on ? 'text-card' : 'bg-fill text-text'}`}
              style={on ? { background: colored ? FOCUS_COLORS[n - 1] : 'var(--text)' } : undefined}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}

/** Log or edit a dose of any preset substance. New entries land on the given day (default today). */
export function DoseForm({ initial, day, onDone }: { initial?: Dose; day?: Date; onDone?: () => void }) {
  const lastSubstance = useLastSubstance()
  const [picked, setPicked] = useState<string | null>(initial?.substance ?? null)
  const favorites = useActiveProfile().favorites ?? []
  const sub = getSubstance(picked ?? lastSubstance ?? favorites[0] ?? DEFAULT_SUBSTANCE)
  const ordered = [...SUBSTANCES].sort((x, y) => Number(favorites.includes(y.id)) - Number(favorites.includes(x.id)))
  const [formId, setFormId] = useState<string | null>(initial?.formulation ?? null)
  const form = getFormulation(sub, formId ?? undefined)
  const lastAmount = useLastAmount(sub.id)
  const [amount, setAmountRaw] = useState<number | null>(initial?.mg ?? null)
  const value = amount ?? lastAmount ?? sub.defaultAmount
  // Strength chip and split, when the amount came from a tablet. Typing or stepping clears them.
  const [strength, setStrength] = useState<number | null>(initial?.strengthMg ?? null)
  const [split, setSplit] = useState<1 | 0.5 | 0.25>(initial?.split ?? 1)
  const setAmount = (v: number) => {
    setAmountRaw(v)
    setStrength(null)
    setSplit(1)
  }
  function pickStrength(mg: number, piece: 1 | 0.5 | 0.25 = 1) {
    setStrength(mg)
    setSplit(piece)
    setAmountRaw(splitAmount(mg, piece))
  }
  const strengthInfo = form.strengths?.find((x) => x.mg === strength)
  const allFills = useFills()
  const matchingFills = allFills.filter((f) => f.substance === sub.id && f.formulation === form.id)
  const [fillChoice, setFillChoice] = useState<string>(initial?.fillId ? String(initial.fillId) : 'auto')
  const [time, setTime] = useState(toTimeInput(initial ? Date.parse(initial.takenAt) : Date.now()))
  // Same substance logged within 3 hours of this time: say so before saving, to avoid duplicate entries.
  const chosenAt = atTime(initial ? Date.parse(initial.takenAt) : (day ?? new Date()).getTime(), time)
  const nearby = useLiveQuery(async () => {
    if (initial) return []
    const pid = await getActiveProfileId()
    const iso = (t: number) => new Date(t).toISOString()
    return db.doses
      .where('[profileId+takenAt]')
      .between([pid, iso(chosenAt - 3 * HOUR)], [pid, iso(chosenAt + 3 * HOUR)], true, true)
      .filter((d) => d.substance === sub.id)
      .toArray()
  }, [chosenAt, sub.id, !!initial]) ?? []
  // The fill this dose would link to automatically, for the picker's label.
  const autoFill = fillForDose(
    { profileId: allFills[0]?.profileId ?? 0, substance: sub.id, formulation: form.id, takenAt: new Date(atTime(initial ? Date.parse(initial.takenAt) : (day ?? new Date()).getTime(), time)).toISOString() },
    matchingFills,
  )
  const [saved, setSaved] = useState(false)

  function choose(id: string) {
    setPicked(id)
    setFormId(null)
    setAmountRaw(null)
    setStrength(null)
    setSplit(1)
  }

  async function save() {
    const base = initial ? Date.parse(initial.takenAt) : (day ?? new Date()).getTime()
    const takenAt = new Date(atTime(base, time)).toISOString()
    const profileId = initial?.profileId ?? (await getActiveProfileId())
    const pinned = fillChoice !== 'auto' && matchingFills.some((f) => String(f.id) === fillChoice) ? Number(fillChoice) : undefined
    const row: Dose = {
      ...(pinned ? { fillId: pinned } : {}),
      ...(strength && split !== 1 ? { strengthMg: strength, split } : {}),
      profileId,
      substance: sub.id,
      medication: sub.name,
      mg: value,
      formulation: form.id,
      takenAt,
    }
    if (initial?.id) await db.doses.update(initial.id, row)
    else await db.doses.add(row)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
    onDone?.()
  }

  async function remove() {
    if (initial?.id && confirm('Delete this dose?')) {
      await db.doses.delete(initial.id)
      onDone?.()
    }
  }

  return (
    <div className="space-y-5">
      <div className="scroll-x -mx-4 flex gap-2 px-4" role="radiogroup" aria-label="Substance">
        {ordered.map((x) => {
          const on = x.id === sub.id
          return (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(x.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[15px] font-medium ${on ? 'bg-text text-card' : 'bg-fill text-text'}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />
              {x.name}
            </button>
          )
        })}
      </div>

      {sub.formulations.length > 1 && (
        <div>
          <Segmented
            value={form.id}
            onChange={(id) => {
              setFormId(id)
              setStrength(null)
              setSplit(1)
            }}
            options={sub.formulations.map((f) => ({ value: f.id, label: f.label }))}
          />
        </div>
      )}
      <p className="-mt-2 text-[13px] leading-snug text-muted">{form.blurb}</p>

      {sub.quick && (
        <div className="flex flex-wrap gap-2">
          {sub.quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setAmount(q.amount)}
              className={`rounded-full px-3 py-1.5 text-[14px] ${value === q.amount ? 'bg-text text-card' : 'bg-fill text-text'}`}
            >
              {q.label} <span className="opacity-60">{q.amount}</span>
            </button>
          ))}
        </div>
      )}

      {form.strengths && (
        <div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tablet or capsule strength">
            {form.strengths.map((x) => {
              const on = strength === x.mg
              return (
                <button
                  key={x.mg}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickStrength(x.mg, on ? split : 1)}
                  className={`rounded-full px-3 py-1.5 text-[14px] ${on ? 'bg-text text-card' : 'bg-fill text-text'}`}
                >
                  {x.mg} mg
                </button>
              )
            })}
          </div>
          {strengthInfo?.split && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[13px] text-muted">Split tablet</span>
              {([1, ...strengthInfo.split] as (1 | 0.5 | 0.25)[]).map((piece) => (
                <button
                  key={piece}
                  type="button"
                  aria-pressed={split === piece}
                  onClick={() => pickStrength(strengthInfo.mg, piece)}
                  className={`rounded-full px-3 py-1 text-[14px] ${split === piece ? 'bg-text text-card' : 'bg-fill text-text'}`}
                >
                  {piece === 1 ? 'Whole' : SPLIT_LABEL[piece]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Stepper value={value} onChange={setAmount} step={form.step ?? sub.step} max={sub.id === 'caffeine' ? 600 : 200} />
      {strength && split !== 1 && <p className="-mt-3 text-center text-[13px] text-muted">{SPLIT_LABEL[split]} of a {strength} mg tablet</p>}

      {matchingFills.length > 0 && (
        <label className="block">
          <span className={labelCls}>From fill</span>
          <select className={fieldCls} value={fillChoice} onChange={(e) => setFillChoice(e.target.value)}>
            <option value="auto">Automatic{autoFill ? `: ${fillName(autoFill)}` : ''}</option>
            {matchingFills.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {fillName(f)}, {new Date(f.filledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className={labelCls}>Taken at</span>
        <input type="time" className={fieldCls} value={time} onChange={(e) => setTime(e.target.value)} />
      </label>

      {nearby.length > 0 && !saved && (
        <p className="rounded-[14px] bg-fill px-3 py-2.5 text-[14px] leading-snug" role="status">
          Already logged: {nearby.map((d) => `${doseName(d)} at ${fmtTime(Date.parse(d.takenAt))}`).join(', ')}. Saving adds another entry.
        </p>
      )}

      <div className="flex gap-2">
        {initial && (
          <button type="button" className={danger} onClick={remove}>
            Delete
          </button>
        )}
        <button type="button" className={primary} onClick={save} disabled={!time}>
          {saved ? 'Logged' : initial ? 'Save changes' : sub.id === 'caffeine' ? 'Log caffeine' : 'Log dose'}
        </button>
      </div>
    </div>
  )
}

export function CheckinForm({ initial, day, onDone }: { initial?: Checkin; day?: Date; onDone?: () => void }) {
  const [focus, setFocus] = useState(initial?.focus ?? 3)
  const [mood, setMood] = useState(initial?.mood ?? 3)
  const profile = useActiveProfile()
  const isChild = profile.kind === 'child'
  const [appetite, setAppetite] = useState(initial?.appetite ?? 3)
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const isWoreOff = initial?.kind === 'wore_off'
  const [note, setNote] = useState(initial?.note ?? '')
  const [time, setTime] = useState(toTimeInput(initial ? Date.parse(initial.at) : Date.now()))
  const [saved, setSaved] = useState(false)

  async function save() {
    const base = initial ? Date.parse(initial.at) : (day ?? new Date()).getTime()
    const profileId = initial?.profileId ?? (await getActiveProfileId())
    const row: Checkin = {
      profileId,
      kind: initial?.kind ?? 'rating',
      at: new Date(atTime(base, time)).toISOString(),
      focus,
      mood,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(tags.length && !isWoreOff ? { tags } : {}),
      ...(isChild && !isWoreOff ? { appetite } : {}),
      ...(initial?.substance ? { substance: initial.substance } : {}),
    }
    if (initial?.id) await db.checkins.put({ ...row, id: initial.id })
    else await db.checkins.add(row)
    if (!initial) {
      setNote('')
      setTags([])
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
    onDone?.()
  }

  async function remove() {
    if (initial?.id && confirm('Delete this check-in?')) {
      await db.checkins.delete(initial.id)
      onDone?.()
    }
  }

  return (
    <div className="space-y-5">
      {isWoreOff && <p className="text-[15px]">{getSubstance(initial?.substance).name} wore off. Adjust the time or add a note.</p>}
      {!isWoreOff && (
      <>
      <div>
        <span className={labelCls}>Focus</span>
        <ScorePicker name="Focus" value={focus} onChange={setFocus} low="Scattered" high="Locked in" colored />
      </div>
      <div>
        <span className={labelCls}>Mood</span>
        <ScorePicker name="Mood" value={mood} onChange={setMood} low="Low" high="Great" />
      </div>
      {isChild && (
        <div>
          <span className={labelCls}>Appetite</span>
          <ScorePicker name="Appetite" value={appetite} onChange={setAppetite} low="Barely ate" high="Ate well" />
        </div>
      )}
      {isChild && <p className="-mt-2 text-[13px] text-muted">Ratings for {profile.name}, as observed by you.</p>}
      <div>
        <span className={labelCls}>Side effects (optional)</span>
        <div className="flex flex-wrap gap-2">
          {SIDE_EFFECT_TAGS.map((t) => {
            const on = tags.includes(t)
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                className={`rounded-full px-3 py-1.5 text-[14px] ${on ? 'bg-text text-card' : 'bg-fill text-text'}`}
              >
                {t}
              </button>
            )
          })}
        </div>
      </div>
      </>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <label className="block">
          <span className={labelCls}>Time</span>
          <input type="time" className={fieldCls} value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Note</span>
          <input className={fieldCls} value={note} placeholder="Optional" onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-2">
        {initial && (
          <button type="button" className={danger} onClick={remove}>
            Delete
          </button>
        )}
        <button type="button" className={primary} onClick={save} disabled={!time}>
          {saved ? 'Check-in saved' : initial ? 'Save changes' : 'Save check-in'}
        </button>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid rounded-full bg-fill p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-full py-2 text-[15px] font-semibold ${o.value === value ? 'bg-text text-card' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
