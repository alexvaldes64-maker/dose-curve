import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { addProfile, db, deleteProfile, ensureProfile, exportData, getActiveProfileId, importData, parseBackup, setDaySchedule, switchProfile } from './db'

/** Build a database exactly as v2 of the app left it. */
async function seedV2() {
  const legacy = new Dexie('doseCurve')
  legacy.version(1).stores({ doses: '++id, takenAt', checkins: '++id, at', settings: 'id' })
  legacy.version(2).stores({ doses: '++id, takenAt, substance', checkins: '++id, at', settings: 'id' })
  await legacy.open()
  await legacy.table('settings').put({
    id: 1,
    wakeTime: '06:30',
    bedtime: '22:00',
    referenceMg: 20,
    model: 'tolerance',
    halfLifeHours: 11,
    kaPerHour: 1,
    toleranceRate: 0.12,
    overrides: { 'caffeine:drink': { halfLifeHours: 8 } },
  })
  await legacy.table('doses').bulkAdd([
    { substance: 'adderall', medication: 'Adderall', mg: 20, formulation: 'IR', takenAt: '2026-10-06T16:30:00.000Z' },
    { substance: 'caffeine', medication: 'Caffeine', mg: 95, formulation: 'drink', takenAt: '2026-10-06T15:00:00.000Z' },
  ])
  await legacy.table('checkins').add({ at: '2026-10-06T19:00:00.000Z', focus: 4, mood: 3, note: 'ok' })
  legacy.close()
}

beforeEach(async () => {
  db.close()
  await Dexie.delete('doseCurve')
})
afterAll(() => db.close())

describe('v3 migration', () => {
  it('moves v2 data into a "Me" profile built from the old settings', async () => {
    await seedV2()
    await db.open()

    const profiles = await db.profiles.toArray()
    expect(profiles).toHaveLength(1)
    const me = profiles[0]
    expect(me).toMatchObject({ name: 'Me', kind: 'self', wakeTime: '06:30', sleepTime: '22:00' })
    expect(me.overrides).toEqual({ 'caffeine:drink': { halfLifeHours: 8 } })

    const doses = await db.doses.toArray()
    expect(doses).toHaveLength(2)
    expect(doses.every((d) => d.profileId === me.id)).toBe(true)

    const checkins = await db.checkins.toArray()
    expect(checkins).toEqual([expect.objectContaining({ profileId: me.id, kind: 'rating', focus: 4, mood: 3, note: 'ok' })])

    const settings = await db.settings.get(1)
    expect(settings).toMatchObject({ activeProfileId: me.id, model: 'tolerance' })
    expect(await getActiveProfileId()).toBe(me.id)
  })

  it('a fresh install starts with one profile and points settings at it', async () => {
    await db.open()
    const profiles = await db.profiles.toArray()
    expect(profiles).toHaveLength(1)
    expect((await db.settings.get(1))?.activeProfileId).toBe(profiles[0].id)
  })

  it('ensureProfile repairs a missing active profile without duplicating', async () => {
    await db.open()
    await db.settings.update(1, { activeProfileId: 999 })
    const id = await ensureProfile()
    expect(await db.profiles.count()).toBe(1)
    expect(id).toBe((await db.profiles.toArray())[0].id)
    expect((await db.settings.get(1))?.activeProfileId).toBe(id)
  })

  it('profile-scoped data stays separate', async () => {
    await db.open()
    const me = await getActiveProfileId()
    const kid = (await db.profiles.add({ name: 'Sam', color: '#FF9F0A', kind: 'child', wakeTime: '06:45', sleepTime: '20:30', createdAt: new Date().toISOString() })) as number
    await db.doses.bulkAdd([
      { profileId: me, substance: 'adderall', medication: 'Adderall', mg: 20, formulation: 'IR', takenAt: '2026-10-06T16:00:00.000Z' },
      { profileId: kid, substance: 'methylphenidate', medication: 'Ritalin', mg: 10, formulation: 'IR', takenAt: '2026-10-06T14:00:00.000Z' },
    ])
    const mine = await db.doses.where('[profileId+takenAt]').between([me, Dexie.minKey], [me, Dexie.maxKey]).toArray()
    expect(mine.map((d) => d.mg)).toEqual([20])
  })
})

