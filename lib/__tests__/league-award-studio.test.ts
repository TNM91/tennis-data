import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('league award studio', () => {
  it('connects league standings to award certificates and trophy cases', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'), 'utf8')

    expect(source).toContain('League award studio')
    expect(source).toContain('buildTiqLeagueAwardCandidates')
    expect(source).toContain('issueLeagueAward')
    expect(source).toContain("sourceType: 'league'")
    expect(source).toContain('Create award')
    expect(source).toContain('/awards/')
    expect(source).toContain('buildLeagueAwardMailto')
    expect(source).toContain('buildTiqAwardCertificateText')
    expect(source).toContain('Email</GhostLink>')
    expect(source).toContain('#profile-trophy-case')
    expect(source).toContain('leagueAwardCandidateStyle')
  })
})
