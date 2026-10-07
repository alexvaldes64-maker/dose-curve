import { useEffect, useState } from 'react'
import { clearUndo, subscribeUndo } from '../lib/undo'

type U = Parameters<Parameters<typeof subscribeUndo>[0]>[0]

/** "Logged 20 mg Adderall IR. Undo" for 8 seconds after any log. */
export function UndoToast() {
  const [u, setU] = useState<U>(null)
  useEffect(() => subscribeUndo(setU), [])
  useEffect(() => {
    if (!u) return
    const t = setTimeout(() => clearUndo(u.id), 8000)
    return () => clearTimeout(t)
  }, [u])
  if (!u) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 z-[65] mx-auto flex max-w-[400px] items-center justify-between gap-3 rounded-2xl bg-text px-4 py-3 text-card shadow-lg"
      style={{ bottom: 'calc(var(--tabbar-h) + var(--safe-bottom) + 12px)', width: 'calc(100% - 24px)' }}
    >
      <span className="text-[15px] leading-snug">{u.message}</span>
      <button
        type="button"
        onClick={async () => {
          clearUndo(u.id)
          await u.undo()
        }}
        className="shrink-0 rounded-full bg-card/15 px-3 py-1.5 text-[15px] font-semibold text-card"
      >
        Undo
      </button>
    </div>
  )
}
