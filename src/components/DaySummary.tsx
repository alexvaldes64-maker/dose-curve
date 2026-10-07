import { useMemo, type ReactNode } from 'react'
import { useAllForProfile } from '../db'
import { observedWearOff } from '../lib/compare'
import type { Checkin, Dose, Settings } from '../db'
import type { DayModel, SubstanceDay } from '../hooks/useDayModel'
import { doseName } from '../lib/substances'
import { phaseAt } from '../lib/model'
import { fmtTime } from '../lib/time'
import { DayView } from './DayView'
import { PhaseList } from './PhaseList'
import { SpanHill } from './SpanHill'

/** "20 mg Adderall IR at 9:30a", two joined with "and", or "3 doses". */
export function doseSummary(doses: Dose[]): string {
  if (!doses.length) return 'No doses logged'
  const one = (x: Dose) => `${doseName(x)} at ${fmtTime(Date.parse(x.takenAt))}`
  if (doses.length <= 2) return doses.map(one).join(' and ')
  return `${doses.length} doses logged`
}

export function CardHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-1 pt-4">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {aside && <div className="text-[13px] text-muted">{aside}</div>}
    </div>
  )
}

/** Chart, phases and hour-by-hour cards for one day. Shared by Today and History. */
export function DayCards({
  m,
  others = [],
  settings,
  now,
  onDose,
  onCheckin,
  detailRef,
  detailAside,
  onAdjust,
}: {
  m: DayModel
  others?: SubstanceDay[]
  settings: Settings
  now?: number
  onDose?: (d: Dose) => void
  onCheckin?: (c: Checkin) => void
  detailRef?: React.Ref<HTMLElement>
  detailAside?: ReactNode
  /** Opens the timing settings for a substance. */
  onAdjust?: (substanceId: string) => void
}) {
  const current = now !== undefined ? phaseAt(m.segments, now) : undefined
  const hasDoses = m.doses.length > 0
  const all = useAllForProfile()
  const observed = useMemo(() => observedWearOff(m.id, all.doses, all.checkins), [m.id, all])
  return (
    <>
      <section className="card overflow-hidden">
        <CardHeader title="Effect" aside="% of a typical dose's peak" />
        {others.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-1 text-[13px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-4 rounded-full" style={{ background: 'linear-gradient(90deg, var(--onset), var(--peak), var(--taper), var(--comedown))' }} />
              {m.preset.name}
            </span>
            {others.map((o) => (
              <span key={o.id} className="flex items-center gap-1.5">
                <span className="h-[3px] w-4 rounded-full" style={{ background: o.preset.color }} />
                {o.preset.name}
              </span>
            ))}
          </div>
        )}
        <div className="px-3 pb-2 pt-2">
          <SpanHill m={m} others={others} now={now} showPlasma={settings.model === 'tolerance'} />
        </div>
        {settings.model === 'tolerance' && hasDoses && (
          <p className="px-4 pb-1 text-[13px] text-muted">Dashed line is estimated blood level.</p>
        )}
        {onAdjust && hasDoses && (
          <button type="button" onClick={() => onAdjust(m.id)} className="px-4 pb-3.5 pt-1 text-[14px] font-medium text-[var(--onset)]">
            Adjust {m.preset.name} timing
          </button>
        )}
      </section>

      {hasDoses && (
        <section className="card overflow-hidden">
          <CardHeader title="Phases" />
          <PhaseList segments={m.segments} now={now} current={current} />
          {observed.days >= 3 && observed.medianHours !== null && (
            <p className="border-t border-line px-4 py-3 text-[14px] leading-snug text-muted">
              You usually log {m.preset.name} wearing off about <span className="font-semibold text-text">{observed.medianHours.toFixed(1)} h</span> after your first dose
              ({observed.days} days logged). The phases above are the general estimate.
            </p>
          )}
        </section>
      )}

      <section ref={detailRef} className="card overflow-hidden">
        <CardHeader title="Hour by hour" aside={detailAside} />
        <div className="pt-2">
          <DayView m={m} settings={settings} now={now} onDose={onDose} onCheckin={onCheckin} />
        </div>
      </section>
    </>
  )
}
