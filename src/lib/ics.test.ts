import { describe, expect, it } from 'vitest'
import { buildIcs, icsText } from './ics'

describe('calendar reminders', () => {
  const ics = buildIcs(
    [
      { time: '08:00', label: 'Log your morning dose' },
      { time: '14:30', label: 'Check in: focus, mood; notes' },
    ],
    new Date(2026, 9, 7),
    new Date(Date.UTC(2026, 9, 6, 12)),
  )
  const lines = ics.split('\r\n')

  it('is a valid daily-repeating calendar with alarms', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('END:VCALENDAR')
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2)
    expect(lines.filter((l) => l === 'RRULE:FREQ=DAILY')).toHaveLength(2)
    expect(lines.filter((l) => l === 'BEGIN:VALARM')).toHaveLength(2)
    expect(lines).toContain('DTSTART:20261007T080000')
    expect(lines).toContain('DTSTART:20261007T143000')
    expect(lines).toContain('DTSTAMP:20261006T120000Z')
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('escapes text and folds long lines', () => {
    expect(icsText('a, b; c\\d\nnext')).toBe('a\\, b\; c\\\\d\\nnext')
    expect(lines).toContain('SUMMARY:Check in: focus\\, mood\; notes')
    const long = buildIcs([{ time: '09:00', label: 'x'.repeat(200) }], new Date(2026, 9, 7))
    for (const l of long.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
  })
})
