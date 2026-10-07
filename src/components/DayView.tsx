import { useMemo } from 'react'
import type { Checkin, Dose, Settings } from '../db'
import type { DayModel } from '../hooks/useDayModel'
import { useWidth } from '../hooks/useWidth'
import { HOUR, levelAt } from '../lib/model'
import { FOCUS_COLORS } from '../lib/phaseStyle'
import { fmtTime } from '../lib/time'
import { doseName } from '../lib/substances'
import { Curve } from './Curve'
import { EventCard, stackCards } from './EventCard'
import { NowLine } from './NowLine'
import { PhasePill } from './PhasePill'
import { Timeline, makeGeometry } from './Timeline'

interface Props {
  m: DayModel
  settings: Settings
  now?: number
  onDose?: (d: Dose) => void
  onCheckin?: (c: Checkin) => void
}

/** Phase labels are about 34px tall; push each below the previous so they never overlap. */
function pillTops<T extends { y: number }>(items: T[]): T[] {
  let floor = -Infinity
  return items.map((it) => {
    const y = Math.max(it.y, floor)
    floor = y + 36
    return { ...it, y }
  })
}

/** Where the hour-by-hour view begins: an hour before the first dose, or wake time if that is later or nothing is logged. */
export function detailStart(m: DayModel): number {
  if (!m.doses.length) return m.start
  const first = Math.min(...m.doses.map((d) => Date.parse(d.takenAt)))
  return Math.max(m.start, Math.floor(first / HOUR) * HOUR - HOUR)
}

/** Hour by hour: the vertical timeline with phase bands, the effect shape, doses, check-ins and bedtime. */
export function DayView({ m, settings, now, onDose, onCheckin }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const from = detailStart(m)
  const g = useMemo(() => makeGeometry(width, from, m.end), [width, from, m.end])
  const samples = useMemo(() => m.samples.filter((s) => s.t >= from), [m.samples, from])
  const segments = useMemo(
    () => m.segments.filter((s) => s.end > from).map((s) => ({ ...s, start: Math.max(s.start, from) })),
    [m.segments, from],
  )
  const at = (t: number) => ({ x: g.xOf(levelAt(m.samples, t)), y: g.yOf(t) })
  const showNow = now !== undefined && now >= m.start && now <= m.end

  const labels = stackCards(
    m.doses.map((dose) => {
      const p = at(Date.parse(dose.takenAt))
      return { y: p.y, x: p.x, dose }
    }),
  )

  return (
    <div ref={ref} className="relative w-full overflow-hidden">
      {width > 0 && (
        <Timeline g={g} segments={segments} now={showNow ? now : undefined}>
          <Curve g={g} samples={samples} segments={segments} showPlasma={settings.model === 'tolerance'} animKey={m.dataKey} />

          {pillTops(segments.filter((s) => s.phase !== 'Clear').map((s) => ({ s, y: g.yOf(s.start) }))).map(({ s, y }) => (
            <PhasePill key={s.start} y={y} phase={s.phase} start={s.start} />
          ))}

          {m.doses.map((d) => {
            const p = at(Date.parse(d.takenAt))
            return (
              <span
                key={`dot${d.id}`}
                className="absolute z-10 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-text"
                style={{ left: p.x, top: p.y }}
              />
            )
          })}
          {labels.map((l) => (
            <EventCard key={`lab${l.dose.id}`} x={l.x + 8} top={l.top} onClick={onDose ? () => onDose(l.dose) : undefined}>
              <span className="font-semibold">{doseName(l.dose)}</span>
              <span className="ml-1 text-muted">at {fmtTime(Date.parse(l.dose.takenAt))}</span>
            </EventCard>
          ))}

          {m.checkins.filter((c) => c.kind === 'rating').map((c) => {
            const p = at(Date.parse(c.at))
            return (
              <button
                key={`c${c.id}`}
                type="button"
                aria-label={`Check-in at ${fmtTime(Date.parse(c.at))}, focus ${c.focus}, mood ${c.mood}`}
                onClick={onCheckin ? () => onCheckin(c) : undefined}
                className="absolute z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
                style={{ left: p.x, top: p.y, background: FOCUS_COLORS[c.focus - 1] }}
              />
            )
          })}
          {m.checkins
            .filter((c) => c.kind === 'wore_off' && (!c.substance || c.substance === m.id))
            .map((c) => {
              const p = at(Date.parse(c.at))
              return (
                <button
                  key={`w${c.id}`}
                  type="button"
                  onClick={onCheckin ? () => onCheckin(c) : undefined}
                  className="absolute z-10 flex -translate-y-1/2 items-center gap-1.5"
                  style={{ left: p.x - 7, top: p.y }}
                >
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-text bg-card" />
                  <span className="rounded-full bg-text px-2 py-0.5 text-[11px] font-semibold text-card">Wore off {fmtTime(Date.parse(c.at))}</span>
                </button>
              )
            })}

          <div className="absolute inset-x-0" style={{ top: g.yOf(m.end) }}>
            <div className="border-t border-dashed border-line" style={{ marginLeft: g.baseX }} />
            <div className="flex items-baseline justify-between pr-3 pt-2.5" style={{ paddingLeft: g.baseX }}>
              <span className="text-[15px] font-medium">Sleep {fmtTime(m.end)}</span>
              <span className="text-[13px] text-muted">blood level about {Math.round(m.bedtimePlasma)}%</span>
            </div>
          </div>

          {showNow && <NowLine y={g.yOf(now!)} width={g.width} />}
        </Timeline>
      )}
    </div>
  )
}
