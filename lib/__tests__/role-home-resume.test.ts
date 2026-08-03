import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getRoleHomeResumeStorageKey,
  isSafeRoleHomeHref,
  readRoleHomeResume,
  writeRoleHomeResume,
} from '../role-home-resume'

describe('role home resume', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps each guided home in its own storage lane', () => {
    expect(getRoleHomeResumeStorageKey('Improve')).toContain(':improve')
    expect(getRoleHomeResumeStorageKey('League Office')).toContain(':league-office')
    expect(isSafeRoleHomeHref('/matchup?playerA=1')).toBe(true)
    expect(isSafeRoleHomeHref('https://bad.example')).toBe(false)
  })

  it('round-trips the last useful action and ignores unsafe stored links', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) || null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })

    writeRoleHomeResume('compete', {
      href: '/matchup',
      title: 'Prep matchup',
      detail: 'Compare the players.',
      icon: 'matchupAnalysis',
      contextValue: 'Next match',
      updatedAt: '2026-08-03T18:00:00.000Z',
    })
    expect(readRoleHomeResume('compete')).toMatchObject({
      href: '/matchup',
      title: 'Prep matchup',
      contextValue: 'Next match',
    })

    values.set(getRoleHomeResumeStorageKey('compete'), JSON.stringify({ href: 'javascript:alert(1)', title: 'Bad' }))
    expect(readRoleHomeResume('compete')).toBeNull()
  })
})
