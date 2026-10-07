import Dexie, { type EntityTable } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import type { ModelKind } from './lib/model'
import { DEFAULT_SUBSTANCE, type Overrides } from './lib/substances'
import { dateKey, type DaySchedules } from './lib/time'
import { HOUR } from './lib/model'

export interface Dose {
  id?: number
  /** Preset id from lib/substances (adderall, vyvanse, methylphenidate, caffeine). */
  substance: string
  /** Display name, kept for older backups. */
  medication: string
  /** Amount in mg (field name kept from v1). */
  mg: number
  /** Formulation id within the substance preset (IR, XR, ER, cap, drink). */
  formulation: string
  takenAt: string
  /** Dev-only preview dose added by the sample button. */
  sample?: boolean
  /** Whose dose this is (v3). */
  profileId: number
  /** Which pharmacy fill it came from, if recorded (v3). */
  fillId?: number
  /** Tablet strength and piece when a scored tablet was split; `mg` is always the amount taken. */
  strengthMg?: number
  split?: 0.5 | 0.25
}

export type CheckinKind = 'rating' | 'wore_off' | 'side_effect'

export interface Checkin {
  id?: number
  profileId: number
  /** v3. Older rows are ratings. */
  kind: CheckinKind
  at: string
  focus: number
  mood: number
  note?: string
  tags?: string[]
  /** Child profiles: appetite 1 to 5, as observed by the parent. */
  appetite?: number
  /** For "wore off" check-ins: which substance wore off. */
  substance?: string
}

export interface Profile {
  id?: number
  name: string
  color: string
  kind: 'self' | 'child'
  wakeTime: string
  sleepTime: string
  /** Per substance:formulation half-life and absorption overrides for this person. */
  overrides?: Overrides
  /** Saved sleep windows for shift work, e.g. "Night shift 18:00 to 09:00". */
  schedulePresets?: { name: string; wake: string; sleep: string }[]
  /** Substances picked at onboarding; shown first in the dose picker. */
  favorites?: string[]
  /** Daily calendar reminders this person set up (exported as .ics). */
  reminders?: { time: string; label: string }[]
  createdAt: string
}

/** A pharmacy fill: which generic or manufacturer a run of doses came from. */
export interface Fill {
  id?: number
  profileId: number
  substance: string
  formulation: string
  strengthMg: number
  manufacturer: string
  pharmacy?: string
  filledAt: string
  note?: string
}

/** Sleep window override for one calendar day (shift work). `date` is YYYY-MM-DD of the window's start. */
export interface Schedule {
  id?: number
  profileId: number
  date: string
  wake: string
  sleep: string
}

export interface Settings {
  id: 1
  /** Profile shown in the app. */
  activeProfileId?: number
  /** v2 and earlier: now per profile. Kept so old rows and backups still parse. */
  wakeTime: string
  bedtime: string
  referenceMg: number
  model: ModelKind
  halfLifeHours: number
  kaPerHour: number
  toleranceRate: number
  /** v2 and earlier: now per profile. */
  overrides?: Overrides
  /** Not stored: the active profile's per-day schedule overrides, merged in by App. */
  daySchedules?: DaySchedules
  /** First-run onboarding finished. */
  onboardedAt?: string
  /** Version of the terms the user acknowledged (see TERMS_VERSION). */
  termsAccepted?: string
  /** Last time a full backup was exported, and when the backup reminder may show again. */
  lastBackupAt?: string
  backupSnoozedUntil?: string
}

/** Bump when TERMS.md changes in a way users must see again. */
export const TERMS_VERSION = '2026-10-06'

export const PROFILE_COLORS = ['#5E5CE6', '#FF9F0A', '#30B0C7', '#FF2D55', '#34C759', '#AF52DE']

export function newProfile(p: Partial<Profile> = {}): Profile {
  return {
    name: 'Me',
    color: PROFILE_COLORS[0],
    kind: 'self',
    wakeTime: '07:00',
    sleepTime: '23:00',
    createdAt: new Date().toISOString(),
    ...p,
  }
}

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  wakeTime: '07:00',
  bedtime: '23:00',
  referenceMg: 20,
  model: 'simple',
  halfLifeHours: 11,
  kaPerHour: 1.0,
  toleranceRate: 0.12,
}

