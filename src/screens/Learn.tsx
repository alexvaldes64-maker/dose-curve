import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Segmented, fieldCls, labelCls } from '../components/LogForms'
import { PrivacyCheck } from '../components/PrivacyCheck'
import { PHASE_COLOR } from '../lib/phaseStyle'
import { DEFAULT_SETTINGS, exportData, importData, parseBackup, saveActiveProfile, saveSettings, useActiveProfile, useProfiles, type Settings } from '../db'
import { CAFFEINE_METABOLISM, CAFFEINE_METABOLISM_NOTE, INTERACTIONS, SUBSTANCES, getFormulation, getSubstance, overrideKey, type Source } from '../lib/substances'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card mx-4 mt-3 px-4 pb-4 pt-4">
      <h2 className="mb-3 text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Topic({ term, color, children }: { term: string; color?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[10px_1fr] gap-x-3 border-t border-line py-3 first:border-0 first:pt-0">
      <span className="mt-[7px] h-2.5 w-2.5 rounded-full" style={color ? { background: color } : { border: '2px solid var(--clear)' }} />
      <div>
        <dt className="text-[16px] font-semibold">{term}</dt>
        <dd className="mt-0.5 max-w-[60ch] text-[15px] leading-snug text-muted">{children}</dd>
      </div>
    </div>
  )
}

