import { useState } from 'react'
import type { Checkin, Dose } from '../db'
import { CheckinForm, DoseForm, Segmented, SkipForm } from './LogForms'
import { Sheet } from './Sheet'

export type Entry = { kind: 'new' } | { kind: 'dose'; dose: Dose } | { kind: 'checkin'; checkin: Checkin }

/** Quick log (new) or edit an existing dose, check-in or skipped entry. */
export function EntrySheet({ entry, onClose, day }: { entry: Entry | null; onClose: () => void; day?: Date }) {
  const [tab, setTab] = useState<'dose' | 'checkin' | 'skipped'>('dose')
  if (!entry) return null
  const skipped = entry.kind === 'checkin' && entry.checkin.kind === 'skipped'
  const title = entry.kind === 'new' ? 'Log' : entry.kind === 'dose' ? 'Edit dose' : skipped ? 'Edit skipped' : 'Edit check-in'
  return (
    <Sheet open onClose={onClose} title={title}>
      {entry.kind === 'new' && (
        <div className="mb-6">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'dose', label: 'Dose' },
              { value: 'checkin', label: 'Check-in' },
              { value: 'skipped', label: 'Skipped' },
            ]}
          />
        </div>
      )}
      {entry.kind === 'dose' && <DoseForm initial={entry.dose} onDone={onClose} />}
      {entry.kind === 'checkin' && (skipped ? <SkipForm initial={entry.checkin} onDone={onClose} /> : <CheckinForm initial={entry.checkin} onDone={onClose} />)}
      {entry.kind === 'new' && tab === 'dose' && <DoseForm day={day} onDone={onClose} />}
      {entry.kind === 'new' && tab === 'checkin' && <CheckinForm day={day} onDone={onClose} />}
      {entry.kind === 'new' && tab === 'skipped' && <SkipForm onDone={onClose} />}
    </Sheet>
  )
}
