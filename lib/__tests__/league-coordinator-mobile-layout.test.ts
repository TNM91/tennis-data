import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'),
  'utf8',
)

describe('League Coordinator mobile layout guards', () => {
  it('stacks setup and action controls on mobile', () => {
    expect(source).toContain('responsiveHeroActionRowStyle')
    expect(source).toContain('responsiveButtonRowStyle')
    expect(source).toContain('responsiveParticipantBuilderStyle')
    expect(source).toContain('responsiveNextActionCardStyle')
    expect(source).toContain('responsiveNextActionButtonRowStyle')
    expect(source).toContain('mobileStackedActionRowStyle')
    expect(source).toContain('mobileParticipantBuilderStyle')
    expect(source).toContain('mobileNextActionCardStyle')
  })

  it('keeps the setup form Data Assist upload workflow visible', () => {
    expect(source).toContain('Upload data')
    expect(source).toContain('Use uploads as the coordinator refresh path.')
    expect(source).toContain('paste reviewed roster names from Data Assist')
    expect(source).not.toContain('USTA API')
  })

  it('keeps first-screen workflow guidance progressive and mobile-safe', () => {
    expect(source).toContain('COORDINATOR_OPERATING_FLOW')
    expect(source).toContain('Set structure')
    expect(source).toContain('Approve participants')
    expect(source).toContain('Publish schedule')
    expect(source).toContain('Review uploads and results')
    expect(source).toContain('operatingFlowGridStyle')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))'")
    expect(source).toContain("overflowWrap: 'anywhere'")
  })

  it('keeps scheduling and scoring rules explicit in setup', () => {
    expect(source).toContain('Standard Score')
    expect(source).toContain('Season guardrails')
    expect(source).toContain('League duration is capped')
    expect(source).toContain('TenAceIQ calculates the end date')
    expect(source).toContain('Full set or 10-point tiebreak')
    expect(source).toContain('10-point match tiebreak')
  })

  it('keeps coordinator and player scheduling handoff visible', () => {
    expect(source).toContain('getTiqLeagueSchedulingHandoffSummary')
    expect(source).toContain('Player-arranged scheduling preview')
    expect(source).toContain('Coordinator-published schedule preview')
    expect(source).toContain('Players confirm details before the result is logged')
    expect(source).toContain('Data Assist uploads can refresh changes after review')
  })
})
