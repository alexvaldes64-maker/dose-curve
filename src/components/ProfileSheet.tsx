import { useState } from 'react'
import { PROFILE_COLORS, addProfile, deleteProfile, saveActiveProfile, switchProfile, useActiveProfile, useProfiles, type Profile } from '../db'
import { Segmented, fieldCls, labelCls } from './LogForms'
import { Sheet } from './Sheet'

export function Avatar({ p, size = 32 }: { p: Pick<Profile, 'name' | 'color'>; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: p.color, fontSize: size * 0.45 }}
    >
      {p.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

/** Switch, add, edit and delete profiles. Everything stays on this device. */
export function ProfileSheet({ onClose }: { onClose: () => void }) {
  const profiles = useProfiles()
  const active = useActiveProfile()
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'self' | 'child'>('child')
  const [color, setColor] = useState(PROFILE_COLORS[1])
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  function startEdit() {
    setName(active.name)
    setKind(active.kind)
    setColor(active.color)
    setConfirm('')
    setError(null)
    setMode('edit')
  }

  function startAdd() {
    setName('')
    setKind('child')
    setColor(PROFILE_COLORS[profiles.length % PROFILE_COLORS.length])
    setMode('add')
  }

  async function save() {
    const n = name.trim()
    if (!n) return
    if (mode === 'add') await addProfile({ name: n, kind, color })
    else await saveActiveProfile({ name: n, kind, color })
    onClose()
  }

  async function remove() {
    try {
      await deleteProfile(active.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete this profile.')
    }
  }

  if (mode !== 'list') {
    return (
      <Sheet open onClose={onClose} title={mode === 'add' ? 'Add a profile' : `Edit ${active.name}`}>
        <div className="space-y-5">
          <label className="block">
            <span className={labelCls}>Name</span>
            <input autoFocus className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" />
          </label>
          <div>
            <span className={labelCls}>Who logs</span>
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: 'self', label: 'Myself' },
                { value: 'child', label: 'My child' },
              ]}
            />
            {kind === 'child' && (
              <p className="mt-2 text-[13px] leading-snug text-muted">
                Check-ins add appetite and are labeled as observed by you. Presets use adult averages, and timing in children can differ.
              </p>
            )}
          </div>
          <div>
            <span className={labelCls}>Color</span>
            <div className="flex gap-3">
              {PROFILE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={c === color}
                  onClick={() => setColor(c)}
                  className={`h-9 w-9 rounded-full ${c === color ? 'ring-2 ring-text ring-offset-2 ring-offset-bg' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <button type="button" disabled={!name.trim()} onClick={save} className="w-full rounded-full bg-text py-3.5 text-[16px] font-semibold text-card disabled:opacity-40">
            {mode === 'add' ? 'Add profile' : 'Save changes'}
          </button>

          {mode === 'edit' && profiles.length > 1 && (
            <div className="border-t border-line pt-4">
              <p className="text-[15px] font-semibold">Delete {active.name}</p>
              <p className="mt-1 text-[13px] leading-snug text-muted">Deletes this profile and every dose, check-in, fill and schedule logged for it. Type the name to confirm.</p>
              <div className="mt-3 flex gap-2">
                <input aria-label="Type the profile name to confirm" className={`${fieldCls} flex-1`} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={active.name} />
                <button type="button" disabled={confirm !== active.name} onClick={remove} className="rounded-full bg-danger px-4 text-[15px] font-semibold text-white disabled:opacity-30">
                  Delete
                </button>
              </div>
              {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
            </div>
          )}
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet open onClose={onClose} title="Profiles">
      <ul className="card divide-y divide-line overflow-hidden">
        {profiles.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={async () => {
                await switchProfile(p.id)
                onClose()
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <Avatar p={p} />
              <span className="flex-1">
                <span className="block text-[16px] font-medium">{p.name}</span>
                <span className="block text-[13px] text-muted">{p.kind === 'child' ? 'Logged by you' : 'Self'}</span>
              </span>
              {p.id === active.id && <span className="text-[14px] font-semibold text-[var(--onset)]">Active</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={startEdit} className="flex-1 rounded-full bg-fill py-3.5 text-[15px] font-semibold">
          Edit {active.name}
        </button>
        <button type="button" onClick={startAdd} className="flex-1 rounded-full bg-text py-3.5 text-[15px] font-semibold text-card">
          Add profile
        </button>
      </div>
      <p className="mt-4 text-[13px] leading-snug text-muted">Profiles are stored on this device only. Anyone with this phone unlocked can open them.</p>
    </Sheet>
  )
}
