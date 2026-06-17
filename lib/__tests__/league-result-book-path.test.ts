import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const teamSource = readFileSync(join(process.cwd(), 'app/components/team-league-results-workspace.tsx'), 'utf8')
const playerSource = readFileSync(join(process.cwd(), 'app/components/individual-league-results-workspace.tsx'), 'utf8')

describe('League result book paths', () => {
  it('gives Team Results a clear first-action path', () => {
    expect(teamSource).toContain("import { PRODUCT_MOTTO } from '@/lib/product-story'")
    expect(teamSource).toContain('Team Results path')
    expect(teamSource).toContain('id="team-result-path-title"')
    expect(teamSource).toContain('What result needs to be entered first?')
    expect(teamSource).toContain('What needs attention?')
    expect(teamSource).toContain('How do I avoid retyping scores?')
    expect(teamSource).toContain('data-team-result-path-job="add_match"')
    expect(teamSource).toContain('data-team-result-path-job="review_matches"')
    expect(teamSource).toContain('data-team-result-path-job="upload_scorecard"')
    expect(teamSource).toContain('onClick={handleOpenTeamMatchEntry}')
    expect(teamSource).toContain('href="#team-match-review"')
    expect(teamSource).toContain('href={dataAssistTeamResultsHref}')
  })

  it('gives Player Results a clear first-action path', () => {
    expect(playerSource).toContain("import { PRODUCT_MOTTO } from '@/lib/product-story'")
    expect(playerSource).toContain('Player Results path')
    expect(playerSource).toContain('id="player-result-path-title"')
    expect(playerSource).toContain('What result needs to be entered first?')
    expect(playerSource).toContain('What changed?')
    expect(playerSource).toContain('How do I avoid retyping scores?')
    expect(playerSource).toContain('data-player-result-path-job="log_result"')
    expect(playerSource).toContain('data-player-result-path-job="review_standings"')
    expect(playerSource).toContain('data-player-result-path-job="upload_scorecard"')
    expect(playerSource).toContain('handleUsePairing(nextPairing[0], nextPairing[1]) : handleOpenPlayerResultEntry()')
    expect(playerSource).toContain('href="#player-result-review"')
    expect(playerSource).toContain('href={dataAssistIndividualResultsHref}')
  })

  it('keeps result path cards tappable on mobile', () => {
    for (const source of [teamSource, playerSource]) {
      expect(source).toContain('resultPathStyle')
      expect(source).toContain('resultPathGrid')
      expect(source).toContain('resultPathButton')
      expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))'")
      expect(source).toContain('minHeight: 142')
      expect(source).toContain("overflowWrap: 'anywhere'")
    }
  })
})