export const db = new Dexie('doseCurve') as Dexie & {
  doses: EntityTable<Dose, 'id'>
  checkins: EntityTable<Checkin, 'id'>
  settings: EntityTable<Settings, 'id'>
  profiles: EntityTable<Profile, 'id'>
  fills: EntityTable<Fill, 'id'>
  schedules: EntityTable<Schedule, 'id'>
}

db.version(1).stores({
  doses: '++id, takenAt',
  checkins: '++id, at',
  settings: 'id',
})

// v2: doses carry a substance preset. Everything logged before was Adderall IR.
db.version(2)
  .stores({ doses: '++id, takenAt, substance', checkins: '++id, at', settings: 'id' })
  .upgrade((tx) =>
    tx
      .table('doses')
      .toCollection()
      .modify((d: Dose) => {
        d.substance ??= DEFAULT_SUBSTANCE
        d.formulation ??= 'IR'
      }),
  )

// v3: profiles, fills, per-day schedules. Existing data moves to a "Me" profile
// built from the old global wake time, bedtime and overrides.
db.version(3)
  .stores({
    doses: '++id, takenAt, substance, profileId, fillId, [profileId+takenAt], [profileId+substance]',
    checkins: '++id, at, profileId, [profileId+at]',
    settings: 'id',
    profiles: '++id',
    fills: '++id, profileId, filledAt, [profileId+substance]',
    schedules: '++id, [profileId+date]',
  })
  .upgrade(async (tx) => {
    const old = (await tx.table('settings').get(1)) as Partial<Settings> | undefined
    const id = (await tx.table('profiles').add(
      newProfile({ wakeTime: old?.wakeTime ?? '07:00', sleepTime: old?.bedtime ?? '23:00', overrides: old?.overrides }),
    )) as number
    await tx.table('doses').toCollection().modify((d: Dose) => {
      d.profileId ??= id
    })
    await tx.table('checkins').toCollection().modify((c: Checkin) => {
      c.profileId ??= id
      c.kind ??= 'rating'
    })
    if (old) await tx.table('settings').update(1, { activeProfileId: id })
    else await tx.table('settings').put({ ...DEFAULT_SETTINGS, activeProfileId: id })
  })

// Fresh installs: start with one profile.
db.on('populate', async (tx) => {
  const id = (await tx.table('profiles').add(newProfile())) as number
  await tx.table('settings').put({ ...DEFAULT_SETTINGS, activeProfileId: id })
})

/** Make sure a profile exists and settings point at one. Safe to call any time. */
export async function ensureProfile(): Promise<number> {
  return db.transaction('rw', db.profiles, db.settings, async () => {
    const s = await db.settings.get(1)
    if (s?.activeProfileId && (await db.profiles.get(s.activeProfileId))) return s.activeProfileId
    const first = await db.profiles.orderBy('id').first()
    const id = first?.id ?? ((await db.profiles.add(newProfile())) as number)
    await db.settings.put({ ...DEFAULT_SETTINGS, ...s, id: 1, activeProfileId: id })
    return id
  })
}

/** Read-only, so it is safe inside live queries. `ensureProfile()` runs once at startup. */
export async function getActiveProfileId(): Promise<number> {
  const s = await db.settings.get(1)
  if (s?.activeProfileId) return s.activeProfileId
  return (await db.profiles.orderBy('id').first())?.id ?? 0
}

/** The active profile, or a placeholder while the database loads. */
export function useActiveProfile(): Profile & { id: number } {
  const p = useLiveQuery(async () => {
    const s = await db.settings.get(1)
    return s?.activeProfileId ? db.profiles.get(s.activeProfileId) : undefined
  }, [])
  return { ...newProfile(), id: 0, ...p } as Profile & { id: number }
}

/** The active profile's per-day schedule overrides as a date-keyed map. */
export function useDaySchedules(): DaySchedules {
  const rows = useLiveQuery(async () => {
    const pid = await getActiveProfileId()
    return db.schedules.where('[profileId+date]').between([pid, Dexie.minKey], [pid, Dexie.maxKey]).toArray()
  }, [])
  const map: DaySchedules = {}
  for (const r of rows ?? []) map[r.date] = { wake: r.wake, sleep: r.sleep }
  return map
}

