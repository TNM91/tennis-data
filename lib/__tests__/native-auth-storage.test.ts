import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getNativeAuthStorage } from '../native-auth-storage'

const mocks = vi.hoisted(() => ({
  native: vi.fn(),
  getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(),
  setKeyPrefix: vi.fn(), setSynchronize: vi.fn(), setDefaultKeychainAccess: vi.fn(),
  then: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }))
vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: mocks,
  KeychainAccess: { whenUnlockedThisDeviceOnly: 1 },
}))

describe('native auth persistence', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.native.mockReturnValue(true) })

  it('keeps the existing browser storage path without touching the native store', () => {
    mocks.native.mockReturnValue(false)
    expect(getNativeAuthStorage()).toBeUndefined()
    expect(mocks.setKeyPrefix).not.toHaveBeenCalled()
  })

  it('restores stored strings and removes them on sign-out, with one isolated initialization', async () => {
    const storage = getNativeAuthStorage()!
    mocks.getItem.mockResolvedValue('synthetic-session')
    await storage.setItem('session', 'synthetic-session')
    expect(await storage.getItem('session')).toBe('synthetic-session')
    await storage.removeItem('session')
    expect(mocks.setKeyPrefix).toHaveBeenCalledExactlyOnceWith('tenaceiq-auth_')
    expect(mocks.setSynchronize).toHaveBeenCalledExactlyOnceWith(false)
    expect(mocks.setDefaultKeychainAccess).toHaveBeenCalledExactlyOnceWith(1)
    expect(mocks.setItem).toHaveBeenCalledWith('session', 'synthetic-session')
    expect(mocks.removeItem).toHaveBeenCalledWith('session')
    expect(mocks.then).not.toHaveBeenCalled()
  })

  it('preserves missing sessions and propagates secure-store errors', async () => {
    const storage = getNativeAuthStorage()!
    mocks.getItem.mockResolvedValue(null)
    expect(await storage.getItem('missing')).toBeNull()
    mocks.setItem.mockRejectedValue(new Error('native store unavailable'))
    await expect(storage.setItem('session', 'synthetic-session')).rejects.toThrow('native store unavailable')
  })
})
