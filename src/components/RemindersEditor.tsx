import { useEffect, useState } from 'react'
import { saveActiveProfile, useActiveProfile } from '../db'
import { buildIcs, type Reminder } from '../lib/ics'
import { fieldCls } from './LogForms'

const DEFAULTS: Reminder[] = [{ time: '08:00', label: 'Dose Curve: log your morning' }]

/** Daily reminders handed to the phone's calendar as an .ics file. Times are the user's own. */
export function RemindersEditor() {
  const profile = useActiveProfile()
  const [rows, setRows] = useState<Reminder[]>(profile.reminders ?? DEFAULTS)
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (profile.reminders) setRows(profile.reminders)
  }, [profile.id, profile.reminders])

  const valid = rows.length > 0 && rows.every((r) => /^\d{2}:\d{2}$/.test(r.time) && r.label.trim())
  const update = (i: number, patch: Partial<Reminder>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  async function download() {
    if (!valid) return
    const clean = rows.map((r) => ({ time: r.time, label: r.label.trim() }))
    await saveActiveProfile({ reminders: clean })
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const blob = new Blob([buildIcs(clean, tomorrow)], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dose-curve-reminders.ics'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMsg('Open the downloaded file to add the reminders to your calendar.')
  }

  return (
    <div className="space-y-3">
      <p className="text-[14px] leading-snug text-muted">
        Websites cannot send reminders without a server, and this app has none. Instead, your phone's calendar reminds you every day at the times you
        choose. Use your own wording, for example to log a dose or rate your focus.
      </p>
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input aria-label="Reminder time" type="time" className={`${fieldCls} w-[118px] shrink-0`} value={r.time} onChange={(e) => e.target.value && update(i, { time: e.target.value })} />
          <input aria-label="Reminder text" className={`${fieldCls} min-w-0 flex-1`} value={r.label} onChange={(e) => update(i, { label: e.target.value })} />
          <button type="button" aria-label="Remove reminder" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="shrink-0 px-2 text-[20px] text-muted">
            ×
          </button>
        </div>
      ))}
      {rows.length < 6 && (
        <button type="button" onClick={() => setRows([...rows, { time: '14:00', label: 'Dose Curve: how is your focus?' }])} className="text-[15px] font-medium text-[var(--onset)]">
          Add a reminder
        </button>
      )}
      <button type="button" disabled={!valid} onClick={download} className="w-full rounded-full bg-text py-3.5 text-[15px] font-semibold text-card disabled:opacity-40">
        Add to my calendar
      </button>
      {msg && <p className="text-[14px]">{msg}</p>}
      <p className="text-[13px] leading-snug text-muted">To change times later, delete the old Dose Curve events in your calendar and add a new file.</p>
    </div>
  )
}
