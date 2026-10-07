import type { ReactNode } from 'react'
import { HOUR, MINUTE, type PhaseSegment } from '../lib/model'
import { PHASE_COLOR } from '../lib/phaseStyle'
import { fmtHour } from '../lib/time'

export const GUTTER = 44
export const PX_PER_HOUR = 104
export const TOP_PAD = 20
export const BOTTOM_PAD = 72

export interface Geometry {
  width: number
  height: number
  start: number
  end: number
  baseX: number
  yOf: (t: number) => number
  xOf: (effect: number) => number
}

export function makeGeometry(width: number, start: number, end: number): Geometry {
  const baseX = GUTTER + 10
  const plotW = Math.max(120, (width - GUTTER) * 0.5)
  return {
    width,
    start,
    end,
    baseX,
    height: TOP_PAD + ((end - start) / HOUR) * PX_PER_HOUR + BOTTOM_PAD,
    yOf: (t) => TOP_PAD + ((t - start) / HOUR) * PX_PER_HOUR,
    xOf: (e) => baseX + (Math.min(120, Math.max(0, e)) / 120) * plotW,
  }
}

/** Vertical time axis, time running top to bottom, with faint full-width phase bands behind everything. */
export function Timeline({ g, segments, now, children }: { g: Geometry; segments: PhaseSegment[]; now?: number; children?: ReactNode }) {
  const ticks: { t: number; hour: boolean }[] = []
  const first = Math.ceil(g.start / (15 * MINUTE)) * 15 * MINUTE
  for (let t = first; t <= g.end; t += 15 * MINUTE) ticks.push({ t, hour: new Date(t).getMinutes() === 0 })

  return (
    <div className="relative" style={{ height: g.height }}>
      {segments
        .filter((s) => s.phase !== 'Clear')
        .map((s) => (
          <div
            key={s.start}
            aria-hidden
            className="absolute inset-x-0"
            style={{ top: g.yOf(s.start), height: g.yOf(s.end) - g.yOf(s.start), background: PHASE_COLOR[s.phase], opacity: 0.08 }}
          />
        ))}
      <div className="absolute inset-y-0 left-0" style={{ width: GUTTER }} aria-hidden>
        {ticks.map(({ t, hour }) => (
          <div key={t} className="absolute right-0 flex items-center" style={{ top: g.yOf(t), transform: 'translateY(-50%)' }}>
            {hour && !(now !== undefined && Math.abs(g.yOf(t) - g.yOf(now)) < 14) && <span className="mr-2 text-[12px] text-muted">{fmtHour(t)}</span>}
            <span className={hour ? 'h-px w-1.5 bg-line' : 'h-px w-1 bg-line/60'} />
          </div>
        ))}
      </div>
      <div className="absolute w-px bg-line" style={{ left: g.baseX, top: g.yOf(g.start), height: g.yOf(g.end) - g.yOf(g.start) }} aria-hidden />
      {children}
    </div>
  )
}