describe('backups', () => {
  it('v1 backups import into a single "Me" profile', () => {
    const b = parseBackup({
      app: 'dose-curve',
      version: 1,
      exportedAt: '2026-10-06T00:00:00.000Z',
      doses: [{ medication: 'Adderall', mg: 20, formulation: 'IR', takenAt: '2026-10-06T16:30:00.000Z' }],
      checkins: [{ at: '2026-10-06T19:00:00.000Z', focus: 5, mood: 4 }],
      settings: { wakeTime: '08:00', bedtime: '00:30' },
    })
    expect(b.version).toBe(2)
    expect(b.profiles).toEqual([expect.objectContaining({ id: 1, name: 'Me', wakeTime: '08:00', sleepTime: '00:30' })])
    expect(b.doses[0]).toMatchObject({ profileId: 1, substance: 'adderall' })
    expect(b.checkins[0]).toMatchObject({ profileId: 1, kind: 'rating' })
    expect(b.settings.activeProfileId).toBe(1)
  })

  it('v2 backups round-trip with profile and fill links intact', async () => {
    await db.open()
    const me = await getActiveProfileId()
    const kid = (await db.profiles.add({ name: 'Sam', color: '#FF9F0A', kind: 'child', wakeTime: '06:45', sleepTime: '20:30', createdAt: '2026-10-01T00:00:00.000Z' })) as number
    const fill = (await db.fills.add({ profileId: kid, substance: 'methylphenidate', formulation: 'ER', strengthMg: 18, manufacturer: 'Generic A', filledAt: '2026-10-01T00:00:00.000Z' })) as number
    await db.doses.add({ profileId: kid, fillId: fill, substance: 'methylphenidate', medication: 'Ritalin / Concerta', mg: 18, formulation: 'ER', takenAt: '2026-10-06T13:00:00.000Z' })
    await db.checkins.add({ profileId: me, kind: 'wore_off', at: '2026-10-06T21:00:00.000Z', focus: 0, mood: 0 })
    await db.schedules.add({ profileId: me, date: '2026-10-06', wake: '18:00', sleep: '09:00' })

    const first = await exportData()
    const parsed = parseBackup(JSON.parse(JSON.stringify(first)))
    await db.delete()
    await db.open()
    await importData(parsed)
    const second = await exportData()

    const strip = (x: typeof first) => ({ ...x, exportedAt: '' })
    expect(strip(second)).toEqual(strip(first))
    expect((await db.doses.toArray())[0]).toMatchObject({ profileId: kid, fillId: fill })
  })

  it('rejects rows that point at a missing profile', () => {
    expect(() =>
      parseBackup({
        app: 'dose-curve',
        version: 2,
        profiles: [{ id: 1, name: 'Me', wakeTime: '07:00', sleepTime: '23:00' }],
        doses: [{ id: 1, profileId: 2, mg: 20, takenAt: '2026-10-06T16:30:00.000Z' }],
        checkins: [],
        settings: {},
      }),
    ).toThrow(/profile that is not in the backup/)
  })
})

