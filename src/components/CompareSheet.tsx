import { useMemo, useState } from 'react'
import { useAllForProfile, useFills } from '../db'
import { MIN_DAYS, fillStats, type FillStats } from '../lib/compare'
import { fillName } from './FillSheet'
import { fieldCls, labelCls } from './LogForms'
import { Sheet } from './Sheet'

const FDA_CONCERTA_GENERICS =
  'https://www.fda.gov/drugs/drug-safety-and-availability/methylphenidate-hydrochloride-extended-release-tablets-generic-concerta-made-mallinckrodt-and-kudco'

const fmt = (v: number | null, digits = 1) => (v === null ? 'None logged' : v.toFixed(digits))

/** Side by side, observed only: wear-off times, ratings by hours since the first dose, side effects. */
export function CompareSheet({ onClose }: { onClose: () => void }) {
  const fills = useFills()
  const { doses, checkins } = useAllForProfile()
  const [a, setA] = useState<string>(() => (fills[1]?.id ? String(fills[1].id) : ''))
  const [b, setB] = useState<string>(() => (fills[0]?.id ? String(fills[0].id) : ''))
  const fa = fills.find((f) => String(f.id) === a) ?? fills[1]
  const fb = fills.find((f) => String(f.id) === b) ?? fills[0]
  const sa = useMemo(() => (fa ? fillStats(fa, fills, doses, checkins) : null), [fa, fills, doses, checkins])
  const sb = useMemo(() => (fb ? fillStats(fb, fills, doses, checkins) : null), [fb, fills, doses, checkins])

  if (fills.length < 2) {
    return (
      <Sheet open onClose={onClose} title="Compare fills">
        <p className="text-[15px] leading-snug">Add at least two fills in Log to compare them. Then log your doses, ratings and when it wore off for a few days on each.</p>
      </Sheet>
    )
  }

  const cell = (s: FillStats | null, render: (s: FillStats) => string) =>
    !s ? '' : s.enough ? render(s) : ''

  const rows: { label: string; a: string; b: string }[] = [
    { label: 'Days logged', a: sa ? String(sa.days) : '', b: sb ? String(sb.days) : '' },
    { label: 'Days with "wore off"', a: cell(sa, (s) => String(s.woreOffDays)), b: cell(sb, (s) => String(s.woreOffDays)) },
    {
      label: 'Wore off, median hours after first dose',
      a: cell(sa, (s) => fmt(s.medianWoreOffHours)),
      b: cell(sb, (s) => fmt(s.medianWoreOffHours)),
    },
    ...(sa?.buckets ?? []).map((bk, i) => ({
      label: `Focus, ${bk.label}`,
      a: cell(sa, (s) => (s.buckets[i].n ? `${fmt(s.buckets[i].focus)} (${s.buckets[i].n})` : 'None logged')),
      b: cell(sb, (s) => (s.buckets[i].n ? `${fmt(s.buckets[i].focus)} (${s.buckets[i].n})` : 'None logged')),
    })),
    ...(sa?.buckets ?? []).map((bk, i) => ({
      label: `Mood, ${bk.label}`,
      a: cell(sa, (s) => (s.buckets[i].n ? fmt(s.buckets[i].mood) : 'None logged')),
      b: cell(sb, (s) => (s.buckets[i].n ? fmt(s.buckets[i].mood) : 'None logged')),
    })),
  ]
  const tags = [...new Set([...(sa?.sideEffects ?? []), ...(sb?.sideEffects ?? [])].map((x) => x.tag))]
  for (const t of tags) {
    rows.push({
      label: `Side effect: ${t.toLowerCase()}`,
      a: cell(sa, (s) => String(s.sideEffects.find((x) => x.tag === t)?.count ?? 0)),
      b: cell(sb, (s) => String(s.sideEffects.find((x) => x.tag === t)?.count ?? 0)),
    })
  }

  return (
    <Sheet open onClose={onClose} title="Compare fills">
      <p className="-mt-2 mb-4 text-[14px] leading-snug text-muted">
        The estimated curve is the same for every fill. This compares only what you logged: when you marked it wearing off, your ratings, and side
        effects. Days that mix two fills are left out.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { v: a, set: setA, label: 'Fill A' },
          { v: b, set: setB, label: 'Fill B' },
        ].map((x) => (
          <label key={x.label} className="block">
            <span className={labelCls}>{x.label}</span>
            <select className={`${fieldCls} text-[14px]`} value={x.v || String((x.label === 'Fill A' ? fa : fb)?.id ?? '')} onChange={(e) => x.set(e.target.value)}>
              {fills.map((f) => (
                <option key={f.id} value={String(f.id)}>
                  {fillName(f)}, {new Date(f.filledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {[sa, sb].some((s) => s && !s.enough) && (
        <p className="mt-3 rounded-[14px] bg-fill px-3 py-2.5 text-[13px] leading-snug">
          Not enough data yet for {[sa && !sa.enough ? `A (${sa.days} of ${MIN_DAYS} days)` : '', sb && !sb.enough ? `B (${sb.days} of ${MIN_DAYS} days)` : ''].filter(Boolean).join(' and ')}.
          Numbers show once a fill has {MIN_DAYS} days logged.
        </p>
      )}

      <table className="mt-4 w-full text-left text-[14px]">
        <thead>
          <tr className="text-muted">
            <th className="py-2 font-normal" />
            <th className="w-[26%] py-2 text-right font-medium">A</th>
            <th className="w-[26%] py-2 text-right font-medium">B</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-2 pr-2">{r.label}</td>
              <td className="py-2 text-right tabular-nums">{r.a}</td>
              <td className="py-2 text-right tabular-nums">{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[13px] text-muted">Focus and mood are averages on the 1 to 5 scale; the number in brackets is how many ratings.</p>

      <p className="mt-5 text-[13px] leading-snug text-muted">
        Why fills can differ: in 2014 the FDA found two generic versions of Concerta might not work the same as the brand.{' '}
        <a href={FDA_CONCERTA_GENERICS} target="_blank" rel="noopener noreferrer" className="text-[var(--onset)] underline underline-offset-2">
          FDA notice
        </a>
        . If you notice a difference, it is worth raising with your prescriber or pharmacist.
      </p>
    </Sheet>
  )
}
