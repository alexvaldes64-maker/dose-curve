import type { Phase, PhaseSegment } from '../lib/model'
import { PHASE_COLOR, PHASE_LABEL, activeSegments, clearBy } from '../lib/phaseStyle'
import { fmtTime } from '../lib/time'

/** The day's phases in order, with times. The current one is marked. */
export function PhaseList({ segments, now, current }: { segments: PhaseSegment[]; now?: number; current?: Phase }) {
  const active = activeSegments(segments)
  if (!active.length) return null
  const clear = clearBy(segments)
  const row = 'flex items-center gap-3 px-4 py-3.5'
  return (
    <ol className="divide-y divide-line">
      {active.map((s, i) => {
        const isNow = now !== undefined && now >= s.start && now <= s.end && current === s.phase
        const runsToEnd = i === active.length - 1 && clear === null
        const when = (i === 0 && s.phase === 'Onset') || runsToEnd ? `from ${fmtTime(s.start)}` : `${fmtTime(s.start)} to ${fmtTime(s.end)}`
        return (
          <li key={s.start} className={row}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PHASE_COLOR[s.phase] }} />
            <span className={`flex-1 text-[16px] ${isNow ? 'font-semibold' : ''}`}>{PHASE_LABEL[s.phase]}</span>
            {isNow && (
              <span className="rounded-full px-2 py-0.5 text-[12px] font-semibold text-white" style={{ background: PHASE_COLOR[s.phase] }}>
                Now
              </span>
            )}
            <span className="text-[15px] text-muted">{when}</span>
          </li>
        )
      })}
      <li className={row}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-clear" />
        <span className="flex-1 text-[16px] text-muted">Clear</span>
        <span className="text-[15px] text-muted">{clear ? `by ${fmtTime(clear)}` : 'after sleep time'}</span>
      </li>
    </ol>
  )
}
