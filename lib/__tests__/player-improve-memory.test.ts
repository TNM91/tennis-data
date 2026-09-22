import { describe, expect, it } from 'vitest'
import {
  PLAYER_IMPROVE_RESUME_STORAGE_KEY,
  buildPlayerImproveLevelUpHref,
  chooseLatestPlayerImproveResumeState,
  getPlayerImproveResumeHref,
  getPlayerImproveResumeStorageKey,
  sanitizePlayerImproveResumeState,
} from '../player-improve-memory'

describe('player improve memory', () => {
  it('scopes browser storage to the signed-in account', () => {
    expect(getPlayerImproveResumeStorageKey(' player-1 ')).toBe(`${PLAYER_IMPROVE_RESUME_STORAGE_KEY}:player-1`)
  })

  it('sanitizes active work and rejects external destinations', () => {
    expect(sanitizePlayerImproveResumeState({
      identitySlug: ' relentless-competitor-4-0 ',
      workType: 'court',
      trainingContext: 'doubles',
      lastSurface: 'level-up',
      lastHref: 'https://example.com/steal',
      sessionDraft: { rating: 4, proofCounter: 12.4, elapsedSeconds: 92.8, note: ' clean rep ' },
    })).toEqual({
      identitySlug: 'relentless-competitor-4-0',
      workType: 'court',
      trainingContext: 'doubles',
      lastSurface: 'level-up',
      sessionDraft: { rating: 4, note: 'clean rep', proofCounter: 12, elapsedSeconds: 93 },
    })
  })

  it('chooses the newest local or cloud state', () => {
    const local = { focusId: 'serve', lastVisitedAt: '2026-08-03T10:00:00.000Z' }
    const cloud = { focusId: 'return', lastVisitedAt: '2026-08-03T11:00:00.000Z' }
    expect(chooseLatestPlayerImproveResumeState(local, cloud)).toBe(cloud)
  })

  it('builds exact Level Up, player path, and conversation destinations', () => {
    const state = {
      identitySlug: 'smart-attacker-4-0-to-4-5',
      focusId: 'serve',
      workType: 'court' as const,
      trainingContext: 'alone' as const,
      drillId: 'serve-targets',
    }
    expect(buildPlayerImproveLevelUpHref(state)).toBe(
      '/level-up/smart-attacker-4-0-to-4-5?focus=serve&workType=court&context=alone&drill=serve-targets#level-up-flow',
    )
    expect(getPlayerImproveResumeHref({ lastSurface: 'player-path', identitySlug: 'smart-attacker-4-0-to-4-5' }))
      .toBe('/player-development/smart-attacker-4-0-to-4-5')
    expect(getPlayerImproveResumeHref({ lastSurface: 'conversation', conversationId: 'thread 1' }))
      .toBe('/messages?thread=thread%201')
  })
})
