import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sheet = readFileSync(join(process.cwd(), 'app', 'captain', 'matchup-sheet', 'page.tsx'), 'utf8')
const sheetStyles = readFileSync(join(process.cwd(), 'app', 'captain', 'matchup-sheet', 'matchup-sheet.module.css'), 'utf8')
const liveScorecard = readFileSync(join(process.cwd(), 'app', 'captain', 'record-result', 'page.tsx'), 'utf8')
const rosterRoute = readFileSync(join(process.cwd(), 'app', 'api', 'captain', 'lineup-builder', 'route.ts'), 'utf8')

describe('Captain live scorecard', () => {
  it('keeps the printed court focused on the line and score entry', () => {
    expect(sheet).toContain('<strong>{court.label || `Court ${index + 1}`}</strong>')
    expect(sheet).toContain('className={styles.opponentPlayerBlank}')
    expect(sheet).not.toContain('Write in after warm-up')
    expect(sheet).toContain('<span>W/L</span>')
    expect(sheetStyles).toContain('minmax(42px, .52fr)')
    expect(sheetStyles).toContain('.scoreGridHead > span:last-child { min-width: 42px;')
    expect(sheet).toContain('function createPrintableScorecard')
    expect(sheet).toContain('@page { size: letter portrait; margin: .25in; }')
    expect(sheet).toContain('const inkSafePrintStyle')
    expect(sheet).toContain('.courts { background: #fff !important; }')
    expect(sheet).toContain("const printWindow = window.open('', '_blank')")
    expect(sheet).toContain('printWindow.print()')
  })

  it('uses the approved TenAceIQ brand asset in the lineup image shared by text', () => {
    expect(sheet).toContain("loadCanvasImage('/brand/web/header-logo-transparent.png')")
    expect(sheet).toContain("loadCanvasImage('/brand/web/header-iq-compact.png')")
    expect(sheet).toContain("context.fillText('MATCH DAY  /  CAPTAIN SERIES'")
    expect(sheet).toContain("context.fillText('MATCH DETAILS'")
    expect(sheet).toContain("input.confirmed ? 'FINAL • CONFIRMED'")
    expect(sheet).toContain("input.confirmed ? 'CONFIRMED PAIR'")
    expect(sheet).toContain("context.fillText('MORE TENNIS. LESS CHAOS.'")
    expect(sheet).toContain('Team Chat: ${teamChatUrl}')
  })

  it('opens a live scorecard with suggested opponent names and score choices', () => {
    expect(sheet).toContain('Open live scorecard')
    expect(liveScorecard).toContain('Live scorecard')
    expect(liveScorecard).toContain('Choose a known opponent')
    expect(liveScorecard).toContain('Enter a different player')
    expect(liveScorecard).toContain('list="captain-score-options"')
    expect(liveScorecard).toContain('No opponent roster is connected yet. Type each opponent name.')
    expect(liveScorecard).toContain('Scan scorecard')
    expect(liveScorecard).toContain('Match details <span>Edit date, opponent, time, or location</span>')
    expect(liveScorecard).toContain('Text final result')
    expect(liveScorecard).toContain('navigator.share')
  })

  it('returns the opponent roster only through the authorized captain lineup response', () => {
    expect(rosterRoute).toContain('const opponentRosterNames')
    expect(rosterRoute).toContain('opponentRosterNames,')
    expect(rosterRoute).toContain(".eq('normalized_team_name', normalizeTeamName(opponentName))")
  })
})
