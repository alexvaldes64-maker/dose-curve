import { area, curveMonotoneY, line } from 'd3-shape'
import type { PhaseSegment, Sample } from '../lib/model'
import { PHASE_COLOR } from '../lib/phaseStyle'
import type { Geometry } from './Timeline'

interface Props {
  g: Geometry
  samples: Sample[]
  segments: PhaseSegment[]
  showPlasma: boolean
  animKey: string
}

/** Vertical effect shape: x is effect, y is time. Filled and stroked in the color of each phase. */
export function Curve({ g, samples, segments, showPlasma, animKey }: Props) {
  const ln = (key: 'effect' | 'plasma' | 'early' | 'late') =>
    line<Sample>().x((s) => g.xOf(s[key])).y((s) => g.yOf(s.t)).curve(curveMonotoneY)(samples) ?? ''
  const band =
    area<Sample>()
      .x0((s) => g.xOf(Math.min(s.early, s.late)))
      .x1((s) => g.xOf(Math.max(s.early, s.late)))
      .y((s) => g.yOf(s.t))
      .curve(curveMonotoneY)(samples) ?? ''
  const fill = area<Sample>().x0(g.baseX).x1((s) => g.xOf(s.effect)).y((s) => g.yOf(s.t)).curve(curveMonotoneY)(samples) ?? ''

  return (
    <svg className="pointer-events-none absolute inset-0" width={g.width} height={g.height} aria-hidden>
      <defs>
        <linearGradient id="phaseGradV" gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={0} y2={g.height}>
          {segments.flatMap((s) => [
            <stop key={`${s.start}a`} offset={g.yOf(s.start) / g.height} style={{ stopColor: PHASE_COLOR[s.phase] }} />,
            <stop key={`${s.start}b`} offset={g.yOf(s.end) / g.height} style={{ stopColor: PHASE_COLOR[s.phase] }} />,
          ])}
        </linearGradient>
      </defs>
      <path d={band} fill="var(--band)" />
      <path d={fill} fill="url(#phaseGradV)" opacity={0.18} />
      {showPlasma && <path d={ln('plasma')} fill="none" stroke="var(--muted)" strokeWidth={1.25} strokeDasharray="3 4" />}
      <path key={animKey} className="draw" pathLength={1} d={ln('effect')} fill="none" stroke="url(#phaseGradV)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
