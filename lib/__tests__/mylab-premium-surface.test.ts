import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

describe('My Lab premium surface', () => {
  it('keeps the top routine tennis-specific and Data Assist aware', () => {
    expect(source).toContain('MY_LAB_PREMIUM_SIGNALS')
    expect(source).toContain('MY_LAB_READABILITY_CUES')
    expect(source).toContain('Personal scorecard')
    expect(source).toContain('Match prep')
    expect(source).toContain('Reviewed uploads')
    expect(source).toContain('Use reviewed uploads for scorecards, schedules, and rosters')
    expect(source).toContain('Connect your player record, review what changed, and leave with one action for the next match.')
    expect(source).toContain('Player identity')
    expect(source).toContain('Scorecard review')
    expect(source).toContain('Match-day action')
    expect(source).not.toContain('USTA API')
  })

  it('keeps premium signal cards responsive for light-mode mobile scanning', () => {
    expect(source).toContain('labPremiumSignalGridStyle(isTablet)')
    expect(source).toContain('labPremiumSignalCardStyle')
    expect(source).toContain('gridTemplateColumns: isTablet')
    expect(source).toContain('minmax(0, 1fr)')
    expect(source).toContain('labReadabilityCueGridStyle(isTablet)')
    expect(source).toContain('overflowWrap: \'anywhere\'')
  })

  it('uses theme-safe setup step number contrast', () => {
    expect(source).toContain('setupStepNumberStyle')
    expect(source).toContain("color: 'var(--foreground-strong)'")
    expect(source).toContain("background: 'color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-chip-bg) 78%)'")
    expect(source).not.toContain("const setupStepNumberStyle: CSSProperties = {\n  width: 32,\n  height: 32,\n  borderRadius: '50%',\n  display: 'inline-flex',\n  alignItems: 'center',\n  justifyContent: 'center',\n  background: 'linear-gradient(135deg, var(--brand-lime), var(--brand-green))',\n  color: 'var(--text-dark)'")
  })

  it('keeps My Lab numbered markers shell-aware instead of dark text on gradients', () => {
    for (const marker of [
      'labRoutineNumberStyle',
      'labPlaybookStepStyle',
      'setupStepNumberStyle',
      'matchupQueueRankStyle',
    ]) {
      expect(source).toContain(marker)
    }

    expect(source).not.toContain("const labRoutineNumberStyle: CSSProperties = {\n  width: 34,\n  height: 34,\n  borderRadius: 14,\n  display: 'inline-flex',\n  alignItems: 'center',\n  justifyContent: 'center',\n  background: 'linear-gradient(135deg, var(--brand-blue-2), var(--brand-green))',\n  color: 'var(--text-dark)'")
    expect(source).not.toContain("background: complete ? 'var(--brand-green)' : 'var(--shell-panel-bg)',\n  color: complete ? 'var(--text-dark)' : 'var(--foreground-strong)'")
    expect(source).not.toContain("const matchupQueueRankStyle: CSSProperties = {\n  width: 34,\n  height: 34,\n  borderRadius: '50%',\n  display: 'inline-flex',\n  alignItems: 'center',\n  justifyContent: 'center',\n  background: 'linear-gradient(135deg, var(--brand-lime), var(--brand-green))',\n  color: 'var(--text-dark)'")
  })
})
