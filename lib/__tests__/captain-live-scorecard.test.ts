import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sheet = readFileSync(join(process.cwd(), 'app', 'captain', 'matchup-sheet', 'page.tsx'), 'utf8')
const liveScorecard = readFileSync(join(process.cwd(), 'app', 'captain', 'record-result', 'page.tsx'), 'utf8')
const rosterRoute = readFileSync(join(process.cwd(), 'app', 'api', 'captain', 'lineup-builder', 'route.ts'), 'utf8')

describe('Captain live scorecard', () => {
  it('keeps the printed court focused on the line and score entry', () => {
    expect(sheet).toContain('<strong>{court.label || `Court ${index + 1}`}</strong>')
    expect(sheet).toContain('className={styles.opponentPlayerBlank}')
    expect(sheet).not.toContain('Write in after warm-up')
  })

  it('opens a live scorecard with suggested opponent names and score choices', () => {
    expect(sheet).toContain('Open live scorecard')
    expect(liveScorecard).toContain('Live scorecard')
    expect(liveScorecard).toContain('list="captain-opponent-roster"')
    expect(liveScorecard).toContain('list="captain-score-options"')
    expect(liveScorecard).toContain('Known opponent roster available — or type an unlisted player.')
  })

  it('returns the opponent roster only through the authorized captain lineup response', () => {
    expect(rosterRoute).toContain('const opponentRosterNames')
    expect(rosterRoute).toContain('opponentRosterNames,')
    expect(rosterRoute).toContain(".eq('normalized_team_name', normalizeTeamName(opponentName))")
  })
})
