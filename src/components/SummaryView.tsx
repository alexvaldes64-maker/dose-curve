import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useActiveProfile, useAllForProfile, useFills, type Settings } from '../db'
import { buildSummary, toCsv, type Summary } from '../lib/summary'
import { addDays, dateKey, startOfLocalDay } from '../lib/time'
import { Segmented } from './LogForms'

const RANGES = [7, 14, 30] as const

function MiniCurve({ day }: { day: Summary['dailyCurves'][number] }) {
  const W = 160
  const H = 36
  return (
    <figure className="break-inside-avoid">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-full" aria-hidden>
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="#d1d1d6" />
        <line x1={0} x2={W} y1={H - (100 / 120) * H} y2={H - (100 / 120) * H} stroke="#e5e5ea" strokeDasharray="2 3" />
        {day.series.map((s) => (
          <polyline
            key={s.id}
            fill="none"
            stroke={s.color}
            strokeWidth={1.5}
            points={s.points.map(([h, e]) => `${((h / 24) * W).toFixed(1)},${(H - (Math.min(120, e) / 120) * H).toFixed(1)}`).join(' ')}
          />
        ))}
      </svg>
      <figcaption className="text-[11px] text-[#6e6e73]">{day.date}</figcaption>
    </figure>
  )
}

const n1 = (v: number | null) => (v === null ? '' : v.toFixed(1))

