import { area, curveMonotoneX, line } from 'd3-shape'
import { useId } from 'react'
import type { DayModel, SubstanceDay } from '../hooks/useDayModel'
import { useWidth } from '../hooks/useWidth'
import { HOUR, levelAt, type Sample } from '../lib/model'
import { FOCUS_COLORS, PHASE_COLOR } from '../lib/phaseStyle'
import { fmtHour } from '../lib/time'

const H = 150
const PAD_L = 4
const PAD_R = 30
const TOP = 26

/** Bevel-style chart of the whole day: phase-colored line, soft fill, shaded timing band, 100% guide. */
export function SpanHill({ m, others = [], now, showPlasma }: { m: DayModel; others?: SubstanceDay[]; now?: number; showPlasma: boolean }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const id = 'c' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const span = m.end - m.start
  const plotW = W - PAD_L - PAD_R
  const x = (t: number) => PAD_L + ((t - m.start) / span) * plotW
  const base = TOP + H
  const y = (e: number) => base - (Math.min(120, Math.max(0, e)) / 120) * H

  const gen = (k: 'effect' | 'plasma') => line<Sample>().x((s) => x(s.t)).y((s) => y(s[k])).curve(curveMonotoneX)(m.samples) ?? ''
  const fill = area<Sample>().x((s) => x(s.t)).y0(base).y1((s) => y(s.effect)).curve(curveMonotoneX)(m.samples) ?? ''
  const band =
    area<Sample>()
      .x((s) => x(s.t))
      .y0((s) => y(Math.min(s.early, s.late)))
      .y1((s) => y(Math.max(s.early, s.late)))
      .curve(curveMonotoneX)(m.samples) ?? ''

  const ticks: number[] = []
  for (let t = Math.ceil(m.start / HOUR) * HOUR; t <= m.end; t += HOUR) if (new Date(t).getHours() % 4 === 0) ticks.push(t)
  const showNow = now !== undefined && now >= m.start && now <= m.end
  const nowLevel = showNow ? levelAt(m.samples, now!) : 0
  const stops = m.segments.flatMap((s) => [
    <stop key={`${s.start}a`} offset={(x(s.start) - PAD_L) / plotW} style={{ stopColor: PHASE_COLOR[s.phase] }} />,
    <stop key={`${s.start}b`} offset={(x(s.end) - PAD_L) / plotW} style={{ stopColor: PHASE_COLOR[s.phase] }} />,
  ])

  return (
    <div ref={ref} className="w-full">
      {W > 0 && (
        <svg width={W} height={base + 26} role="img" aria-label="Estimated effect across the day">
          <defs>
            <linearGradient id={`${id}s`} gradientUnits="userSpaceOnUse" x1={PAD_L} x2={W - PAD_R} y1={0} y2={0}>
              {stops}
            </linearGradient>
            <linearGradient id={`${id}f`} x1={0} x2={0} y1={0} y2={1}>
              <stop offset={0} stopColor="#fff" stopOpacity={0.55} />
              <stop offset={1} stopColor="#fff" stopOpacity={0} />
            </linearGradient>
            <mask id={`${id}m`}>
              <rect x={0} y={0} width={W} height={base} fill={`url(#${id}f)`} />
            </mask>
          </defs>

          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v === 100 ? '3 4' : undefined} />
              <text x={W - PAD_R + 6} y={y(v) + 4} fill="var(--muted)" fontSize={11}>
                {v}
              </text>
            </g>
          ))}

          <path d={band} fill="var(--band)" />
          {others.map((o) => (
            <g key={o.id}>
              <path
                d={line<Sample>().x((s) => x(s.t)).y((s) => y(s.effect)).curve(curveMonotoneX)(o.samples) ?? ''}
                fill="none"
                stroke={o.preset.color}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.9}
              />
              {o.doses.map((d) => (
                <circle key={d.id} cx={x(Date.parse(d.takenAt))} cy={base} r={4} fill={o.preset.color} stroke="var(--card)" strokeWidth={1.5} />
              ))}
            </g>
          ))}
          <path d={fill} fill={`url(#${id}s)`} mask={`url(#${id}m)`} opacity={0.5} />
          {showPlasma && <path d={gen('plasma')} fill="none" stroke="var(--muted)" strokeWidth={1.25} strokeDasharray="3 4" />}
          <path key={m.dataKey} className="draw" pathLength={1} d={gen('effect')} fill="none" stroke={`url(#${id}s)`} strokeWidth={3} strokeLinecap="round" />

          {m.doses.map((d) => (
            <circle key={d.id} cx={x(Date.parse(d.takenAt))} cy={base} r={4.5} fill="var(--card)" stroke="var(--text)" strokeWidth={2} />
          ))}
          {m.checkins
            .filter((c) => c.kind !== 'wore_off')
            .map((c) => (
              <circle key={c.id} cx={x(Date.parse(c.at))} cy={y(levelAt(m.samples, Date.parse(c.at)))} r={4} fill={FOCUS_COLORS[c.focus - 1]} stroke="var(--card)" strokeWidth={1.5} />
            ))}
          {m.checkins
            .filter((c) => c.kind === 'wore_off' && (!c.substance || c.substance === m.id))
            .map((c) => (
              <g key={c.id}>
                <line x1={x(Date.parse(c.at))} x2={x(Date.parse(c.at))} y1={y(levelAt(m.samples, Date.parse(c.at)))} y2={base} stroke="var(--text)" strokeWidth={1.5} strokeDasharray="2 3" />
                <circle cx={x(Date.parse(c.at))} cy={y(levelAt(m.samples, Date.parse(c.at)))} r={5} fill="var(--card)" stroke="var(--text)" strokeWidth={2} />
              </g>
            ))}

          {showNow && (
            <g>
              <line x1={x(now!)} x2={x(now!)} y1={TOP - 4} y2={base} stroke="var(--text)" strokeOpacity={0.25} />
              <rect x={x(now!) - 19} y={TOP - 24} width={38} height={18} rx={9} fill="var(--text)" />
              <text x={x(now!)} y={TOP - 11} textAnchor="middle" fill="var(--card)" fontSize={11} fontWeight={600}>
                Now
              </text>
              <circle cx={x(now!)} cy={y(nowLevel)} r={6} fill="var(--card)" stroke="var(--text)" strokeWidth={2.5} />
            </g>
          )}

          {ticks.map((t) => (
            <text key={t} x={x(t)} y={base + 20} textAnchor="middle" fill="var(--muted)" fontSize={12}>
              {fmtHour(t)}
            </text>
          ))}
        </svg>
      )}
    </div>
  )
}
