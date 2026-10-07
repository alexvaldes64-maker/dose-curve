import type { ReactNode } from 'react'

export const LABEL_H = 24

/** Inline label beside a point on the curve (a dose). Tap to edit. */
export function EventCard({ x, top, children, onClick }: { x: number; top: number; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute z-10 flex items-center rounded-md px-1 text-left text-[14px]"
      style={{ left: x, top, height: LABEL_H }}
    >
      {children}
    </button>
  )
}

/** Push labels down so they never overlap. */
export function stackCards<T extends { y: number }>(items: T[], gap = 4, minTop = 0): (T & { top: number })[] {
  const sorted = [...items].sort((a, b) => a.y - b.y)
  let floor = minTop
  return sorted.map((it) => {
    const top = Math.max(floor, it.y - LABEL_H / 2)
    floor = top + LABEL_H + gap
    return { ...it, top }
  })
}