function RatingTable({ title, rows }: { title: string; rows: { label: string; focus: number | null; mood: number | null; n: number }[] }) {
  const shown = rows.filter((r) => r.n > 0)
  if (!shown.length) return null
  return (
    <table className="mt-2 w-full break-inside-avoid text-left text-[13px]">
      <caption className="pb-1 text-left text-[13px] font-semibold">{title}</caption>
      <thead>
        <tr className="border-b border-[#d1d1d6] text-[#6e6e73]">
          <th className="py-1 font-normal" />
          <th className="py-1 text-right font-normal">Focus</th>
          <th className="py-1 text-right font-normal">Mood</th>
          <th className="py-1 text-right font-normal">Ratings</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => (
          <tr key={r.label} className="border-b border-[#ececf0]">
            <td className="py-1">{r.label}</td>
            <td className="py-1 text-right tabular-nums">{n1(r.focus)}</td>
            <td className="py-1 text-right tabular-nums">{n1(r.mood)}</td>
            <td className="py-1 text-right tabular-nums">{r.n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="border-b border-[#1c1c1e] pb-1 text-[15px] font-semibold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}

/** Printable summary for a prescriber. Descriptive only. Opens over the app; print or save as PDF. */
export function SummaryView({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const profile = useActiveProfile()
  const fills = useFills()
  const { doses, checkins } = useAllForProfile()
  const [days, setDays] = useState<(typeof RANGES)[number]>(14)
  const to = startOfLocalDay(Date.now())
  const from = addDays(to, -(days - 1))
  const input = { doses, checkins, fills, from, to, model: settings.model, toleranceRate: settings.toleranceRate, overrides: settings.overrides }
  // `input` is rebuilt each render; recompute only when its parts change.
  const s = useMemo(() => buildSummary(input), [doses, checkins, fills, days, settings.model, settings.toleranceRate, settings.overrides])

  function downloadCsv() {
    const blob = new Blob([toCsv(input, profile.name)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dose-curve-${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${dateKey(from)}-to-${dateKey(to)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return createPortal(
    <div className="print-root fixed inset-0 z-[60] overflow-y-auto bg-white text-[#1c1c1e]" role="dialog" aria-modal aria-label="Summary for your prescriber">
      <div className="no-print sticky top-0 z-10 border-b border-[#ececf0] bg-white/95 px-4 pb-3 backdrop-blur" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="text-[16px] text-[#3e9bff]">
            Close
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={downloadCsv} className="rounded-full bg-[#f0f0f3] px-4 py-2 text-[15px] font-semibold">
              CSV
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-full bg-[#1c1c1e] px-4 py-2 text-[15px] font-semibold text-white">
              Print or save PDF
            </button>
          </div>
        </div>
        <div className="mt-3">
          <Segmented value={String(days)} onChange={(v) => setDays(Number(v) as (typeof RANGES)[number])} options={RANGES.map((r) => ({ value: String(r), label: `${r} days` }))} />
        </div>
      </div>

      <article className="mx-auto max-w-[720px] px-5 pb-16 pt-5 text-[14px] leading-snug">
        <header>
          <h1 className="text-[22px] font-bold">Medication log summary</h1>
          <p className="mt-1 text-[14px]">
            {profile.name}
            {profile.kind === 'child' ? ' (logged by a parent)' : ''}. {s.from} to {s.to}.
          </p>
          <p className="mt-2 rounded-lg border border-[#d1d1d6] px-3 py-2 text-[12px] leading-snug">
            Self-reported log from the Dose Curve app. Curves and phases are estimates based on general averages, not measurements. This summary
            describes what was logged and does not recommend anything.
          </p>
        </header>

        {s.substances.length === 0 && <p className="mt-6">Nothing was logged in this range.</p>}

        {s.substances.map((x) => (
          <Section key={x.id} title={x.name}>
            <p>
              Logged on {x.daysWithDose} of {x.totalDays} days, {x.doseCount} {x.doseCount === 1 ? 'dose' : 'doses'}.
              {x.typicalFirstDose && ` Typical first dose ${x.typicalFirstDose}.`}
              {x.id !== 'caffeine' &&
                (x.woreOffDays
                  ? ` "Wore off" logged on ${x.woreOffDays} ${x.woreOffDays === 1 ? 'day' : 'days'}, median ${x.woreOffMedianHours!.toFixed(1)} h after the first dose.`
                  : ' No "wore off" times logged.')}
            </p>
            <table className="mt-2 w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#d1d1d6] text-[#6e6e73]">
                  <th className="py-1 font-normal">Date</th>
                  <th className="py-1 font-normal">Time</th>
                  <th className="py-1 font-normal">Dose</th>
                  <th className="py-1 font-normal">Fill</th>
                </tr>
              </thead>
              <tbody>
                {x.rows.map((r, i) => (
                  <tr key={i} className="border-b border-[#ececf0]">
                    <td className="py-1 pr-2">{r.date}</td>
                    <td className="py-1 pr-2 tabular-nums">{r.time}</td>
                    <td className="py-1 pr-2">{r.what}</td>
                    <td className="py-1">{r.fill}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        ))}

        {s.ratings.count > 0 && (
          <Section title={`Focus and mood ratings (1 to 5, ${s.ratings.count} total)`}>
            {s.ratings.appetite !== null && <p>Average appetite rating: {s.ratings.appetite.toFixed(1)} of 5.</p>}
            <RatingTable title="By time of day" rows={s.ratings.byTimeOfDay} />
            <RatingTable title="By hours since the day's first medication dose" rows={s.ratings.byHoursSinceDose} />
            <RatingTable title="By estimated phase at the time of rating" rows={s.ratings.byPhase} />
          </Section>
        )}

        {s.sideEffects.length > 0 && (
          <Section title="Side effects logged">
            <p>{s.sideEffects.map((x) => `${x.tag} (${x.count})`).join(', ')}</p>
          </Section>
        )}

        {s.fillChanges.length > 0 && (
          <Section title="Pharmacy fills in this range">
            <ul>
              {s.fillChanges.map((f, i) => (
                <li key={i}>
                  {f.date}: {f.what}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {s.notes.length > 0 && (
          <Section title="Notes">
            <ul className="space-y-1">
              {s.notes.map((n, i) => (
                <li key={i}>
                  <span className="text-[#6e6e73]">
                    {n.date} {n.time}:
                  </span>{' '}
                  {n.text}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {s.dailyCurves.length > 0 && (
          <Section title="Estimated effect by day (midnight to midnight, dashed line is a typical peak)">
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-4">
              {s.dailyCurves.map((d) => (
                <MiniCurve key={d.date} day={d} />
              ))}
            </div>
          </Section>
        )}

        <footer className="mt-8 text-[11px] text-[#6e6e73]">
          Generated on this device by Dose Curve {__APP_VERSION__} on {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}. No
          data was sent anywhere to make it.
        </footer>
      </article>
    </div>,
    document.body,
  )
}
