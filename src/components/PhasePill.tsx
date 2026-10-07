import type { Phase } from '../lib/model'
import { PHASE_COLOR, PHASE_LABEL } from '../lib/phaseStyle'
import { fmtTime } from '../lib/time'

/** Label at the top of a phase band, right-aligned, in the phase's own color. */
export function PhasePill({ y, phase, start }: { y: number; phase: Phase; start: number }) {
  return (
    <div className="pointer-events-none absolute right-3 z-10 text-right leading-tight" style={{ top: y + 8 }}>
      <div className="text-[14px] font-semibold" style={{ color: PHASE_COLOR[phase] }}>
        {PHASE_LABEL[phase]}
      </div>
      <div className="text-[12px] text-muted">{fmtTime(start)}</div>
    </div>
  )
}