/** Set (or with null, clear) the sleep window for one day of the active profile. */
export async function setDaySchedule(day: Date, value: { wake: string; sleep: string } | null) {
  const profileId = await getActiveProfileId()
  const date = dateKey(day)
  await db.transaction('rw', db.schedules, async () => {
    await db.schedules.where('[profileId+date]').equals([profileId, date]).delete()
    if (value) await db.schedules.add({ profileId, date, ...value })
  })
}

export function useProfiles(): (Profile & { id: number })[] {
  return (useLiveQuery(() => db.profiles.toArray(), []) ?? []) as (Profile & { id: number })[]
}

export async function addProfile(p: Partial<Profile>): Promise<number> {
  const count = await db.profiles.count()
  const id = (await db.profiles.add(newProfile({ color: PROFILE_COLORS[count % PROFILE_COLORS.length], ...p }))) as number
  await saveSettings({ activeProfileId: id })
  return id
}

export async function switchProfile(id: number) {
  await saveSettings({ activeProfileId: id })
}

/** Delete a profile and everything logged for it. The last profile cannot be deleted. */
export async function deleteProfile(id: number) {
  await db.transaction('rw', [db.profiles, db.doses, db.checkins, db.fills, db.schedules, db.settings], async () => {
    if ((await db.profiles.count()) <= 1) throw new Error('At least one profile is needed.')
    await Promise.all([
      db.doses.where('profileId').equals(id).delete(),
      db.checkins.where('profileId').equals(id).delete(),
      db.fills.where('profileId').equals(id).delete(),
      db.schedules.where('[profileId+date]').between([id, Dexie.minKey], [id, Dexie.maxKey]).delete(),
    ])
    await db.profiles.delete(id)
    const s = await db.settings.get(1)
    if (s?.activeProfileId === id) {
      const first = await db.profiles.orderBy('id').first()
      await db.settings.update(1, { activeProfileId: first!.id })
    }
  })
}

/** The active profile's fills, newest first. */
export function useFills(): (Fill & { id: number })[] {
  return (useLiveQuery(async () => {
    const pid = await getActiveProfileId()
    return (await db.fills.where('profileId').equals(pid).sortBy('filledAt')).reverse()
  }, []) ?? []) as (Fill & { id: number })[]
}

export async function saveFill(f: Fill): Promise<number> {
  const profileId = f.profileId || (await getActiveProfileId())
  if (f.id) {
    await db.fills.put({ ...f, profileId })
    return f.id
  }
  return (await db.fills.add({ ...f, profileId })) as number
}

/** Delete a fill. Doses that were pinned to it go back to automatic matching. */
export async function deleteFill(id: number) {
  await db.transaction('rw', db.fills, db.doses, async () => {
    await db.doses.where('fillId').equals(id).modify((d: Dose) => {
      delete d.fillId
    })
    await db.fills.delete(id)
  })
}

/** All of the active profile's doses and check-ins (for comparisons and summaries). */
export function useAllForProfile() {
  return useLiveQuery(async () => {
    const pid = await getActiveProfileId()
    const [doses, checkins] = await Promise.all([
      db.doses.where('[profileId+takenAt]').between([pid, Dexie.minKey], [pid, Dexie.maxKey]).toArray(),
      db.checkins.where('[profileId+at]').between([pid, Dexie.minKey], [pid, Dexie.maxKey]).toArray(),
    ])
    return { doses, checkins }
  }, []) ?? { doses: [] as Dose[], checkins: [] as Checkin[] }
}

/** Record that a substance wore off, now. */
export async function logWoreOff(substance: string, at = Date.now()) {
  await db.checkins.add({ profileId: await getActiveProfileId(), kind: 'wore_off', substance, at: new Date(at).toISOString(), focus: 0, mood: 0 })
}

export async function saveActiveProfile(patch: Partial<Profile>) {
  const id = await getActiveProfileId()
  await db.profiles.update(id, patch)
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return
    await navigator.storage?.persist?.()
  } catch {
    // Not supported; data still lives in IndexedDB.
  }
}

export function useSettings(): Settings {
  const row = useLiveQuery(() => db.settings.get(1), [])
  return { ...DEFAULT_SETTINGS, ...row, id: 1 }
}

/** Stored settings row, `null` if none yet, `undefined` while loading. */
export function useStoredSettings(): Settings | null | undefined {
  return useLiveQuery(async () => (await db.settings.get(1)) ?? null, [])
}

