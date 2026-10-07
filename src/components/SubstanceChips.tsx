import type { SubstanceDay } from '../hooks/useDayModel'

/** Bevel-style pill chips to switch which substance the ring, phases and timeline describe. */
export function SubstanceChips({ days, selected, onSelect }: { days: SubstanceDay[]; selected: string; onSelect: (id: string) => void }) {
  if (days.length < 2) return null
  return (
    <div className="scroll-x -mx-4 flex gap-2 px-4" role="tablist" aria-label="Substance">
      {days.map((d) => {
        const on = d.id === selected
        return (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(d.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[15px] font-medium ${on ? 'bg-text text-card' : 'card'}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.preset.color }} />
            {d.preset.name}
          </button>
        )
      })}
    </div>
  )
}
