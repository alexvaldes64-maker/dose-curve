import type { ReactNode } from 'react'

/** Small metric tile: label, big value with a smaller unit, optional note. */
export function Stat({ label, value, unit, note, dot }: { label: string; value: ReactNode; unit?: string; note?: ReactNode; dot?: string }) {
  return (
    <div className="card flex-1 px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[14px] text-muted">
        {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}
        {label}
      </div>
      <div className="num mt-2 text-[26px] leading-none">
        {value}
        {unit && <span className="ml-1 text-[16px] font-medium text-muted">{unit}</span>}
      </div>
      {note && <div className="mt-1.5 text-[13px] text-muted">{note}</div>}
    </div>
  )
}
