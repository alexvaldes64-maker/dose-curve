import { useMemo, useRef, useState } from 'react'
import { DayCards, doseSummary } from '../components/DaySummary'
import { detailStart } from '../components/DayView'
import { EffectRing } from '../components/EffectRing'
import { EntrySheet, type Entry } from '../components/EntrySheet'
import { Stat } from '../components/Stat'
import { SubstanceChips } from '../components/SubstanceChips'
import { PX_PER_HOUR, TOP_PAD } from '../components/Timeline'
import { db, downloadBackup, logWoreOff, saveSettings, toggleSample, useActiveProfile, useBackupDue, useHasSample, useLastSubstance, type Settings } from '../db'
import { Avatar, ProfileSheet } from '../components/ProfileSheet'
import { pickSubstance, useDayModel } from '../hooks/useDayModel'
import { useNow } from '../hooks/useNow'
import { HOUR, clampDisplay, levelAt, phaseAt } from '../lib/model'
import { nowLabel, statusSentence } from '../lib/phaseStyle'
import { currentDay, dateKey, fmtAgo, fmtTime } from '../lib/time'
import { doseName, getSubstance } from '../lib/substances'
import { offerUndo } from '../lib/undo'
import { ScheduleSheet } from '../components/ScheduleSheet'

export function Today({ settings, onAdjust }: { settings: Settings; onAdjust?: (substanceId: string) => void }) {
  const now = useNow()
  const dayStartMs = currentDay(now, settings.wakeTime, settings.bedtime, settings.daySchedules).getTime()
  const day = useMemo(() => new Date(dayStartMs), [dayStartMs])
  const lastSubstance = useLastSubstance()
  const day$ = useDayModel(day, settings, lastSubstance)
  const [requested, setRequested] = useState<string | null>(null)
  const m = pickSubstance(day$.substances, requested, now) ?? day$.empty
  const others = day$.substances.filter((d) => d.id !== m.id)
  const hasSample = useHasSample()
  const backupDue = useBackupDue()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [profilesOpen, setProfilesOpen] = useState(false)
  const profile = useActiveProfile()
  const scrollRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLElement>(null)

  const inWindow = now >= m.start && now <= m.end
  const phase = inWindow ? phaseAt(m.segments, now) : 'Clear'
  const pct = inWindow ? clampDisplay(levelAt(m.samples, now)) : 0
  const hasDoses = m.doses.length > 0 || m.maxEffect > 0
  const last = m.doses[m.doses.length - 1]
  const ring = hasDoses
    ? nowLabel(m.segments, now, phase, m.doses.some((d) => Date.parse(d.takenAt) <= now))
    : { label: 'Clear', color: 'var(--muted)' }

  function goToNow() {
    const el = scrollRef.current
    const box = detailRef.current
    if (!el || !box) return
    const y = box.offsetTop + 52 + TOP_PAD + ((now - detailStart(m)) / HOUR) * PX_PER_HOUR
    el.scrollTo({ top: y - el.clientHeight * 0.5, behavior: 'smooth' })
  }

  const bedtimeOthers = others.filter((o) => o.bedtimePlasma >= 1)
  // Answers "did I take it?": the most recent dose of anything today, up to now.
  const lastToday = day$.doses.filter((d) => Date.parse(d.takenAt) <= now).at(-1)
  const skippedToday = day$.checkins.filter((c) => c.kind === 'skipped').at(-1)
  // Observed wear-off: offered for medications once today's first dose has been taken.
  const firstDose = m.doses.length ? Math.min(...m.doses.map((d) => Date.parse(d.takenAt))) : null
  const woreOffToday = m.checkins.find((c) => c.kind === 'wore_off' && c.substance === m.id && firstDose !== null && Date.parse(c.at) >= firstDose)
  const canMarkWoreOff = inWindow && m.id !== 'caffeine' && firstDose !== null && firstDose <= now

  return (
    <div ref={scrollRef} className="scroll-y h-full pb-tabbar">
      <header className="pt-safe flex items-end justify-between px-5 pb-4">
        <div>
          <p className="text-[15px] text-muted">{day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">{profile.kind === 'child' ? `${profile.name}'s day` : 'Today'}</h1>
          <button type="button" onClick={() => setScheduleOpen(true)} className="mt-0.5 text-[14px] text-muted">
            {fmtTime(m.start)} to {fmtTime(m.end)}
            {settings.daySchedules?.[dateKey(day)] ? ', custom' : ''} <span className="font-medium text-[var(--onset)]">Change</span>
          </button>
        </div>
        <div className="mb-1 flex items-center gap-2">
          <button type="button" aria-label={`Profile: ${profile.name}. Switch profile`} onClick={() => setProfilesOpen(true)} className="rounded-full active:scale-95">
            <Avatar p={profile} size={44} />
          </button>
          <button
            type="button"
            aria-label="Log a dose or check-in"
            onClick={() => setEntry({ kind: 'new' })}
            className="card grid h-11 w-11 place-items-center rounded-full text-[26px] font-light leading-none active:scale-95"
          >
            +
          </button>
        </div>
      </header>

      <div className="space-y-3 px-4">
        <p className="-mt-1 flex items-start gap-2 px-1 text-[15px] leading-snug" role="status">
          <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${lastToday ? 'bg-good' : 'bg-clear'}`} />
          {lastToday ? (
            <span>
              Last logged <span className="font-semibold">{doseName(lastToday)}</span> at {fmtTime(Date.parse(lastToday.takenAt))},{' '}
              <span className="font-semibold">{fmtAgo(now - Date.parse(lastToday.takenAt))}</span>
            </span>
          ) : skippedToday ? (
            <span>
              Logged <span className="font-semibold">{getSubstance(skippedToday.substance).name}</span> as skipped today
              <span className="text-muted"> ({(skippedToday.reason ?? '').toLowerCase()})</span>
            </span>
          ) : (
            <span className="text-muted">Nothing logged today</span>
          )}
        </p>

        {hasSample && (
          <div className="card flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-[15px] leading-snug">This is a sample dose at 9:30a, so you can see how the curve works.</p>
            <button type="button" onClick={() => toggleSample(day)} className="shrink-0 rounded-full bg-fill px-4 py-2 text-[15px] font-semibold">
              Remove
            </button>
          </div>
        )}

        {backupDue && !hasSample && (
          <div className="card px-4 py-3.5">
            <p className="text-[16px] font-semibold">Back up your log</p>
            <p className="mt-0.5 text-[14px] leading-snug text-muted">It only lives on this phone. Save a copy somewhere safe now and then.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => downloadBackup()} className="rounded-full bg-text px-4 py-2 text-[15px] font-semibold text-card">
                Back up now
              </button>
              <button
                type="button"
                onClick={() => saveSettings({ backupSnoozedUntil: new Date(Date.now() + 14 * 24 * HOUR).toISOString() })}
                className="rounded-full px-4 py-2 text-[15px] font-medium text-muted"
              >
                Later
              </button>
            </div>
          </div>
        )}

        <SubstanceChips days={day$.substances} selected={m.id} onSelect={setRequested} />

        <section className="card flex items-center gap-5 p-5">
          <EffectRing pct={pct} label={ring.label} color={ring.color} animKey={m.dataKey} />
          <div className="min-w-0 flex-1">
            {day$.substances.length > 1 && (
              <p className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: m.preset.color }} />
                {m.preset.name}
              </p>
            )}
            <p className="text-[17px] font-semibold leading-snug">{statusSentence(m.segments, now, phase, hasDoses)}</p>
            <p className="mt-2 text-[14px] leading-snug text-muted">
              {!hasDoses ? (profile.kind === 'child' ? 'Tap + to log a dose. Its span shows up here.' : 'Tap + to log a dose or a coffee. Its span shows up here.') : m.doses.length ? doseSummary(m.doses) : 'Carried over from yesterday.'}
            </p>
          </div>
        </section>

        {canMarkWoreOff && (
          <div className="card flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-[15px] leading-snug">
              {woreOffToday ? (
                <>
                  Wore off logged at <span className="font-semibold">{fmtTime(Date.parse(woreOffToday.at))}</span>
                </>
              ) : (
                <>Felt {m.preset.name} wear off?</>
              )}
            </p>
            {!woreOffToday && (
              <button
                type="button"
                onClick={async () => {
                  const id = await logWoreOff(m.id)
                  offerUndo(`Marked ${m.preset.name} as worn off at ${fmtTime(Date.now())}.`, () => db.checkins.delete(id))
                }}
                className="shrink-0 rounded-full bg-text px-4 py-2 text-[15px] font-semibold text-card active:opacity-80"
              >
                It wore off
              </button>
            )}
          </div>
        )}

        {hasDoses && (
          <div className="flex gap-3">
            {last ? (
              <Stat label="Last dose" value={last.mg} unit="mg" note={`at ${fmtTime(Date.parse(last.takenAt))}`} dot={m.preset.color} />
            ) : (
              <Stat label="Last dose" value="None" note="today" dot={m.preset.color} />
            )}
            <Stat
              label="At sleep"
              value={Math.round(m.bedtimePlasma)}
              unit="%"
              note={bedtimeOthers.length ? bedtimeOthers.map((o) => `${o.preset.name} ${Math.round(o.bedtimePlasma)}%`).join(', ') : 'est. blood level'}
            />
          </div>
        )}

        <DayCards
          m={m}
          others={others}
          settings={settings}
          now={now}
          detailRef={detailRef}
          detailAside={
            inWindow ? (
              <button type="button" onClick={goToNow} className="rounded-full bg-fill px-3 py-1 text-[13px] font-medium text-text">
                Go to now
              </button>
            ) : undefined
          }
          onDose={(dose) => setEntry({ kind: 'dose', dose })}
          onCheckin={(checkin) => setEntry({ kind: 'checkin', checkin })}
          onAdjust={onAdjust}
        />

        {import.meta.env.DEV && !hasSample && (
          <button type="button" onClick={() => toggleSample(day)} className="w-full py-3 text-[13px] text-muted underline decoration-dotted underline-offset-4">
            Add sample dose at 9:30a (dev)
          </button>
        )}
      </div>

      <EntrySheet entry={entry} onClose={() => setEntry(null)} />
      {profilesOpen && <ProfileSheet onClose={() => setProfilesOpen(false)} />}
      {scheduleOpen && <ScheduleSheet day={day} settings={settings} onClose={() => setScheduleOpen(false)} />}
    </div>
  )
}
