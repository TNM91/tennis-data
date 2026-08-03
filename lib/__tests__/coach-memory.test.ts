import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COACH_RESUME_STORAGE_KEY,
  buildCoachWorkspaceHref,
  chooseLatestCoachResumeState,
  getCoachResumeHref,
  getCoachResumeStorageKey,
  isSafeCoachResumeHref,
  readCoachResumeState,
  sanitizeCoachResumeState,
  writeCoachResumeState,
} from '../coach-memory'

function installLocalStorage() {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: vi.fn((key: string) => store.get(key) || null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
  }

  vi.stubGlobal('window', { localStorage })
  return store
}

describe('coach resume memory', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps each signed-in coach in their own player context', () => {
    installLocalStorage()

    writeCoachResumeState({ studentLinkId: 'student-1', playerName: 'Player One' }, 'coach-1')
    writeCoachResumeState({ studentLinkId: 'student-2', playerName: 'Player Two' }, 'coach-2')

    expect(readCoachResumeState('coach-1')?.playerName).toBe('Player One')
    expect(readCoachResumeState('coach-2')?.playerName).toBe('Player Two')
  })

  it('does not treat old device-wide memory as signed-in coach memory', () => {
    const store = installLocalStorage()
    store.set(COACH_RESUME_STORAGE_KEY, JSON.stringify({ playerName: 'Previous Coach Player' }))

    expect(readCoachResumeState('coach-1')).toBeNull()
    expect(readCoachResumeState()?.playerName).toBe('Previous Coach Player')
    expect(getCoachResumeStorageKey(' coach-1 ')).toBe(`${COACH_RESUME_STORAGE_KEY}:coach-1`)
  })

  it('keeps only safe player, draft, and route context', () => {
    expect(sanitizeCoachResumeState({
      studentLinkId: ' student-1 ',
      playerName: ' Player One ',
      identitySlug: 'relentless-competitor-4-0',
      lastSurface: 'assignment',
      lastHref: '/coach?studentLinkId=student-1#coach-lesson-frame',
      assignmentDraft: {
        title: ' Serve targets ',
        focus: ' Wide and T ',
        dueDate: '2026-08-10',
        ignored: 'value',
      },
      ignored: 'value',
    })).toEqual({
      studentLinkId: 'student-1',
      playerName: 'Player One',
      identitySlug: 'relentless-competitor-4-0',
      lastSurface: 'assignment',
      lastHref: '/coach?studentLinkId=student-1#coach-lesson-frame',
      assignmentDraft: {
        title: 'Serve targets',
        focus: 'Wide and T',
        dueDate: '2026-08-10',
      },
    })

    expect(isSafeCoachResumeHref('https://example.com/coach')).toBe(false)
    expect(isSafeCoachResumeHref('//example.com/coach')).toBe(false)
  })

  it('restores the exact conversation and newest device state', () => {
    const local = {
      studentLinkId: 'student-1',
      lastSurface: 'assignment' as const,
      lastVisitedAt: '2026-08-03T12:00:00.000Z',
    }
    const cloud = {
      studentLinkId: 'student-1',
      conversationId: 'thread-1',
      lastSurface: 'conversation' as const,
      lastVisitedAt: '2026-08-03T13:00:00.000Z',
    }

    expect(getCoachResumeHref(local)).toBe('/coach?studentLinkId=student-1#coach-lesson-frame')
    expect(getCoachResumeHref(cloud)).toBe('/messages?thread=thread-1')
    expect(chooseLatestCoachResumeState(local, cloud)).toBe(cloud)
    expect(buildCoachWorkspaceHref('coach-linked-dashboard', 'student 1')).toBe(
      '/coach?studentLinkId=student%201#coach-linked-dashboard',
    )
  })
})