/** Download a full backup file and remember when, for the backup reminder. */
export async function downloadBackup(profileId?: number): Promise<Backup> {
  const data = await exportData(profileId)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const who = profileId && data.profiles[0] ? `-${data.profiles[0].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : ''
  a.download = `dose-curve-backup${who}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  if (!profileId) await saveSettings({ lastBackupAt: new Date().toISOString(), backupSnoozedUntil: undefined })
  return data
}

/**
 * Whether to suggest a backup: there is at least a week of data, and no backup in the last 30 days,
 * unless the reminder was snoozed.
 */
export function backupDue(s: Pick<Settings, 'lastBackupAt' | 'backupSnoozedUntil'> | undefined, firstRealDose: string | undefined, now: number): boolean {
  if (s?.backupSnoozedUntil && Date.parse(s.backupSnoozedUntil) > now) return false
  if (s?.lastBackupAt && now - Date.parse(s.lastBackupAt) < 30 * 24 * HOUR) return false
  return !!firstRealDose && now - Date.parse(firstRealDose) > 7 * 24 * HOUR
}

export function useBackupDue(): boolean {
  return (
    useLiveQuery(async () => {
      const first = (await db.doses.orderBy('takenAt').toArray()).find((d) => !d.sample)
      return backupDue(await db.settings.get(1), first?.takenAt, Date.now())
    }, []) ?? false
  )
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = (await db.settings.get(1)) ?? DEFAULT_SETTINGS
  const next: Settings = { ...cur, ...patch, id: 1 }
  delete next.daySchedules
  await db.settings.put(next)
}

const iso = (t: number) => new Date(t).toISOString()

/** The active profile's doses in [from, to), oldest first. */
export function useDoses(from: number, to: number): Dose[] {
  return (
    useLiveQuery(async () => {
      const pid = await getActiveProfileId()
      return db.doses.where('[profileId+takenAt]').between([pid, iso(from)], [pid, iso(to)], true, false).toArray()
    }, [from, to]) ?? []
  )
}

/** The active profile's check-ins in [from, to), oldest first. */
export function useCheckins(from: number, to: number): Checkin[] {
  return (
    useLiveQuery(async () => {
      const pid = await getActiveProfileId()
      return db.checkins.where('[profileId+at]').between([pid, iso(from)], [pid, iso(to)], true, false).toArray()
    }, [from, to]) ?? []
  )
}

/** Doses that can still affect a window starting at `start` (48h lookback covers yesterday). */
export const LOOKBACK = 48 * HOUR

// ---------------------------------------------------------------------------
// Dev sample dose (one at most, removable)
// ---------------------------------------------------------------------------

/** Only doses the dev sample button created. Real doses are never matched. */
export const isSample = (d: Dose) => d.sample === true

export async function toggleSample(day: Date): Promise<'added' | 'removed'> {
  const profileId = await getActiveProfileId()
  const existing = (await db.doses.where('profileId').equals(profileId).toArray()).filter(isSample)
  if (existing.length) {
    await db.doses.bulkDelete(existing.map((d) => d.id!))
    return 'removed'
  }
  const t = new Date(day)
  t.setHours(9, 30, 0, 0)
  await db.doses.add({ substance: 'adderall', medication: 'Adderall', mg: 20, formulation: 'IR', takenAt: t.toISOString(), sample: true, profileId })
  return 'added'
}

export function useHasSample(): boolean {
  return useLiveQuery(async () => (await db.doses.where('profileId').equals(await getActiveProfileId()).toArray()).some(isSample), []) ?? false
}

/** Last amount logged for a substance, to prefill the stepper. */
export function useLastAmount(substance: string): number | undefined {
  return useLiveQuery(
    async () => (await db.doses.where('[profileId+substance]').equals([await getActiveProfileId(), substance]).sortBy('takenAt')).at(-1)?.mg,
    [substance],
  )
}

/** Substance of the most recent dose, to preselect the picker. */
export function useLastSubstance(): string | undefined {
  return useLiveQuery(async () => {
    const pid = await getActiveProfileId()
    return (await db.doses.where('[profileId+takenAt]').between([pid, Dexie.minKey], [pid, Dexie.maxKey]).last())?.substance
  }, [])
}

