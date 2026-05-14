import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentSource = readFileSync(join(process.cwd(), 'app/components/match-accuracy-report-button.tsx'), 'utf8')
const mylabSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')
const playerProfileSource = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')
const teamProfileSource = readFileSync(join(process.cwd(), 'app/teams/[team]/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = componentSource.indexOf(`const ${styleName}`)
  expect(start, styleName).toBeGreaterThanOrEqual(0)
  const nextStyle = componentSource.indexOf('\nconst ', start + 1)
  return componentSource.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('match accuracy report button', () => {
  it('submits signed-in reports through the shared match accuracy helper', () => {
    expect(componentSource).toContain('submitMatchAccuracyReport')
    expect(componentSource).toContain('Report issue')
    expect(componentSource).toContain('Details for admins')
    expect(componentSource).toContain('Send report')
    expect(componentSource).toContain("description.trim().length < 8")
    expect(componentSource).toContain('onSubmitted?.()')
  })

  it('appears on My Lab linked-player recent matches with match context', () => {
    expect(mylabSource).toContain("import MatchAccuracyReportButton from '@/app/components/match-accuracy-report-button'")
    expect(mylabSource).toContain('<MatchAccuracyReportButton')
    expect(mylabSource).toContain("surface: 'mylab_recent_matches'")
    expect(mylabSource).toContain("linkedPlayerId: profileLink?.linked_player_id || ''")
    expect(mylabSource).toContain('reporterPlayerName={linkedPlayer?.name || profileLink?.linked_player_name || \'\'}')
    expect(mylabSource).toContain('myMatchReportByMatchId.get(match.id)')
    expect(mylabSource).toContain('onSubmitted={() => void refreshMyMatchReports()}')
    expect(mylabSource).toContain('const matchActionStackStyle')
  })

  it('appears on the signed-in player profile match history without widening the table', () => {
    expect(playerProfileSource).toContain("import MatchAccuracyReportButton from '@/app/components/match-accuracy-report-button'")
    expect(playerProfileSource).toContain(') : isOwnProfile ? (')
    expect(playerProfileSource).toContain('<MatchAccuracyReportButton')
    expect(playerProfileSource).toContain("surface: 'player_profile_match_history'")
    expect(playerProfileSource).toContain("linkedPlayerId: linkedPlayerId || ''")
    expect(playerProfileSource).toContain('myMatchReportByMatchId.get(match.id)')
    expect(playerProfileSource).toContain('onSubmitted={() => void refreshMyMatchReports()}')
    expect(playerProfileSource).toContain('reportStatusPillStyle(existingReport.status)')
    expect(playerProfileSource).toContain('const scoreCellStackStyle')
  })

  it('appears on team match history when the linked player is in parent or line data', () => {
    expect(teamProfileSource).toContain("import MatchAccuracyReportButton from '@/app/components/match-accuracy-report-button'")
    expect(teamProfileSource).toContain('parentMatchIdsWithLinkedPlayer')
    expect(teamProfileSource).toContain('parentExternalIdsWithLinkedPlayer')
    expect(teamProfileSource).toContain('linkedPlayerAppears: directParentMatch || lineMatch')
    expect(teamProfileSource).toContain("surface: 'team_match_history'")
    expect(teamProfileSource).toContain('reportSource: match.linkedPlayerReportSource')
    expect(teamProfileSource).toContain('myMatchReportByMatchId.get(match.id)')
    expect(teamProfileSource).toContain('onSubmitted={() => void refreshMyMatchReports()}')
    expect(teamProfileSource).toContain('reportStatusBadgeStyle(existingReport.status)')
  })

  it('keeps the match accuracy report dialog mobile-safe for long match labels', () => {
    for (const styleName of [
      'triggerStyle',
      'overlayStyle',
      'dialogStyle',
      'headerStyle',
      'selectStyle',
      'textareaStyle',
      'actionRowStyle',
      'primaryButtonStyle',
      'successStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain('minWidth')
    }

    for (const styleName of [
      'triggerStyle',
      'dialogStyle',
      'kickerStyle',
      'titleStyle',
      'copyStyle',
      'labelStyle',
      'primaryButtonStyle',
      'successStyle',
    ]) {
      expect(styleBlock(styleName), styleName).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock('headerStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('primaryButtonStyle')).toContain("whiteSpace: 'normal'")
    expect(styleBlock('triggerStyle')).toContain("maxWidth: '100%'")
  })
})
