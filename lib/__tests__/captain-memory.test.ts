import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CAPTAIN_RESUME_STORAGE_KEY,
  getCaptainResumeStorageKey,
  readCaptainResumeState,
  writeCaptainResumeState,
} from '../captain-memory'

function installLocalStorage() {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: vi.fn((key: string) => store.get(key) || null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  }

  vi.stubGlobal('window', { localStorage })
  return store
}

describe('captain resume memory', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps each signed-in account in its own captain context', () => {
    installLocalStorage()

    writeCaptainResumeState({ team: 'Team One', league: 'Dallas', flight: '4.0' }, 'user-1')
    writeCaptainResumeState({ team: 'Team Two', league: 'Austin', flight: '3.5' }, 'user-2')

    expect(readCaptainResumeState('user-1')?.team).toBe('Team One')
    expect(readCaptainResumeState('user-2')?.team).toBe('Team Two')
  })

  it('does not treat old device-wide memory as signed-in account memory', () => {
    const store = installLocalStorage()
    store.set(CAPTAIN_RESUME_STORAGE_KEY, JSON.stringify({ team: 'Previous User Team' }))

    expect(readCaptainResumeState('user-1')).toBeNull()
    expect(readCaptainResumeState()).toEqual({ team: 'Previous User Team' })
  })

  it('uses a stable account-specific storage key', () => {
    expect(getCaptainResumeStorageKey(' user-1 ')).toBe(`${CAPTAIN_RESUME_STORAGE_KEY}:user-1`)
    expect(getCaptainResumeStorageKey(null)).toBe(CAPTAIN_RESUME_STORAGE_KEY)
  })
})
