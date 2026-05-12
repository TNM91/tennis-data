import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentSource = readFileSync(join(process.cwd(), 'app/components/match-accuracy-report-button.tsx'), 'utf8')
const mylabSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

describe('match accuracy report button', () => {
  it('submits signed-in reports through the shared match accuracy helper', () => {
    expect(componentSource).toContain('submitMatchAccuracyReport')
    expect(componentSource).toContain('Report issue')
    expect(componentSource).toContain('Details for admins')
    expect(componentSource).toContain('Send report')
    expect(componentSource).toContain("description.trim().length < 8")
  })

  it('appears on My Lab linked-player recent matches with match context', () => {
    expect(mylabSource).toContain("import MatchAccuracyReportButton from '@/app/components/match-accuracy-report-button'")
    expect(mylabSource).toContain('<MatchAccuracyReportButton')
    expect(mylabSource).toContain("surface: 'mylab_recent_matches'")
    expect(mylabSource).toContain("linkedPlayerId: profileLink?.linked_player_id || ''")
    expect(mylabSource).toContain('reporterPlayerName={linkedPlayer?.name || profileLink?.linked_player_name || \'\'}')
  })
})
