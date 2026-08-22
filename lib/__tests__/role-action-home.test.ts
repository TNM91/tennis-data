import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const component = readFileSync(join(process.cwd(), 'app/components/role-action-home.tsx'), 'utf8')
const styles = readFileSync(join(process.cwd(), 'app/components/role-action-home.module.css'), 'utf8')
const coach = readFileSync(join(process.cwd(), 'app/coach/page.tsx'), 'utf8')
const league = readFileSync(join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'), 'utf8')
const improve = readFileSync(join(process.cwd(), 'app/player-development/_components/improve-landing-hub.tsx'), 'utf8')
const compete = readFileSync(join(process.cwd(), 'app/compete/page.tsx'), 'utf8')
const competeHome = readFileSync(join(process.cwd(), 'app/compete/_components/compete-home.tsx'), 'utf8')

describe('role action home', () => {
  it('gives the main action lanes the same task-first entry pattern', () => {
    expect(component).toContain('What do you need to do?')
    expect(component).toContain('primaryAction')
    expect(component).toContain('quickActions.slice(0, 4)')
    expect(component).toContain('<details className={styles.help} open={showSteps}>')
    expect(coach).toContain('<RoleActionHome')
    expect(coach).toContain('roleLabel="Coach"')
    expect(league).toContain('<RoleActionHome')
    expect(league).toContain('roleLabel="League"')
    expect(improve).toContain('<RoleActionHome')
    expect(improve).toContain('roleLabel="Improve"')
    expect(competeHome).toContain('<RoleActionHome')
    expect(competeHome).toContain('roleLabel="Compete"')
    expect(compete).toContain('compactHome')
    expect(compete).toContain('More Compete tools')
    expect(component).toContain('parseRoleHomeResumeSnapshot')
    expect(component).toContain('writeRoleHomeResume')
    expect(component).toContain("label: 'Continue'")
    expect(coach).toContain('resumeKey={userId ? `coach:${userId}` : undefined}')
    expect(league).toContain('resumeKey={userId ? `league:${userId}` : undefined}')
    expect(improve).toContain('resumeKey={userId ? `improve:${userId}` : \'improve\'}')
    expect(competeHome).toContain('resumeKey={userId ? `compete:${userId}` : \'compete\'}')
  })

  it('keeps the mobile home compact and touch friendly', () => {
    expect(styles).toContain('@media (max-width: 760px)')
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
    expect(styles).toContain('min-height: 58px;')
    expect(styles).toContain('.primaryAction')
    expect(styles).toContain('width: 100%;')
    expect(styles).toContain('linear-gradient(135deg, var(--brand-green), var(--brand-green-3))')
    expect(styles).not.toContain('var(--brand-lime)')
  })

  it('opens setup only for first-time users', () => {
    expect(coach).toContain('showSteps={!savedStudents.length}')
    expect(league).toContain('showSteps={isFirstLeagueSetup}')
    expect(coach).toContain('contextValue={activeMobileBenchCard?.student.playerName')
    expect(league).toContain('contextValue={coordinatorResumeLeague?.leagueName || latestRecord?.leagueName')
    expect(league).toContain('{canUseLeagueTools ? (')
  })

  it('keeps public Compete discovery useful while reserving lineup work for Captain', () => {
    expect(competeHome).toContain("title: 'See rankings'")
    expect(competeHome).toContain("title: 'Unlock Captain'")
    expect(competeHome).toContain("title: 'Build lineup'")
    expect(competeHome).toContain('access.canUseCaptainWorkflow')
    expect(competeHome).toContain("href: '/pricing'")
  })
})
