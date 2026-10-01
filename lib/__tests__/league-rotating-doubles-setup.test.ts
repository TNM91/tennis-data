import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('rotating-partner doubles league setup', () => {
  it('offers the format directly and applies its compatible league settings', () => {
    const source = read('app/components/league-coordinator-workspace.tsx')

    expect(source).toContain('ROTATING_PARTNER_DOUBLES_COMPETITION_FORMAT')
    expect(source).toContain("leagueFormat: enabled ? 'individual' : current.leagueFormat")
    expect(source).toContain("scoringSystem: rotatingPartnerDoubles ? 'standard' : current.scoringSystem")
    expect(source).toContain("schedulingMode: rotatingPartnerDoubles ? 'coordinator_fixed' : current.schedulingMode")
    expect(source).toContain('Third-set rule does not apply. These are three separate rotating-partner sets.')
  })

  it('does not publish best-of-three or third-set rules for weekly rotations', () => {
    const publicLeagueSource = read('app/explore/leagues/tiq/[league]/page.tsx')

    expect(publicLeagueSource).toContain('ROTATING_PARTNER_DOUBLES_FORMAT.label')
    expect(publicLeagueSource).toContain("Third-set rule does not apply because each rotation is a separate set.")
    expect(publicLeagueSource).toContain('league.weeklySettings.enabled')
  })
})
