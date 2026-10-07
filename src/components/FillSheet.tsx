import { useState } from 'react'
import { deleteFill, saveFill, useFills, type Fill } from '../db'
import { SUBSTANCES, getFormulation, getSubstance } from '../lib/substances'
import { dateKey } from '../lib/time'
import { Segmented, fieldCls, labelCls } from './LogForms'
import { Sheet } from './Sheet'

/** Add or edit a pharmacy fill: which generic or manufacturer, from where, and when. */
export function FillSheet({ initial, onClose }: { initial?: Fill & { id?: number }; onClose: () => void }) {
  const fills = useFills()
  const [subId, setSubId] = useState(initial?.substance ?? fills[0]?.substance ?? SUBSTANCES[0].id)
  const sub = getSubstance(subId)
  const [formId, setFormId] = useState(initial?.formulation ?? sub.formulations[0].id)
  const form = getFormulation(sub, formId)
  const [strength, setStrength] = useState<string>(initial ? String(initial.strengthMg) : '')
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? '')
  const [pharmacy, setPharmacy] = useState(initial?.pharmacy ?? '')
  const [date, setDate] = useState(initial ? dateKey(Date.parse(initial.filledAt)) : dateKey(Date.now()))
  const [note, setNote] = useState(initial?.note ?? '')
  const known = [...new Set(fills.map((f) => f.manufacturer).filter(Boolean))]
  const knownPharmacies = [...new Set(fills.map((f) => f.pharmacy).filter((x): x is string => !!x))]
  const mg = Number(strength)
  const valid = Number.isFinite(mg) && mg > 0 && manufacturer.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date)

  async function save() {
    if (!valid) return
    const [y, m, d] = date.split('-').map(Number)
    await saveFill({
      ...(initial?.id ? { id: initial.id } : {}),
      profileId: initial?.profileId ?? 0,
      substance: sub.id,
      formulation: form.id,
      strengthMg: mg,
      manufacturer: manufacturer.trim(),
      ...(pharmacy.trim() ? { pharmacy: pharmacy.trim() } : {}),
      filledAt: new Date(y, m - 1, d, 12).toISOString(),
      ...(note.trim() ? { note: note.trim() } : {}),
    })
    onClose()
  }

  async function remove() {
    if (initial?.id && confirm('Delete this fill? Doses logged from it stay in your log.')) {
      await deleteFill(initial.id)
      onClose()
    }
  }

  return (
    <Sheet open onClose={onClose} title={initial?.id ? 'Edit fill' : 'Add a fill'}>
      <div className="space-y-5">
        <div className="scroll-x -mx-5 flex gap-2 px-5">
          {SUBSTANCES.filter((x) => x.id !== 'caffeine').map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                setSubId(x.id)
                setFormId(x.formulations[0].id)
                setStrength('')
              }}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[15px] font-medium ${x.id === sub.id ? 'bg-text text-card' : 'bg-fill text-text'}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />
              {x.name}
            </button>
          ))}
        </div>
        {sub.formulations.length > 1 && (
          <Segmented
            value={form.id}
            onChange={(id) => {
              setFormId(id)
              setStrength('')
            }}
            options={sub.formulations.map((f) => ({ value: f.id, label: f.label }))}
          />
        )}
        <div>
          <span className={labelCls}>Strength on the label</span>
          {form.strengths && (
            <div className="mb-2 flex flex-wrap gap-2">
              {form.strengths.map((x) => (
                <button
                  key={x.mg}
                  type="button"
                  onClick={() => setStrength(String(x.mg))}
                  className={`rounded-full px-3 py-1.5 text-[14px] ${Number(strength) === x.mg ? 'bg-text text-card' : 'bg-fill text-text'}`}
                >
                  {x.mg} mg
                </button>
              ))}
            </div>
          )}
          <input className={fieldCls} inputMode="decimal" type="number" placeholder="mg" value={strength} onChange={(e) => setStrength(e.target.value)} />
        </div>
        <label className="block">
          <span className={labelCls}>Manufacturer (on the bottle or pharmacy label)</span>
          <input className={fieldCls} list="known-makers" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="e.g. Teva" />
          <datalist id="known-makers">
            {known.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Pharmacy (optional)</span>
            <input className={fieldCls} list="known-pharmacies" value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} />
            <datalist id="known-pharmacies">
              {knownPharmacies.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className={labelCls}>Filled on</span>
            <input type="date" className={fieldCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className={labelCls}>Note (optional)</span>
          <input className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. new pill shape" />
        </label>
        <p className="text-[13px] leading-snug text-muted">Doses you log after this date link to this fill automatically. You can pick a different fill on any dose.</p>
        <div className="flex gap-2">
          {initial?.id && (
            <button type="button" onClick={remove} className="rounded-full px-5 py-3.5 text-[16px] font-semibold text-danger">
              Delete
            </button>
          )}
          <button type="button" disabled={!valid} onClick={save} className="flex-1 rounded-full bg-text py-3.5 text-[16px] font-semibold text-card disabled:opacity-40">
            {initial?.id ? 'Save changes' : 'Add fill'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

/** "Adderall IR 20 mg, Teva" */
export function fillName(f: Fill): string {
  const sub = getSubstance(f.substance)
  const form = getFormulation(sub, f.formulation)
  const base = sub.id === 'methylphenidate' ? (f.formulation === 'ER' ? 'Methylphenidate ER' : 'Ritalin') : `${sub.name}${form.id === 'cap' ? '' : ' ' + form.label}`
  return `${base} ${f.strengthMg} mg, ${f.manufacturer}`
}
