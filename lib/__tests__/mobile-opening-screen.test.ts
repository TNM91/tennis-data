import {beforeEach, expect, it, vi} from 'vitest'
import type {SupportedStorage} from '@supabase/auth-js'
const native = vi.hoisted(() => ({storage: undefined as SupportedStorage | undefined}))
vi.mock('../native-auth-storage', () => ({getNativeAuthStorage: () => native.storage}))
import {openingPreferences, resolveOpeningScreen} from '../../mobile/src/opening-screen'
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
function memory() {
  const values = new Map<string, string>()
  return {values, getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => {values.set(key, value)}), removeItem: (key: string) => {values.delete(key)}}
}
beforeEach(() => {vi.resetModules(); native.storage = undefined})
it('defaults to My Lab and keeps the saved choice and recent tab separate for each account', async () => {
  const storage = memory(), preferences = openingPreferences(owner, storage)
  expect(await resolveOpeningScreen(owner, () => true, storage)).toBe('lab')
  await preferences.save('teams'); await preferences.remember('explore')
  expect(await resolveOpeningScreen(owner, () => true, storage)).toBe('teams')
  expect(await resolveOpeningScreen(other, () => true, storage)).toBe('lab')
  await preferences.save('last')
  expect(await resolveOpeningScreen(owner, () => true, storage)).toBe('explore')
  await preferences.remember('more')
  expect(await resolveOpeningScreen(owner, () => true, storage)).toBe('more')
})
it('rejects a stale account after a delayed device read', async () => {
  let current = true, release!: (value: string) => void
  const storage: SupportedStorage = {...memory(), getItem: () => new Promise<string>(resolve => {release = resolve})}
  const read = resolveOpeningScreen(owner, () => current, storage)
  current = false; release('teams')
  await expect(read).rejects.toThrow('Account changed')
})
it('keeps launch usable during storage failure but never claims an unconfirmed setting saved', async () => {
  const failed: SupportedStorage = {...memory(), getItem: () => {throw Error('Locked')}}
  expect(await resolveOpeningScreen(owner, () => true, failed)).toBe('lab')
  const noWrite = {...memory(), setItem: () => {}}
  await expect(openingPreferences(owner, noWrite).save('compete')).rejects.toThrow('unconfirmed')
})
it('queues cleanup after pending writes without deleting another account’s preference', async () => {
  const storage = memory(), preferences = openingPreferences(owner, storage)
  await openingPreferences(other, storage).save('compete')
  await Promise.all([preferences.save('teams'), preferences.remember('explore'), preferences.clear()])
  expect(await preferences.read()).toBe('lab')
  expect(await preferences.last()).toBe('lab')
  expect(await openingPreferences(other, storage).read()).toBe('compete')
})
it('uses native encrypted storage and coalesces repeated tab visits without overwriting the opening choice', async () => {
  const storage = memory(); native.storage = storage
  const {openingPreferences: devicePreferences} = await import('../../mobile/src/opening-screen')
  const preferences = devicePreferences(owner)
  await preferences.save('last')
  await Promise.all([preferences.remember('teams'), preferences.remember('explore'), preferences.remember('explore')])
  expect(await preferences.last()).toBe('explore')
  expect(await preferences.read()).toBe('last')
  expect(storage.setItem.mock.calls.filter(([key]) => key.startsWith('opening-tab:'))).toHaveLength(1)
  await preferences.clear(); await preferences.remember('explore')
  expect(await preferences.last()).toBe('explore')
})
it('allows a failed tab write to retry on the next visit', async () => {
  const storage = memory(); native.storage = storage
  const {openingPreferences: devicePreferences} = await import('../../mobile/src/opening-screen')
  storage.setItem.mockImplementationOnce(() => {throw Error('Locked')})
  const preferences = devicePreferences(owner)
  await expect(preferences.remember('teams')).rejects.toThrow('Locked')
  await preferences.remember('teams')
  expect(await preferences.last()).toBe('teams')
})
