import { useEffect, type ReactNode } from 'react'

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal aria-label={title}>
      <button type="button" aria-label="Close" className="scrim-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="sheet-up relative max-h-[90dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] bg-bg px-5 pt-3"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[20px] font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-[15px] text-muted">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
