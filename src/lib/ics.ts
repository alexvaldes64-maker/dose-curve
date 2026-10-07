// Calendar reminders as an .ics file. The phone's calendar does the reminding, fully offline:
// nothing is scheduled on a server and nothing leaves the device except the file the user saves.

export interface Reminder {
  time: string // "HH:MM", local
  label: string
}

/** RFC 5545 TEXT escaping. */
export function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Fold lines longer than 75 octets (RFC 5545 3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const out: string[] = []
  let cur = ''
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
    }
    cur += ch
  }
  out.push(cur)
  return out.join('\r\n ')
}

const pad = (n: number) => String(n).padStart(2, '0')
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`

/** Daily repeating events with an alert at the event time, starting on `from` (local floating time). */
export function buildIcs(reminders: Reminder[], from: Date, now = new Date()): string {
  const day = `${from.getFullYear()}${pad(from.getMonth() + 1)}${pad(from.getDate())}`
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dose Curve//Reminders//EN', 'CALSCALE:GREGORIAN']
  reminders.forEach((r, i) => {
    const [h, m] = r.time.split(':')
    lines.push(
      'BEGIN:VEVENT',
      `UID:dose-curve-${day}-${i}-${h}${m}@dose-curve.local`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${day}T${h}${m}00`,
      'DURATION:PT5M',
      'RRULE:FREQ=DAILY',
      `SUMMARY:${icsText(r.label)}`,
      'DESCRIPTION:From Dose Curve. Open the app to log.',
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsText(r.label)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    )
  })
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export interface OneOffEvent {
  /** Local calendar day. */
  date: Date
  time: string // "HH:MM"
  label: string
  description?: string
}

/** Single (non-repeating) events with an alert, e.g. a refill reminder. */
export function buildEventsIcs(events: OneOffEvent[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dose Curve//Reminders//EN', 'CALSCALE:GREGORIAN']
  events.forEach((e, i) => {
    const day = `${e.date.getFullYear()}${pad(e.date.getMonth() + 1)}${pad(e.date.getDate())}`
    const [h, m] = e.time.split(':')
    lines.push(
      'BEGIN:VEVENT',
      `UID:dose-curve-once-${day}-${i}-${h}${m}@dose-curve.local`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${day}T${h}${m}00`,
      'DURATION:PT5M',
      `SUMMARY:${icsText(e.label)}`,
      `DESCRIPTION:${icsText(e.description ?? 'From Dose Curve.')}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsText(e.label)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    )
  })
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Save an .ics file through the browser's download. */
export function downloadIcs(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