// ---------------------------------------------------------------------------
// Backup / restore
// ---------------------------------------------------------------------------

/** v2 backups carry every table with ids, so profile and fill links survive a restore. */
export interface Backup {
  app: 'dose-curve'
  version: 2
  exportedAt: string
  profiles: Profile[]
  doses: Dose[]
  checkins: Checkin[]
  fills: Fill[]
  schedules: Schedule[]
  settings: Settings
}

/** Everything, or with `profileId` only that profile's rows (its settings point at it). */
export async function exportData(profileId?: number): Promise<Backup> {
  const mine = <T extends { profileId: number }>(rows: T[]) => (profileId ? rows.filter((r) => r.profileId === profileId) : rows)
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(await db.settings.get(1)) }
  if (profileId) settings.activeProfileId = profileId
  return {
    app: 'dose-curve',
    version: 2,
    exportedAt: new Date().toISOString(),
    profiles: (await db.profiles.toArray()).filter((p) => !profileId || p.id === profileId),
    doses: mine(await db.doses.toArray()),
    checkins: mine(await db.checkins.toArray()),
    fills: mine(await db.fills.toArray()),
    schedules: mine(await db.schedules.toArray()),
    settings,
  }
}

const isIso = (s: unknown) => typeof s === 'string' && !Number.isNaN(Date.parse(s))
const inRange = (n: unknown, lo: number, hi: number) => typeof n === 'number' && n >= lo && n <= hi
const isHHMM = (s: unknown) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s)
const optId = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : undefined)
const CHECKIN_KINDS: CheckinKind[] = ['rating', 'wore_off', 'side_effect']

type Raw = Record<string, unknown>

