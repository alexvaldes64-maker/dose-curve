import { useMemo, useState } from 'react'
import { CardHeader } from '../components/DaySummary'
import { EntrySheet, type Entry } from '../components/EntrySheet'
import { CheckinForm, DoseForm, SkipForm } from '../components/LogForms'
import { useAllForProfile, useCheckins, useDoses, useFills, type Dose, type Fill } from '../db'
import { supplyFor } from '../lib/compare'
import { buildEventsIcs, downloadIcs } from '../lib/ics'
import { FillSheet, fillName } from '../components/FillSheet'
import { useNow } from '../hooks/useNow'
import { FOCUS_COLORS } from '../lib/phaseStyle'
import { doseName, getSubstance, splitNote } from '../lib/substances'
import { addDays, fmtTime, startOfLocalDay } from '../lib/time'

export function Log() {
  const now = useNow(60_000)
  const from = startOfLocalDay(now).getTime()
  const to = addDays(new Date(from), 1).getTime()
  const doses = useDoses(from, to)
  const checkins = useCheckins(from, to)
  const [entry, setEntry] = useState<Entry | null>(null)
  const fills = useFills()
  const all = useAllForProfile()
  const [fillSheet, setFillSheet] = useState<{ fill?: Fill } | null>(null)

  const items = useMemo(
    () =>
      [
        ...doses.map((d) => ({ t: Date.parse(d.takenAt), key: `d${d.id}`, e: { kind: 'dose', dose: d } as Entry })),
        ...checkins.map((c) => ({ t: Date.parse(c.at), key: `c${c.id}`, e: { kind: 'checkin', checkin: c } as Entry })),
      ].sort((a, b) => b.t - a.t),
    [doses, checkins],
  )

  return (
    <div className="scroll-y h-full pb-tabbar">
      <header className="pt-safe px-5 pb-4">
        <p className="text-[15px] text-muted">Doses and check-ins</p>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">Log</h1>
      </header>

      <div className="space-y-3 px-4">
        <section className="card">
          <CardHeader title="Dose or caffeine" />
          <div className="px-4 pb-4 pt-3">
            <DoseForm />
          </div>
        </section>

        <section className="card">
          <CardHeader title="How you feel" />
          <div className="px-4 pb-4 pt-3">
            <CheckinForm />
          </div>
        </section>

        <section className="card">
          <CardHeader title="Skipped or paused" />
          <div className="px-4 pb-4 pt-3">
            <SkipForm />
          </div>
        </section>

        <section className="card overflow-hidden">
          <CardHeader
            title="Fills"
            aside={
              <button type="button" onClick={() => setFillSheet({})} className="rounded-full bg-fill px-3 py-1 text-[13px] font-medium text-text">
                Add fill
              </button>
            }
          />
          {fills.length === 0 ? (
            <p className="px-4 pb-4 pt-1 text-[14px] leading-snug text-muted">
              Record which generic or manufacturer each refill was. If a new fill feels different, compare them in History.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {fills.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => setFillSheet({ fill: f })} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-fill">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: getSubstance(f.substance).color }} />
                    <span className="flex-1 text-[16px]">
                      {fillName(f)}
                      {f.pharmacy && <span className="text-muted">, {f.pharmacy}</span>}
                    </span>
                    <span className="text-[15px] text-muted">{new Date(f.filledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </button>
                  <SupplyLine fill={f} fills={fills} doses={all.doses} now={now} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <CardHeader title="Logged today" aside={items.length ? 'Tap to edit' : undefined} />
          {items.length === 0 ? (
            <p className="px-4 pb-4 pt-1 text-[15px] text-muted">Nothing yet. Entries you log today show up here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {items.map(({ t, key, e }) => (
                <li key={key}>
                  <button type="button" onClick={() => setEntry(e)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-fill">
                    {e.kind === 'dose' && (
                      <>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: getSubstance(e.dose.substance).color }} />
                        <span className="flex-1 text-[16px]">
                          {doseName(e.dose)}
                          {splitNote(e.dose) && <span className="text-muted"> ({splitNote(e.dose)})</span>}
                        </span>
                      </>
                    )}
                    {e.kind === 'checkin' && e.checkin.kind === 'wore_off' && (
                      <>
                        <span className="h-2.5 w-2.5 rounded-full border-2 border-text" />
                        <span className="flex-1 truncate text-[16px]">
                          {getSubstance(e.checkin.substance).name} wore off
                          {e.checkin.note && <span className="text-muted">, {e.checkin.note}</span>}
                        </span>
                      </>
                    )}
                    {e.kind === 'checkin' && e.checkin.kind === 'skipped' && (
                      <>
                        <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-muted" />
                        <span className="flex-1 truncate text-[16px]">
                          Skipped {getSubstance(e.checkin.substance).name}
                          <span className="text-muted">, {(e.checkin.reason ?? '').toLowerCase()}{e.checkin.note ? `, ${e.checkin.note}` : ''}</span>
                        </span>
                      </>
                    )}
                    {e.kind === 'checkin' && e.checkin.kind !== 'wore_off' && e.checkin.kind !== 'skipped' && (
                      <>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: FOCUS_COLORS[e.checkin.focus - 1] }} />
                        <span className="flex-1 truncate text-[16px]">
                          Focus {e.checkin.focus}, mood {e.checkin.mood}
                          {e.checkin.appetite ? `, appetite ${e.checkin.appetite}` : ''}
                          {e.checkin.tags?.length ? <span className="text-muted">, {e.checkin.tags.join(', ').toLowerCase()}</span> : null}
                          {e.checkin.context?.length ? <span className="text-muted">, {e.checkin.context.join(', ').toLowerCase()}</span> : null}
                          {e.checkin.note && <span className="text-muted">, {e.checkin.note}</span>}
                        </span>
                      </>
                    )}
                    <span className="text-[15px] text-muted">{fmtTime(t)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <EntrySheet entry={entry} onClose={() => setEntry(null)} />
      {fillSheet && <FillSheet initial={fillSheet.fill} onClose={() => setFillSheet(null)} />}
    </div>
  )
}

/** "About 21 left, about 14 days at your logged pace", with a one-tap refill reminder. */
function SupplyLine({ fill, fills, doses, now }: { fill: Fill & { id: number }; fills: (Fill & { id: number })[]; doses: Dose[]; now: number }) {
  const s = supplyFor(fill, fills, doses, now)
  if (!s) return null
  const left = Math.round(s.left * 2) / 2
  const lead = fill.refillLeadDays ?? 5
  const remindOn = s.runOut ? new Date(s.runOut.getTime() - lead * 24 * 3600_000) : null
  const when = remindOn && remindOn.getTime() > now ? remindOn : null

  function addReminder() {
    if (!s?.runOut) return
    const date = when ?? new Date(now + 24 * 3600_000)
    downloadIcs(
      buildEventsIcs([{ date, time: '09:00', label: `Request a refill: ${fillName(fill)}`, description: `From Dose Curve. About ${left} left when this was set.` }]),
      'dose-curve-refill.ics',
    )
  }

  return (
    <div className="-mt-1 flex items-center justify-between gap-3 px-4 pb-3 pl-[38px]">
      <span className="text-[14px] text-muted">
        About <span className="font-semibold text-text">{left}</span> left
        {s.daysLeft !== null ? `, about ${Math.floor(s.daysLeft)} ${Math.floor(s.daysLeft) === 1 ? 'day' : 'days'} at your logged pace` : ', pace shows after 3 days of doses'}
      </span>
      {s.runOut && (
        <button type="button" onClick={addReminder} className="shrink-0 rounded-full bg-fill px-3 py-1 text-[13px] font-medium">
          Refill reminder
        </button>
      )}
    </div>
  )
}
