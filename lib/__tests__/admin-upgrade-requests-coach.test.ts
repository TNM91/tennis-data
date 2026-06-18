import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/admin/upgrade-requests/page.tsx'), 'utf8')

describe('admin upgrade request Coach queue support', () => {
  it('keeps Coach and Full-Court visible in request metrics, filters, and activation cues', () => {
    expect(source).toContain("type StatusFilter = 'all' | 'player_plus' | 'coach' | 'captain' | 'league' | 'full_court'")
    expect(source).toContain("request.planId === 'coach'")
    expect(source).toContain("request.planId === 'full_court'")
    expect(source).toContain('<Metric label="Coach" value={String(coachCount)} />')
    expect(source).toContain('<Metric label="Full-Court" value={String(fullCourtCount)} />')
    expect(source).toContain("['coach', 'Coach']")
    expect(source).toContain("['full_court', 'Full-Court']")
    expect(source).toContain("'Coach Hub'")
    expect(source).toContain("'Team Hub'")
    expect(source).toContain("'League Office'")
    expect(source).toContain("const playerTier = getMembershipTier('player_plus')")
    expect(source).toContain('`Coach activation includes ${playerTier.name} access plus coach-player planning and follow-through.`')
    expect(source).not.toContain("'Coach workspace'")
    expect(source).not.toContain("'Captain workflow'")
    expect(source).not.toContain("'Coordinator tools'")
    expect(source).not.toContain('Coach activation includes Player+ access plus coach-player planning and follow-through.')
    expect(source).toContain("'Full-Court activation unlocks every current paid workspace for the account.'")
  })
})
