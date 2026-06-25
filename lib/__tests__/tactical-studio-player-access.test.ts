import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const gateSource = readFileSync(join(process.cwd(), 'components/tactical/TiqTacticalStudioGate.tsx'), 'utf8')
const studioSource = readFileSync(join(process.cwd(), 'components/tactical/TiqTacticalStudio.tsx'), 'utf8')

describe('Tactical Studio player access', () => {
  it('lets Player users open Tactics Tools without requiring Coach', () => {
    expect(gateSource).toContain('access.canUseAdvancedPlayerInsights')
    expect(gateSource).toContain('Loading your tactical board.')
    expect(gateSource).not.toContain('Loading your tactical workspace.')
    expect(gateSource).toContain('TIQ Tactical Studio is part of Player, Coach, Captain, and Full-Court access.')
    expect(gateSource).toContain('planId="player_plus"')
    expect(gateSource).toContain('Unlock TIQ Tactical Studio with Player.')
    expect(gateSource).toContain('Player includes My Lab, Level Up, Tactics Tools')
  })

  it('keeps the opened studio chrome on the current Player tier name', () => {
    expect(studioSource).toContain('Player ready')
    expect(studioSource).not.toContain('Player+ ready')
  })

  it('connects Tactical Studio to a Player ID starter path before the unlock prompt', () => {
    expect(gateSource).toContain("import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'")
    expect(gateSource).toContain("const TACTICS_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('smart-attacker-4-0-to-4-5')")
    expect(gateSource).toContain('const TACTICS_LEVEL_UP_HREF = `/level-up/${TACTICS_PLAYER_IDENTITY.slug}`')
    expect(gateSource).toContain('const TACTICS_PLAYER_DEVELOPMENT_HREF = `/player-development/${TACTICS_PLAYER_IDENTITY.slug}`')
    expect(gateSource).toContain('Tactics Player ID starter path')
    expect(gateSource).toContain('Tactics Player ID starter read')
    expect(gateSource).toContain('Start with the player read, then build the board.')
    expect(gateSource).toContain('Start Level Up')
    expect(gateSource).toContain('Read Player ID')
    expect(gateSource.indexOf('Tactics Player ID starter path')).toBeLessThan(gateSource.indexOf('Unlock TIQ Tactical Studio with Player.'))
  })

  it('keeps the Tactics Player ID bridge compact for phone layouts', () => {
    expect(gateSource).toContain('styles.tacticsPlayerIdTrail')
    expect(gateSource).toContain('styles.tacticsPlayerIdGrid')
    expect(gateSource).toContain('styles.tacticsPlayerIdActions')
    expect(gateSource).not.toContain('gateStats gateStats')
  })
})
