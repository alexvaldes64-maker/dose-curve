import { useMemo, useState } from 'react'
import { DayCards, doseSummary } from '../components/DaySummary'
import { EntrySheet, type Entry } from '../components/EntrySheet'
import { Stat } from '../components/Stat'
import { SubstanceChips } from '../components/SubstanceChips'
import { useFills, type Settings } from '../db'
import { CompareSheet } from '../components/CompareSheet'
import { SummaryView } from '../components/SummaryView'
import { pickSubstance, useDayModel } from '../hooks/useDayModel'
import { useNow } from '../hooks/useNow'
import { addDays, fmtDayLong, fmtDayShort, startOfLocalDay } from '../lib/time'

export function History({ settings, onAdjust }: { settings: Settings; onAdjust?: (substanceId: string) => void }) {
  const now = useNow(60_000)
  const todayMs = startOfLocalDay(now).getTime()
  const days = useMemo(() => Array.from({ length: 30 }, (_, i) => addDays(new Date(todayMs), -i)), [todayMs])
  const [idx, setIdx] = useState(0)
  const day = days[idx]
  const day$ = useDayModel(day, settings)
  const [requested, setRequested] = useState<string | null>(null)
  const isToday = idx === 0
  const m = pickSubstance(day$.substances, requested, isToday ? now : day$.end) ?? day$.empty
  const others = day$.substances.filter((d) => d.id !== m.id)
  const [entry, setEntry] = useState<Entry | null>(null)
  const fills = useFills()
  const [compareOpen, setCompareOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)

  return (
    <div className="scroll-y h-full pb-tabbar">
      <header className="pt-safe px-5 pb-3">
        <p className="text-[15px] text-muted">Last 30 days</p>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">History</h1>
      </header>

      <div className="scroll-x flex gap-2 px-4 pb-4" role="tablist" aria-label="Day">
        {days.map((d, i) => {
          const { dow, date } = fmtDayShort(d)
          const on = i === idx
          return (
            <button
              key={d.getTime()}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setIdx(i)}
              className={`flex w-[52px] shrink-0 flex-col items-center rounded-2xl py-2 ${on ? 'bg-text text-card' : 'card'}`}
            >
              <span className={`text-[12px] ${on ? 'opacity-70' : 'text-muted'}`}>{i === 0 ? 'Today' : dow}</span>
              <span className="num text-[19px]">{date}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-3 px-4">
        <div className="px-1">
          <h2 className="text-[20px] font-semibold">{isToday ? 'Today' : fmtDayLong(day)}</h2>
          <p className="mt-0.5 text-[15px] text-muted">{day$.doses.length ? doseSummary(day$.doses) : 'No doses logged this day.'}</p>
        </div>

        <SubstanceChips days={day$.substances} selected={m.id} onSelect={setRequested} />

        <button type="button" onClick={() => setSummaryOpen(true)} className="card flex w-full items-center justify-between px-4 py-3.5 text-left">
          <span>
            <span className="block text-[16px] font-semibold">Summary for your prescriber</span>
            <span className="block text-[13px] text-muted">Print, save as PDF, or download CSV</span>
          </span>
          <span className="text-[14px] font-medium text-[var(--onset)]">Open</span>
        </button>

        {fills.length > 0 && (
          <button type="button" onClick={() => setCompareOpen(true)} className="card flex w-full items-center justify-between px-4 py-3.5 text-left">
            <span>
              <span className="block text-[16px] font-semibold">Compare fills</span>
              <span className="block text-[13px] text-muted">Side by side, from what you logged</span>
            </span>
            <span className="text-[14px] font-medium text-[var(--onset)]">Open</span>
          </button>
        )}

        {m.doses.length > 0 && (
          <div className="flex gap-3">
            <Stat label="Taken" value={m.doses.reduce((a, d) => a + d.mg, 0)} unit="mg" note={`${m.doses.length} ${m.doses.length === 1 ? 'dose' : 'doses'} of ${m.preset.name}`} dot={m.preset.color} />
            <Stat label="Highest" value={Math.round(m.maxEffect)} unit="%" note="of a typical dose's peak" />
          </div>
        )}

        <DayCards
          key={`${day.getTime()}${m.id}`}
          m={m}
          others={others}
          settings={settings}
          now={isToday ? now : undefined}
          onDose={(dose) => setEntry({ kind: 'dose', dose })}
          onCheckin={(checkin) => setEntry({ kind: 'checkin', checkin })}
          onAdjust={onAdjust}
        />
      </div>

      <EntrySheet entry={entry} onClose={() => setEntry(null)} />
      {compareOpen && <CompareSheet onClose={() => setCompareOpen(false)} />}
      {summaryOpen && <SummaryView settings={settings} onClose={() => setSummaryOpen(false)} />}
    </div>
  )
}
