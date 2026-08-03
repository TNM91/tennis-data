import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const component = readFileSync(join(process.cwd(), 'app/components/role-action-home.tsx'), 'utf8')
const styles = readFileSync(join(process.cwd(), 'app/components/role-action-home.module.css'), 'utf8')
const coach = readFileSync(join(process.cwd(), 'app/coach/page.tsx'), 'utf8')
const league = readFileSync(join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'), 'utf8')

describe('role action home', () => {
  it('gives Coach and League the same task-first entry pattern', () => {
    expect(component).toContain('What do you need to do?')
    expect(component).toContain('primaryAction')
    expect(component).toContain('quickActions.slice(0, 4)')
    expect(component).toContain('<details className={styles.help} open={showSteps}>')
    expect(coach).toContain('<RoleActionHome')
    expect(coach).toContain('roleLabel="Coach"')
    expect(league).toContain('<RoleActionHome')
    expect(league).toContain('roleLabel="League"')
  })

  it('keeps the mobile home compact and touch friendly', () => {
    expect(styles).toContain('@media (max-width: 760px)')
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(styles).toContain('min-height: 58px;')
    expect(styles).toContain('.primaryAction')
    expect(styles).toContain('width: 100%;')
  })

  it('opens setup only for first-time users', () => {
    expect(coach).toContain('showSteps={!savedStudents.length}')
    expect(league).toContain('showSteps={isFirstLeagueSetup}')
    expect(coach).toContain('contextValue={activeMobileBenchCard?.student.playerName')
    expect(league).toContain('contextValue={latestRecord?.leagueName')
    expect(league).toContain('{access.canUseLeagueTools ? (')
  })
})
