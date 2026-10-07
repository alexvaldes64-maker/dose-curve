import { useState } from 'react'
import { saveActiveProfile, setDaySchedule, useActiveProfile, type Settings } from '../db'
import { dateKey, fmtDayLong, scheduleFor } from '../lib/time'
import { fieldCls, labelCls } from './LogForms'
import { Sheet } from './Sheet'

/** Change one day's wake and sleep times (shift work), with saved presets. */
export function ScheduleSheet({ day, settings, onClose }: { day: Date; settings: Settings; onClose: () => void }) {
  const profile = useActiveProfile()
  const current = scheduleFor(day, settings.wakeTime, settings.bedtime, settings.daySchedules)
  const isOverride = !!settings.daySchedules?.[dateKey(day)]
  const [wake, setWake] = useState(current.wake)
  const [sleep, setSleep] = useState(current.sleep)
  const [presetName, setPresetName] = useState('')
  const presets = profile.schedulePresets ?? []

  async function save() {
    const usual = wake === settings.wakeTime && sleep === settings.bedtime
    await setDaySchedule(day, usual ? null : { wake, sleep })
    onClose()
  }

  async function savePreset() {
    const name = presetName.trim()
    if (!name) return
    const next = [...presets.filter((p) => p.name !== name), { name, wake, sleep }]
    await saveActiveProfile({ schedulePresets: next })
    setPresetName('')
  }

  async function removePreset(name: string) {
    await saveActiveProfile({ schedulePresets: presets.filter((p) => p.name !== name) })
  }

  return (
    <Sheet open onClose={onClose} title="This day's schedule">
      <p className="-mt-3 mb-4 text-[14px] text-muted">{fmtDayLong(day)}. Sleep can be after midnight, for night shifts.</p>

      {presets.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {presets.map((p) => (
            <span key={p.name} className="flex items-center rounded-full bg-fill">
              <button
                type="button"
                onClick={() => {
                  setWake(p.wake)
                  setSleep(p.sleep)
                }}
                className="py-1.5 pl-3 pr-1 text-[14px]"
              >
                {p.name}
              </button>
              <button type="button" aria-label={`Remove preset ${p.name}`} onClick={() => removePreset(p.name)} className="px-2 py-1.5 text-[14px] text-muted">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Wake</span>
          <input type="time" className={fieldCls} value={wake} onChange={(e) => e.target.value && setWake(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Sleep</span>
          <input type="time" className={fieldCls} value={sleep} onChange={(e) => e.target.value && setSleep(e.target.value)} />
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          aria-label="Preset name"
          className={`${fieldCls} flex-1`}
          placeholder="Save as preset, e.g. Night shift"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
        />
        <button type="button" disabled={!presetName.trim()} onClick={savePreset} className="rounded-full bg-fill px-4 text-[15px] font-semibold disabled:opacity-40">
          Save
        </button>
      </div>

      <div className="mt-6 flex gap-2">
        {isOverride && (
          <button
            type="button"
            onClick={async () => {
              await setDaySchedule(day, null)
              onClose()
            }}
            className="rounded-full px-4 py-3.5 text-[15px] font-semibold text-muted"
          >
            Use usual times
          </button>
        )}
        <button type="button" onClick={save} className="flex-1 rounded-full bg-text py-3.5 text-[16px] font-semibold text-card">
          Save for this day
        </button>
      </div>
    </Sheet>
  )
}
