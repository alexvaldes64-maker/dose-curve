// One undo slot for the last thing logged. Any screen can offer it; the Toast in App shows it.

type Undo = { id: number; message: string; undo: () => Promise<unknown> | unknown }
let current: Undo | null = null
let seq = 0
const listeners = new Set<(u: Undo | null) => void>()

export function offerUndo(message: string, undo: Undo['undo']) {
  current = { id: ++seq, message, undo }
  listeners.forEach((l) => l(current))
}

export function clearUndo(id?: number) {
  if (id !== undefined && current?.id !== id) return
  current = null
  listeners.forEach((l) => l(null))
}

export function subscribeUndo(fn: (u: Undo | null) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
