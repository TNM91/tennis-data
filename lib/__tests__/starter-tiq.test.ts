import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearStarterTiq, legacyStarterResult, readStarterAnswers, starterResult, starterStorage,
} from '../../mobile/src/starter-tiq'

const matchReady = { serve: 1, return: 2, rally: 2, movement: 2, net: 2, points: 2 }

afterEach(() => vi.unstubAllGlobals())

describe('Starter TiQ', () => {
  it('keeps the score within the 1–10 scale and gives the weakest skill a drill', () => {
    const core = Object.keys(matchReady)
    for (const [value, score, level] of [
      [0, 1, 'Learning the game'],
      [1, 4, 'Building consistency'],
      [2, 7, 'Match ready'],
      [3, 10, 'Competitive'],
    ] as const) {
      const answers = readStarterAnswers(Object.fromEntries(core.map(skill => [skill, value])))!
      expect(starterResult(answers)).toMatchObject({ score, level })
    }
    expect(starterResult(readStarterAnswers(matchReady)!)).toMatchObject({
      score: 7, focus: { skill: 'Serve', drill: { id: 'serve-target-call' } },
    })
  })

  it('keeps singles and doubles optional and independent of the core estimate', () => {
    const answers = readStarterAnswers({
      ...matchReady, 'singles-build': 3, 'singles-cover': 3, 'doubles-coverage': 0, 'doubles-patterns': 1,
    })!
    expect(starterResult(answers)).toMatchObject({ score: 7, singles: 7, doubles: 6 })
    expect(starterResult(readStarterAnswers(matchReady)!)).toMatchObject({ score: 7, singles: null, doubles: null })
    expect(readStarterAnswers({ ...matchReady, 'singles-cover': 2 })).toBeNull()
    expect(readStarterAnswers({ ...matchReady, net: 4 })).toBeNull()
    expect(readStarterAnswers({ ...matchReady, net: undefined })).toBeNull()
  })

  it('retains the existing estimate and prefills known answers until the player completes the upgrade', async () => {
    const oldKey = 'starter-tiq:v1:player'
    const entries = new Map([[oldKey, JSON.stringify([2, 1, 3])], ['starter-tiq:v2:player', '{']])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
      removeItem: (key: string) => entries.delete(key),
    })
    const store = starterStorage('player')
    const before = await store.read()
    expect(before.history).toBeNull()
    expect(legacyStarterResult(before.legacy!)).toEqual({
      level: 'Match ready', prefill: { rally: 2, serve: 1, points: 3 },
      drill: { id: 'serve-target-call', title: 'Serve Target Call' },
    })
    expect(await starterStorage('other-player').read()).toEqual({ history: null, legacy: undefined })
    const first = { date: '2026-11-16', answers: readStarterAnswers(matchReady)! }
    const latest = { date: '2026-11-30', answers: readStarterAnswers({ ...matchReady, serve: 3 })! }
    await store.save({ current: first, previous: null })
    await store.save({ current: latest, previous: first })
    expect(await store.read()).toEqual({ history: { current: latest, previous: first }, legacy: undefined })
    expect(entries.has(oldKey)).toBe(true)
    await clearStarterTiq('player')
    expect(await store.read()).toEqual({ history: null, legacy: undefined })
  })
})
