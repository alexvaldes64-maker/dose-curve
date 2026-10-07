import type { Phase, PhaseSegment } from './model'
import { fmtTime } from './time'

/** Plain-language names shown in the UI. Model names stay as they are. */
export const PHASE_LABEL: Record<Phase, string> = {
  Onset: 'Kicking in',
  Peak: 'Peak',
  Taper: 'Wearing off',
  Comedown: 'Fading',
  Clear: 'Clear',
}

/** Blue while building, amber at peak, orange wearing off, violet fading. CSS vars so light and dark both work. */
export const PHASE_COLOR: Record<Phase, string> = {
  Onset: 'var(--onset)',
  Peak: 'var(--peak)',
  Taper: 'var(--taper)',
  Comedown: 'var(--comedown)',
  Clear: 'var(--clear)',
}

/** Check-in focus 1 to 5, gray to green. */
export const FOCUS_COLORS = ['#C7C7CC', '#A3C9A8', '#7DC28A', '#52B86A', '#34C759']

export const activeSegments = (segs: PhaseSegment[]) => segs.filter((s) => s.phase !== 'Clear')

/** When the effect drops to Clear after the last active phase, or null if it is still active at the end of the window. */
export function clearBy(segs: PhaseSegment[]): number | null {
  const last = segs[segs.length - 1]
  const a = activeSegments(segs)
  if (!a.length || !last || last.phase !== 'Clear') return null
  return a[a.length - 1].end
}

/** One descriptive sentence about where "now" sits in the span. Describes, never advises. */
export function statusSentence(segs: PhaseSegment[], now: number, phase: Phase, hasDoses: boolean): string {
  if (!hasDoses) return 'No doses logged today.'
  const cur = segs.find((s) => now >= s.start && now <= s.end)
  const nextPeak = segs.find((s) => s.phase === 'Peak' && s.start > now)
  const clear = clearBy(segs)
  switch (phase) {
    case 'Onset':
      return nextPeak ? `Building toward peak around ${fmtTime(nextPeak.start)}.` : 'Building.'
    case 'Peak':
      return cur ? `Peak window ends around ${fmtTime(cur.end)}.` : 'At peak.'
    case 'Taper':
    case 'Comedown':
      return clear ? `Estimated clear by ${fmtTime(clear)}.` : 'Still active at sleep time.'
    case 'Clear':
      if (nextPeak) return `Building toward peak around ${fmtTime(nextPeak.start)}.`
      return clear && clear <= now ? `Cleared around ${fmtTime(clear)}.` : 'Nothing active right now.'
  }
}

/**
 * What to call "now". The model labels anything under 10% of the day's top as Clear,
 * but right after a dose that reads wrong, so a rising stretch before the next
 * active phase shows as "Starting" in the kicking-in color.
 */
export function nowLabel(segs: PhaseSegment[], now: number, phase: Phase, hasDoseBefore: boolean): { label: string; color: string } {
  if (phase === 'Clear' && hasDoseBefore) {
    const next = segs.find((s) => s.start > now && s.phase !== 'Clear')
    if (next && next.phase === 'Onset') return { label: 'Starting', color: PHASE_COLOR.Onset }
  }
  return { label: PHASE_LABEL[phase], color: phase === 'Clear' ? 'var(--muted)' : PHASE_COLOR[phase] }
}
