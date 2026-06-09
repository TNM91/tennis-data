import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'components/tactical/TiqTacticalStudioGate.tsx'), 'utf8')

describe('Tactical Studio player access', () => {
  it('lets Player users open Tactics Tools without requiring Coach', () => {
    expect(source).toContain('access.canUseAdvancedPlayerInsights')
    expect(source).toContain('TIQ Tactical Studio is part of Player, Coach, Captain, and Full-Court access.')
    expect(source).toContain('planId="player_plus"')
    expect(source).toContain('Unlock TIQ Tactical Studio with Player.')
    expect(source).toContain('Player includes My Lab, Level Up, Tactics Tools')
  })
})