describe('profiles and schedules', () => {
  it('adding a profile switches to it; switching changes the active id', async () => {
    await db.open()
    const me = await getActiveProfileId()
    const kid = await addProfile({ name: 'Sam', kind: 'child' })
    expect(await getActiveProfileId()).toBe(kid)
    await switchProfile(me)
    expect(await getActiveProfileId()).toBe(me)
  })

  it('deleting a profile removes only its data and moves the active profile', async () => {
    await db.open()
    const me = await getActiveProfileId()
    const kid = await addProfile({ name: 'Sam', kind: 'child' })
    await db.doses.bulkAdd([
      { profileId: me, substance: 'adderall', medication: 'Adderall', mg: 20, formulation: 'IR', takenAt: '2026-10-06T16:00:00.000Z' },
      { profileId: kid, substance: 'methylphenidate', medication: 'Ritalin', mg: 10, formulation: 'IR', takenAt: '2026-10-06T14:00:00.000Z' },
    ])
    await db.checkins.add({ profileId: kid, kind: 'rating', at: '2026-10-06T18:00:00.000Z', focus: 3, mood: 3, appetite: 2 })
    await db.fills.add({ profileId: kid, substance: 'methylphenidate', formulation: 'IR', strengthMg: 10, manufacturer: 'X', filledAt: '2026-10-01T00:00:00.000Z' })
    await db.schedules.add({ profileId: kid, date: '2026-10-06', wake: '06:00', sleep: '20:00' })

    await deleteProfile(kid)
    expect(await db.profiles.count()).toBe(1)
    expect((await db.doses.toArray()).map((d) => d.profileId)).toEqual([me])
    expect(await db.checkins.count()).toBe(0)
    expect(await db.fills.count()).toBe(0)
    expect(await db.schedules.count()).toBe(0)
    expect(await getActiveProfileId()).toBe(me)
  })

  it('the last profile cannot be deleted', async () => {
    await db.open()
    await expect(deleteProfile(await getActiveProfileId())).rejects.toThrow(/At least one profile/)
    expect(await db.profiles.count()).toBe(1)
  })

  it('exporting one profile includes only its rows', async () => {
    await db.open()
    const me = await getActiveProfileId()
    const kid = await addProfile({ name: 'Sam', kind: 'child' })
    await db.doses.bulkAdd([
      { profileId: me, substance: 'adderall', medication: 'Adderall', mg: 20, formulation: 'IR', takenAt: '2026-10-06T16:00:00.000Z' },
      { profileId: kid, substance: 'methylphenidate', medication: 'Ritalin', mg: 10, formulation: 'IR', takenAt: '2026-10-06T14:00:00.000Z' },
    ])
    const b = await exportData(kid)
    expect(b.profiles.map((p) => p.name)).toEqual(['Sam'])
    expect(b.doses.map((d) => d.mg)).toEqual([10])
    expect(b.settings.activeProfileId).toBe(kid)
    expect(() => parseBackup(JSON.parse(JSON.stringify(b)))).not.toThrow()
  })

  it('a day schedule can be set, replaced and cleared', async () => {
    await db.open()
    const day = new Date(2026, 9, 6)
    await setDaySchedule(day, { wake: '18:00', sleep: '09:00' })
    await setDaySchedule(day, { wake: '19:00', sleep: '10:00' })
    expect(await db.schedules.toArray()).toEqual([expect.objectContaining({ date: '2026-10-06', wake: '19:00', sleep: '10:00' })])
    await setDaySchedule(day, null)
    expect(await db.schedules.count()).toBe(0)
  })
})

describe('fills', () => {
  it('deleting a fill unpins its doses instead of deleting them', async () => {
    const { saveFill, deleteFill } = await import('./db')
    await db.open()
    const pid = await getActiveProfileId()
    const fill = await saveFill({ profileId: pid, substance: 'adderall', formulation: 'IR', strengthMg: 10, manufacturer: 'Teva', filledAt: '2026-10-01T12:00:00.000Z' })
    await db.doses.add({ profileId: pid, fillId: fill, substance: 'adderall', medication: 'Adderall', mg: 10, formulation: 'IR', takenAt: '2026-10-02T15:00:00.000Z' })
    await deleteFill(fill)
    const [d] = await db.doses.toArray()
    expect(d.fillId).toBeUndefined()
    expect(d.mg).toBe(10)
    expect(await db.fills.count()).toBe(0)
  })
})