/** Accepts v1 (single person, no profiles) and v2 backups. v1 data is assigned to one "Me" profile. */
export function parseBackup(raw: unknown): Backup {
  const b = raw as Raw
  if (!b || typeof b !== 'object' || !Array.isArray(b.doses) || !Array.isArray(b.checkins)) {
    throw new Error('This file is not a Dose Curve backup.')
  }
  const oldSettings = (b.settings ?? {}) as Partial<Settings>
  const v2 = b.version === 2 && Array.isArray(b.profiles)

  const profiles: Profile[] = v2
    ? (b.profiles as Raw[]).map((p, i) => {
        if (!optId(p.id) || typeof p.name !== 'string' || !isHHMM(p.wakeTime) || !isHHMM(p.sleepTime)) throw new Error(`Profile ${i + 1} is invalid.`)
        return {
          id: p.id as number,
          name: p.name,
          color: String(p.color ?? PROFILE_COLORS[0]),
          kind: p.kind === 'child' ? 'child' : 'self',
          wakeTime: p.wakeTime as string,
          sleepTime: p.sleepTime as string,
          overrides: (p.overrides as Overrides | undefined) ?? undefined,
          ...(Array.isArray(p.schedulePresets) ? { schedulePresets: p.schedulePresets as Profile['schedulePresets'] } : {}),
          ...(Array.isArray(p.favorites) ? { favorites: (p.favorites as unknown[]).map(String) } : {}),
          ...(Array.isArray(p.reminders) ? { reminders: (p.reminders as Raw[]).filter((r) => isHHMM(r.time)).map((r) => ({ time: r.time as string, label: String(r.label ?? '') })) } : {}),
          createdAt: isIso(p.createdAt) ? (p.createdAt as string) : new Date().toISOString(),
        }
      })
    : [{ ...newProfile({ wakeTime: oldSettings.wakeTime ?? '07:00', sleepTime: oldSettings.bedtime ?? '23:00', overrides: oldSettings.overrides }), id: 1 }]
  if (!profiles.length) throw new Error('This backup has no profiles.')
  const profileIds = new Set(profiles.map((p) => p.id))
  const pid = (v: unknown, what: string) => {
    if (!v2) return 1
    const id = optId(v)
    if (!id || !profileIds.has(id)) throw new Error(`${what} points at a profile that is not in the backup.`)
    return id
  }

  const fills: Fill[] = v2 && Array.isArray(b.fills)
    ? (b.fills as Raw[]).map((f, i) => {
        if (!optId(f.id) || !isIso(f.filledAt) || typeof f.strengthMg !== 'number') throw new Error(`Fill ${i + 1} is invalid.`)
        return {
          id: f.id as number,
          profileId: pid(f.profileId, `Fill ${i + 1}`),
          substance: String(f.substance ?? DEFAULT_SUBSTANCE),
          formulation: String(f.formulation ?? 'IR'),
          strengthMg: f.strengthMg as number,
          manufacturer: String(f.manufacturer ?? ''),
          ...(f.pharmacy ? { pharmacy: String(f.pharmacy) } : {}),
          filledAt: f.filledAt as string,
          ...(f.note ? { note: String(f.note) } : {}),
        }
      })
    : []
  const fillIds = new Set(fills.map((f) => f.id))

  const doses: Dose[] = (b.doses as Raw[]).map((d, i) => {
    if (!isIso(d.takenAt) || typeof d.mg !== 'number' || d.mg <= 0) throw new Error(`Dose ${i + 1} is invalid.`)
    const fillId = optId(d.fillId)
    return {
      ...(v2 && optId(d.id) ? { id: d.id as number } : {}),
      profileId: pid(d.profileId, `Dose ${i + 1}`),
      substance: String(d.substance ?? DEFAULT_SUBSTANCE),
      medication: String(d.medication ?? 'Adderall'),
      mg: d.mg,
      formulation: String(d.formulation ?? 'IR'),
      takenAt: d.takenAt as string,
      ...(fillId && fillIds.has(fillId) ? { fillId } : {}),
      ...(typeof d.strengthMg === 'number' && (d.split === 0.5 || d.split === 0.25) ? { strengthMg: d.strengthMg, split: d.split } : {}),
    }
  })

  const checkins: Checkin[] = (b.checkins as Raw[]).map((c, i) => {
    const kind = CHECKIN_KINDS.includes(c.kind as CheckinKind) ? (c.kind as CheckinKind) : 'rating'
    if (!isIso(c.at) || (kind === 'rating' && (!inRange(c.focus, 1, 5) || !inRange(c.mood, 1, 5)))) throw new Error(`Check-in ${i + 1} is invalid.`)
    return {
      ...(v2 && optId(c.id) ? { id: c.id as number } : {}),
      profileId: pid(c.profileId, `Check-in ${i + 1}`),
      kind,
      at: c.at as string,
      focus: typeof c.focus === 'number' ? c.focus : 0,
      mood: typeof c.mood === 'number' ? c.mood : 0,
      ...(c.note ? { note: String(c.note) } : {}),
      ...(Array.isArray(c.tags) ? { tags: (c.tags as unknown[]).map(String) } : {}),
      ...(inRange(c.appetite, 1, 5) ? { appetite: c.appetite as number } : {}),
      ...(typeof c.substance === 'string' ? { substance: c.substance } : {}),
    }
  })

  const schedules: Schedule[] = v2 && Array.isArray(b.schedules)
    ? (b.schedules as Raw[]).map((x, i) => {
        if (typeof x.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !isHHMM(x.wake) || !isHHMM(x.sleep)) throw new Error(`Schedule ${i + 1} is invalid.`)
        return { ...(optId(x.id) ? { id: x.id as number } : {}), profileId: pid(x.profileId, `Schedule ${i + 1}`), date: x.date, wake: x.wake as string, sleep: x.sleep as string }
      })
    : []

  const active = optId(oldSettings.activeProfileId)
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...oldSettings,
    id: 1,
    activeProfileId: active && profileIds.has(active) ? active : profiles[0].id,
  }
  return { app: 'dose-curve', version: 2, exportedAt: String(b.exportedAt ?? ''), profiles, doses, checkins, fills, schedules, settings }
}

/** Replace everything on this device with the backup. */
export async function importData(b: Backup) {
  await db.transaction('rw', [db.doses, db.checkins, db.settings, db.profiles, db.fills, db.schedules], async () => {
    await Promise.all([db.doses.clear(), db.checkins.clear(), db.profiles.clear(), db.fills.clear(), db.schedules.clear()])
    await db.profiles.bulkPut(b.profiles)
    await db.fills.bulkPut(b.fills)
    await db.schedules.bulkPut(b.schedules)
    await db.doses.bulkPut(b.doses)
    await db.checkins.bulkPut(b.checkins)
    await db.settings.put(b.settings)
  })
}
