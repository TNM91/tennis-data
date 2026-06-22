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
})
