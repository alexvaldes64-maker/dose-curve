import { describe, expect, it } from 'vitest'
import { HOUR } from './model'
import { currentDay, dateKey, dayWindowFor, type DaySchedules } from './time'

// Local times in America/Los_Angeles (set in vitest.config.ts).
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime()
const day = (y: number, mo: number, d: number) => new Date(y, mo - 1, d)

describe('day windows', () => {
  it('uses the usual times when there is no override', () => {
    const w = dayWindowFor(day(2026, 10, 6), '07:00', '23:00')
    expect(w).toEqual({ start: at(2026, 10, 6, 7), end: at(2026, 10, 6, 23) })
  })

  it('a night shift override runs past midnight and belongs to the day it started', () => {
    const s: DaySchedules = { '2026-10-06': { wake: '18:00', sleep: '09:00' } }
    const w = dayWindowFor(day(2026, 10, 6), '07:00', '23:00', s)
    expect(w).toEqual({ start: at(2026, 10, 6, 18), end: at(2026, 10, 7, 7) }) // cut at the next day's 7:00 wake
    expect(dateKey(currentDay(at(2026, 10, 7, 3), '07:00', '23:00', s))).toBe('2026-10-06')
  })

  it('without an early next day, the night shift runs to its own sleep time', () => {
    const s: DaySchedules = {
      '2026-10-06': { wake: '18:00', sleep: '09:00' },
      '2026-10-07': { wake: '18:00', sleep: '09:00' },
    }
    expect(dayWindowFor(day(2026, 10, 6), '07:00', '23:00', s).end).toBe(at(2026, 10, 7, 9))
    expect(dateKey(currentDay(at(2026, 10, 7, 8, 30), '07:00', '23:00', s))).toBe('2026-10-06')
    expect(dateKey(currentDay(at(2026, 10, 7, 12), '07:00', '23:00', s))).toBe('2026-10-07')
  })

  it('a usual late bedtime keeps just-after-midnight on yesterday', () => {
    expect(dateKey(currentDay(at(2026, 10, 7, 0, 30), '07:00', '01:00'))).toBe('2026-10-06')
    expect(dateKey(currentDay(at(2026, 10, 7, 2), '07:00', '01:00'))).toBe('2026-10-07')
  })

  it('spring forward: wake and sleep stay at their clock times, the window is an hour shorter', () => {
    const w = dayWindowFor(day(2026, 3, 8), '07:00', '23:00')
    expect(new Date(w.start).getHours()).toBe(7)
    expect(new Date(w.end).getHours()).toBe(23)
    expect((w.end - w.start) / HOUR).toBe(16)
    const night = dayWindowFor(day(2026, 3, 7), '22:00', '06:00', { '2026-03-08': { wake: '10:00', sleep: '23:00' } })
    expect((night.end - night.start) / HOUR).toBe(7) // 22:00 to 06:00 across the lost hour
  })

  it('fall back: the window across the repeated hour is an hour longer', () => {
    const night = dayWindowFor(day(2026, 10, 31), '22:00', '06:00', { '2026-11-01': { wake: '10:00', sleep: '23:00' } })
    expect((night.end - night.start) / HOUR).toBe(9)
  })
})
