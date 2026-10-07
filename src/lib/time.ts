import { HOUR } from './model'

/** "07:30" -> minutes after midnight */
export function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function startOfLocalDay(t: number | Date): Date {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Wake to bedtime window for the local calendar day `day`. Bedtime at or before wake rolls to the next day. */
export function dayWindow(day: Date, wakeTime: string, bedtime: string) {
  const midnight = startOfLocalDay(day)
  const wake = parseHHMM(wakeTime)
  let bed = parseHHMM(bedtime)
  if (bed <= wake) bed += 24 * 60
  const start = new Date(midnight)
  start.setMinutes(wake)
  const end = new Date(midnight)
  end.setMinutes(bed)
  return { start: start.getTime(), end: end.getTime() }
}

/** Per-day sleep window overrides, keyed by the local date the window starts on (YYYY-MM-DD). */
export type DaySchedules = Record<string, { wake: string; sleep: string }>

/** Local YYYY-MM-DD. */
export function dateKey(t: Date | number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** That day's wake and sleep: the override if there is one, else the usual times. */
export function scheduleFor(day: Date, wakeTime: string, sleepTime: string, schedules?: DaySchedules) {
  return schedules?.[dateKey(day)] ?? { wake: wakeTime, sleep: sleepTime }
}

/**
 * The day's window with overrides applied. If the next day's window starts before this one
 * ends (e.g. a night shift followed by an early day), this one is cut off where the next begins.
 */
export function dayWindowFor(day: Date, wakeTime: string, sleepTime: string, schedules?: DaySchedules) {
  const s = scheduleFor(day, wakeTime, sleepTime, schedules)
  const w = dayWindow(day, s.wake, s.sleep)
  const next = addDays(startOfLocalDay(day), 1)
  const nextStart = dayWindow(next, scheduleFor(next, wakeTime, sleepTime, schedules).wake, '00:00').start
  return { start: w.start, end: nextStart > w.start && nextStart < w.end ? nextStart : w.end }
}

/** The calendar day whose window "now" belongs to. Just after midnight still counts as yesterday if yesterday's window hasn't ended. */
export function currentDay(now: number, wakeTime: string, bedtime: string, schedules?: DaySchedules): Date {
  const today = startOfLocalDay(now)
  const yesterday = addDays(today, -1)
  return now < dayWindowFor(yesterday, wakeTime, bedtime, schedules).end ? yesterday : today
}

export function sameLocalDay(a: number | Date, b: number | Date) {
  return startOfLocalDay(a).getTime() === startOfLocalDay(b).getTime()
}

function parts(t: number) {
  const d = new Date(t)
  const h24 = d.getHours()
  return { h: h24 % 12 === 0 ? 12 : h24 % 12, m: d.getMinutes(), ap: h24 < 12 ? 'a' : 'p' }
}

/** 9:30a */
export function fmtTime(t: number): string {
  const { h, m, ap } = parts(t)
  return `${h}:${String(m).padStart(2, '0')}${ap}`
}

/** 2p */
export function fmtHour(t: number): string {
  const { h, ap } = parts(t)
  return `${h}${ap}`
}

/** "HH:MM" for <input type="time"> */
export function toTimeInput(t: number): string {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Combine a local calendar day with "HH:MM". */
export function atTime(day: Date | number, hhmm: string): number {
  const d = startOfLocalDay(day)
  d.setMinutes(parseHHMM(hhmm))
  return d.getTime()
}

export function fmtDayShort(d: Date): { dow: string; date: string } {
  return {
    dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
    date: String(d.getDate()),
  }
}

export function fmtDayLong(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export const hoursBetween = (a: number, b: number) => (b - a) / HOUR

/** "just now", "12 min ago", "3 h 12 min ago", "1 day ago". */
export function fmtAgo(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000))
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return m ? `${h} h ${m} min ago` : `${h} h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? '1 day ago' : `${d} days ago`
}
