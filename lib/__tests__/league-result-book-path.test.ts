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
    expect(teamSource).toContain('aria-label="Team result command center"')
    expect(teamSource).toContain('Scorekeeper scan')
    expect(teamSource).toContain('aria-label="Team result readiness scan"')
    expect(teamSource).toContain('Scan the book, then open the smallest action that keeps standings moving.')
    expect(teamSource).toContain('data-team-result-path-job="next_best_action"')
    expect(teamSource).toContain('data-team-result-path-job="view_league"')
    expect(teamSource).toContain('data-team-result-path-job="set_up_league"')
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
    expect(playerSource).toContain('aria-label="Player result command center"')
    expect(playerSource).toContain('Result book scan')
    expect(playerSource).toContain('aria-label="Player result readiness scan"')
    expect(playerSource).toContain('Scan the book, then open the smallest action that keeps standings moving.')
    expect(playerSource).toContain('data-player-result-path-job="next_best_action"')
    expect(playerSource).toContain('data-player-result-path-job="view_league"')
    expect(playerSource).toContain('data-player-result-path-job="set_up_league"')
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
      expect(source).toContain("overflowWrap: 'anywhere'")
    }
    for (const source of [teamSource, playerSource]) {
      expect(source).toContain('resultPathCommandStyle')
      expect(source).toContain('resultPathStatusPanelStyle')
      expect(source).toContain('resultPathStatusGridStyle')
      expect(source).toContain('resultPathStatusItemStyle')
      expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))'")
      expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))'")
      expect(source).toContain('minHeight: 154')
    }
  })
})
