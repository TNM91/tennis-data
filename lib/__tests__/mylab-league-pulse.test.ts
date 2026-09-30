import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

describe('My TIQ Leagues player pulse', () => {
  it('keeps player leagues distinct from teams and gates only the deeper insight layer', () => {
    const panelSource = fs.readFileSync(path.join(repoRoot, 'app/mylab/my-leagues-panel.tsx'), 'utf8')
    const pageSource = fs.readFileSync(path.join(repoRoot, 'app/mylab/page.tsx'), 'utf8')

    expect(panelSource).toContain('My TIQ Leagues')
    expect(panelSource).toContain('Your player leagues stay separate from teams')
    expect(panelSource).toContain('League pulse')
    expect(panelSource).toContain('MEMBERSHIP_TIERS.player_plus.upgradeCue')
    expect(panelSource).toContain('insightsUnlocked && league.weeklyPulse')
    expect(pageSource).toContain('insightsUnlocked={canUseAdvancedPlayerInsights}')
  })
})