/** Number input that only commits valid values within range. */
function NumberField({ name, value, min, max, step, unit, onCommit }: { name: string; value: number; min: number; max: number; step: number; unit?: string; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = () => {
    const v = Number(text)
    if (Number.isFinite(v) && v >= min && v <= max) onCommit(v)
    else setText(String(value))
  }
  return (
    <label className="block">
      <span className={labelCls}>
        {name}
        {unit && <span> ({unit})</span>}
      </span>
      <input
        className={fieldCls}
        inputMode="decimal"
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  )
}

function refText(sub: ReturnType<typeof getSubstance>): string {
  const ref = getFormulation(sub, sub.reference.formulation)
  const what = sub.id === 'caffeine' ? 'a 95 mg cup of coffee' : `${sub.reference.amount} mg ${ref.label === 'Capsule' ? '' : ref.label}`.trim()
  return `${sub.detail}. 100% on the chart is the peak of ${what}.${sub.acuteTolerance ? '' : ' Acute tolerance is not applied.'}`
}

const REPO = import.meta.env.VITE_SOURCE_URL ?? 'https://github.com/alexvaldes64-maker/dose-curve'

function SourceLinks({ sources }: { sources: Source[] }) {
  return (
    <ul className="mt-1.5 space-y-0.5">
      {sources.map((x) => (
        <li key={x.url}>
          <a href={x.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[var(--onset)] underline decoration-[var(--line)] underline-offset-2">
            {x.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

/** Pick a substance and formulation, see its preset timing, and adjust half-life and absorption. */
function Presets({ settings, focus }: { settings: Settings; focus?: string | null }) {
  const [subId, setSubId] = useState(focus ?? SUBSTANCES[0].id)
  useEffect(() => {
    if (focus) {
      setSubId(focus)
      setFormId(getSubstance(focus).formulations[0].id)
    }
  }, [focus])
  const sub = getSubstance(subId)
  const [formId, setFormId] = useState<string>(sub.formulations[0].id)
  const form = getFormulation(sub, formId)
  const key = overrideKey(sub.id, form.id)
  const o = settings.overrides?.[key] ?? {}
  const changed = o.halfLifeHours !== undefined || o.kaPerHour !== undefined

  function set(patch: { halfLifeHours?: number; kaPerHour?: number } | null) {
    const next = { ...(settings.overrides ?? {}) }
    const merged = patch === null ? {} : { ...o, ...patch }
    // Drop fields that match the preset, so "Reset" and "Typical" leave no stale override behind.
    if (merged.halfLifeHours === undefined || merged.halfLifeHours === form.halfLifeHours) delete merged.halfLifeHours
    if (merged.kaPerHour === undefined || merged.kaPerHour === form.kaPerHour) delete merged.kaPerHour
    if (Object.keys(merged).length) next[key] = merged
    else delete next[key]
    saveActiveProfile({ overrides: next })
  }
  const halfLife = o.halfLifeHours ?? form.halfLifeHours
  const metabolism = CAFFEINE_METABOLISM.find((m) => m.halfLifeHours === halfLife)?.id ?? 'custom'

  return (
    <div className="space-y-4">
      <div className="scroll-x -mx-4 flex gap-2 px-4">
        {SUBSTANCES.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => {
              setSubId(x.id)
              setFormId(x.formulations[0].id)
            }}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[15px] font-medium ${x.id === sub.id ? 'bg-text text-card' : 'bg-fill text-text'}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />
            {x.name}
          </button>
        ))}
      </div>
      {sub.formulations.length > 1 && (
        <Segmented value={form.id} onChange={setFormId} options={sub.formulations.map((f) => ({ value: f.id, label: f.label }))} />
      )}
      <div>
        <p className="text-[15px] leading-snug">{form.blurb}</p>
        <p className="mt-1 text-[13px] text-muted">
          {refText(sub)}
        </p>
        <SourceLinks sources={sub.sources} />
      </div>
      {sub.id === 'caffeine' && (
        <div>
          <span className={labelCls}>How fast you clear caffeine</span>
          <Segmented
            value={metabolism}
            onChange={(id) => {
              const m = CAFFEINE_METABOLISM.find((x) => x.id === id)
              if (m) set({ halfLifeHours: m.halfLifeHours })
            }}
            options={[...CAFFEINE_METABOLISM.map((m) => ({ value: m.id as string, label: `${m.label} ${m.halfLifeHours}h` })), { value: 'custom', label: 'Custom' }]}
          />
          <p className="mt-2 text-[13px] leading-snug text-muted">{CAFFEINE_METABOLISM_NOTE}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="Half-life" unit="hours" value={halfLife} min={0.5} max={48} step={0.5} onCommit={(v) => set({ halfLifeHours: v })} />
        <NumberField name="Absorption" unit="per h" value={o.kaPerHour ?? form.kaPerHour} min={0.1} max={8} step={0.1} onCommit={(v) => set({ kaPerHour: v })} />
      </div>
      {changed && (
        <p className="-mt-2 text-[13px] text-muted">
          Preset: {form.halfLifeHours} h half-life, {form.kaPerHour} per h absorption.
        </p>
      )}
      {changed && (
        <button type="button" onClick={() => set(null)} className="w-full rounded-full bg-fill py-3 text-[15px] font-semibold">
          Reset {sub.name} {form.label} to preset
        </button>
      )}
    </div>
  )
}

export function Learn({ settings, focus }: { settings: Settings; focus?: string | null }) {
  const profile = useActiveProfile()
  const profiles = useProfiles()
  const presetsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focus) presetsRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [focus])
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function onExport(onlyActive = false) {
    const data = await exportData(onlyActive ? profile.id : undefined)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const who = onlyActive ? `-${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : ''
    a.download = `dose-curve-backup${who}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMsg(`Exported ${data.profiles.length === 1 ? data.profiles[0].name + ': ' : ''}${data.doses.length} doses and ${data.checkins.length} check-ins.`)
  }

  async function onImport(file: File) {
    try {
      const backup = parseBackup(JSON.parse(await file.text()))
      if (!confirm(`Replace all data on this device with ${backup.doses.length} doses and ${backup.checkins.length} check-ins from the backup?`)) return
      await importData(backup)
      setMsg('Backup restored.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not read that file.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }


  return (
    <div className="scroll-y h-full pb-tabbar">
      <header className="pt-safe px-5 pb-4">
        <p className="text-[15px] text-muted">How the curve works</p>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">Learn</h1>
      </header>
      <p className="mx-4 rounded-[20px] bg-fill px-4 py-3.5 text-[15px] leading-snug">
        Estimates only, based on general averages. Not medical advice. Follow your prescriber's instructions.
      </p>

      <Section title="Reading the span">
        <dl>
          <Topic term="Kicking in" color={PHASE_COLOR.Onset}>
            The medicine is being absorbed and the effect is building. The shape grows as it rises.
          </Topic>
          <Topic term="Peak" color={PHASE_COLOR.Peak}>
            The estimated effect is near its highest for the day, at least 80% of the day's top.
          </Topic>
          <Topic term="Wearing off" color={PHASE_COLOR.Taper}>
            Past the peak and falling, between 80% and 40% of the day's top.
          </Topic>
          <Topic term="Fading" color={PHASE_COLOR.Comedown}>
            The tail of the effect, below 40%. Some people notice changes in mood or energy here.
          </Topic>
          <Topic term="Clear">Below 10% of the day's top, so little or no effect is expected.</Topic>
        </dl>
      </Section>

      <Section title="Why the numbers move the way they do">
        <dl>
          <Topic term="Half-life">
            How long the body takes to clear half of it from the blood. About 11 hours for Adderall, about 5 for caffeine, and 2 to 3.5 for methylphenidate. A longer half-life means more of it lingers into the evening, which is what the blood level at sleep shows.
          </Topic>
          <Topic term="Felt effect fades first">
            Blood levels fall slowly for hours, but the brain adapts within the same day. So the effect you notice tends to fade before the medicine has left your system. The tolerance adjusted model draws blood level as a dashed line that outlasts the colored shape.
          </Topic>
          <Topic term="Release shapes">
            Immediate release (IR) gives one rise and fall. Adderall XR releases in two pulses, half now and half about 4 hours later, so it peaks later and lower. Slow release (Concerta style) gives a small first rise, then a long flat stretch. Pick the formulation when you log a dose.
          </Topic>
          <Topic term="Several at once">
            Each substance gets its own line and its own scale, where 100% is the peak of one typical dose of it. They are not added together, since a coffee and a pill are different drugs. Tap a substance chip on Today to see its ring, phases and timeline.
          </Topic>
          <Topic term="The shaded band">
            Where the curve would sit if it ran 45 minutes earlier or later, since timing varies between people and between days.
          </Topic>
        </dl>
      </Section>

      <Section title={profile.kind === 'child' ? `${profile.name}'s usual day` : 'Your usual day'}>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Usual wake time</span>
            <input type="time" className={fieldCls} value={settings.wakeTime} onChange={(e) => e.target.value && saveActiveProfile({ wakeTime: e.target.value })} />
          </label>
          <label className="block">
            <span className={labelCls}>Usual sleep time</span>
            <input type="time" className={fieldCls} value={settings.bedtime} onChange={(e) => e.target.value && saveActiveProfile({ sleepTime: e.target.value })} />
          </label>
        </div>
      </Section>

      <Section title="What not to mix">
        <p className="mb-3 max-w-[60ch] text-[14px] leading-snug text-muted">
          Common interactions from official sources. This is not a full list. Ask your prescriber or pharmacist about anything else you take.
        </p>
        <dl>
          {INTERACTIONS.map((x) => (
            <div key={x.pair} className="border-t border-line py-3 first:border-0 first:pt-0">
              <dt className="text-[16px] font-semibold">{x.pair}</dt>
              <dd className="mt-0.5 max-w-[60ch] text-[15px] leading-snug text-muted">{x.why}</dd>
              <SourceLinks sources={x.sources} />
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Presets">
        <p className="mb-4 max-w-[60ch] text-[14px] leading-snug text-muted">
          Each substance fills in its own half-life, absorption speed and release shape from its label or reference data. Changes here apply to the current profile only.
        </p>
        <div ref={presetsRef} className="scroll-mt-4">
          {profile.kind === 'child' && (
          <p className="mb-3 rounded-[14px] bg-fill px-3 py-2.5 text-[13px] leading-snug">
            These presets use adult averages. Timing in children can differ. Changes apply to {profile.name} only.
          </p>
        )}
        <Presets settings={settings} focus={focus} />
        </div>
      </Section>

      <Section title="Model">
        <div className="space-y-5">
          <div>
            <span className={labelCls}>Curve model</span>
            <Segmented
              value={settings.model}
              onChange={(model) => saveSettings({ model })}
              options={[
                { value: 'simple', label: 'Simple' },
                { value: 'tolerance', label: 'Tolerance adjusted' },
              ]}
            />
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              {settings.model === 'simple'
                ? 'Adderall uses a fixed typical effect shape per dose. Other presets use their blood level shape.'
                : 'Estimated blood level per dose. For prescription stimulants it is reduced by acute tolerance through the day.'}
            </p>
          </div>
          <NumberField name="Tolerance rate" unit="per hour" value={settings.toleranceRate} min={0} max={1} step={0.01} onCommit={(v) => saveSettings({ toleranceRate: v })} />
          {settings.toleranceRate !== DEFAULT_SETTINGS.toleranceRate && (
            <button type="button" onClick={() => saveSettings({ toleranceRate: DEFAULT_SETTINGS.toleranceRate })} className="w-full rounded-full bg-fill py-3 text-[15px] font-semibold">
              Reset tolerance rate
            </button>
          )}
        </div>
      </Section>

      <Section title="About">
        <p className="text-[14px] leading-snug text-muted">
          Dose Curve is free and open source. It shows estimates for personal logging only and does not tell you how much to take or when.
        </p>
        <ul className="mt-2 space-y-1">
          {[
            ['Privacy policy', `${REPO}/blob/main/PRIVACY.md`],
            ['Terms of use', `${REPO}/blob/main/TERMS.md`],
            ['Source code', REPO],
          ].map(([label, href]) => (
            <li key={label}>
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-[15px] text-[var(--onset)] underline decoration-[var(--line)] underline-offset-2">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Check privacy">
        <PrivacyCheck />
      </Section>

      <Section title="Your data">
        <p className="mb-4 max-w-[60ch] text-[15px] leading-relaxed text-muted">
          Everything stays on this device and nothing is uploaded. Clearing site data or removing the app deletes it, so export a backup now and then.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => onExport()} className="rounded-full bg-text py-3.5 text-[15px] font-semibold text-card">
            Export backup
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full bg-fill py-3.5 text-[15px] font-semibold">
            Restore backup
          </button>
        </div>
        {profiles.length > 1 && (
          <button type="button" onClick={() => onExport(true)} className="mt-3 w-full rounded-full bg-fill py-3 text-[15px] font-semibold">
            Export {profile.name} only
          </button>
        )}
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        {msg && <p className="mt-3 text-[14px] text-text">{msg}</p>}
      </Section>
    </div>
  )
}
