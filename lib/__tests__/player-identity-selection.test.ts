import { describe, expect, it } from 'vitest'
import {
  PLAYER_DEVELOPMENT_FOCUS_PATHS,
  PLAYER_DEVELOPMENT_PLAYING_STYLES,
  getPlayerDevelopmentIdentityKind,
} from '../player-development'
import { isPlayerStyleSlug } from '../player-identity-selection'

describe('Player ID style and focus taxonomy', () => {
  it('separates durable playing styles from changeable development focuses', () => {
    expect(PLAYER_DEVELOPMENT_PLAYING_STYLES.map((identity) => identity.slug)).toEqual([
      'relentless-competitor-4-0',
      'smart-attacker-4-0-to-4-5',
      'consistent-builder-4-0',
      'doubles-commander-4-0',
      'defensive-counterpuncher-4-0',
      'all-court-adapter-4-0',
    ])
    expect(PLAYER_DEVELOPMENT_FOCUS_PATHS).toHaveLength(7)
    expect(PLAYER_DEVELOPMENT_FOCUS_PATHS.map((identity) => identity.slug)).toContain('serve-forward-finisher-4-0')
    expect(PLAYER_DEVELOPMENT_FOCUS_PATHS.map((identity) => identity.slug)).toContain('backhand-stability-builder-4-0')
    expect(PLAYER_DEVELOPMENT_FOCUS_PATHS.map((identity) => identity.slug)).toContain('pressure-closer-4-0')
  })

  it('persists only core playing styles as the default Level Up identity', () => {
    expect(isPlayerStyleSlug('relentless-competitor-4-0')).toBe(true)
    expect(isPlayerStyleSlug('smart-attacker-4-0-to-4-5')).toBe(true)
    expect(isPlayerStyleSlug('return-disruptor-4-0')).toBe(false)
    expect(isPlayerStyleSlug('unknown')).toBe(false)
    expect(getPlayerDevelopmentIdentityKind('net-confidence-builder-4-0')).toBe('development-focus')
  })
})
