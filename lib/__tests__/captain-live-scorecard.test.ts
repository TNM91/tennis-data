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
    expect(sheet).toContain('const premiumPrintStyle')
    expect(sheet).toContain('/brand/logos/tenaceiq-full-for-light-bg.png')
    expect(sheet).toContain('.sheet { width: 100%; min-height: 0; display: block;')
    expect(sheet).toContain('printWindow.document.images')
    expect(sheet).toContain('${premiumPrintStyle}</head>')
    expect(sheet).toContain('Team rosters')
    expect(sheet).toContain('border-left: 6px solid #9be11d')
    expect(sheet).toContain("const printWindow = window.open('', '_blank')")
    expect(sheet).toContain('printWindow.print()')
  })

  it('prints connected registered rosters together with the courts', () => {
    expect(sheet).toContain('payload.rosterMembers || []')
    expect(sheet).toContain('payload.opponentRosterNames || []')
    expect(sheet).toContain('Include both team rosters on the scorecard')
    expect(sheet).toContain('${rosterReference}</main>')
    expect(sheet).not.toContain('page-break-before: always')
    expect(liveScorecard).toContain('Finalize & save to TiQ')
    expect(liveScorecard).toContain('completedCourtCount !== courts.length')
  })

  it('uses the approved TenAceIQ brand asset in the lineup image shared by text', () => {
    expect(sheet).toContain("loadCanvasImage('/brand/web/header-logo-transparent.png')")
    expect(sheet).toContain("loadCanvasImage('/brand/web/header-iq-compact.png')")
    expect(sheet).toContain("context.fillText('MATCH DAY  /  CAPTAIN SERIES'")
    expect(sheet).toContain("context.fillText('MATCH DETAILS'")
    expect(sheet).toContain("input.confirmed ? 'FINAL • CONFIRMED'")
    expect(sheet).toContain("input.confirmed ? 'CONFIRMED PAIR'")
    expect(sheet).toContain("context.fillText('MORE TENNIS. LESS CHAOS.'")
    expect(sheet).toContain("const lineupLabel = confirmedLineup ? 'Confirmed lineup' : 'Projected lineup'")
    expect(sheet).toContain('Open ${lineupLabel.toLowerCase()}: ${shareUrl}')
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

  it('keeps match-day entry focused on one compact court at a time', () => {
    expect(liveScorecard).toContain('const [openCourtId, setOpenCourtId] = useState<string | null | undefined>(undefined)')
    expect(liveScorecard).toContain('Enter one court at a time.')
    expect(liveScorecard).toContain('ready to submit')
    expect(liveScorecard).toContain('aria-expanded={isOpen}')
    expect(liveScorecard).toContain("{isOpen ? 'Done for now' : 'Enter result'}")
    expect(liveScorecard).toContain('function isCourtEntryComplete(court: CourtDraft)')
  })

  it('recovers an in-progress scorecard on the same device and clears it after save', () => {
    expect(liveScorecard).toContain('function buildScorecardDraftStorageKey(input:')
    expect(liveScorecard).toContain('function isStoredScorecardDraft(value: unknown): value is StoredScorecardDraft')
    expect(liveScorecard).toContain("setNotice('Your in-progress scorecard was restored on this device.')")
    expect(liveScorecard).toContain('window.localStorage.setItem(scorecardDraftStorageKey, JSON.stringify(draft))')
    expect(liveScorecard).toContain('window.localStorage.removeItem(scorecardDraftStorageKey)')
    expect(liveScorecard).toContain('Draft saved on this device')
  })

  it('returns the opponent roster only through the authorized captain lineup response', () => {
    expect(rosterRoute).toContain('const opponentRosterNames')
    expect(rosterRoute).toContain('opponentRosterNames,')
    expect(rosterRoute).toContain(".eq('normalized_team_name', normalizeTeamName(opponentName))")
  })
})
