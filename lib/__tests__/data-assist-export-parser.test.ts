import { describe, expect, it } from 'vitest'
import { parseTennisLinkExportFiles } from '../data-assist-export-parser'
import { buildScorecardOcrDraftFromText } from '../data-assist-ocr'
import { buildScheduleOcrDraftFromText } from '../data-assist-schedule-parser'
import { buildTeamSummaryOcrDraftFromText } from '../data-assist-team-summary-parser'

const screenshot = {
  fileName: 'export.xls',
  uploadOrder: 1,
  imageWidth: 0,
  imageHeight: 0,
  confidenceScore: 0.98,
  visualSignals: ['TennisLink Excel export'],
}

describe('parseTennisLinkExportFiles', () => {
  it('turns scorecard export rows into a scorecard draft', () => {
    const html = `
      <table>
        <tr><td>Scorecard for Match # 1011650664 in 2026 Adult 18 & Over Spring</td></tr>
        <tr><td></td><td>Schnellaveria (S) Team ID: *****</td><td></td><td>Vs.</td><td>Gontarz/Wild William's Wily Wolverines (S) Team ID: *****</td></tr>
        <tr><td>Date Scheduled: 1/18/2026 12:00 PM</td><td>Date Match Played: 1/18/2026</td></tr>
        <tr><td>1# Singles12:00 noon</td><td>Kevin Chen Completed</td><td><img id="ctl00_imgHomePlayer" /></td><td>Vs.</td><td>Ralf Nosic</td><td></td><td>6-2 6-1</td></tr>
        <tr><td>2# Singles12:00 noon</td><td>Zacharias Barringer Completed</td><td><img id="ctl01_imgHomePlayer" /></td><td>Vs.</td><td>Shawn Khosla</td><td></td><td>6-1 6-0</td></tr>
        <tr><td>1# Doubles12:00 noon</td><td>Neil Arora<br />Cyrus Mevorach Completed</td><td></td><td>Vs.</td><td>Stefan Nosic<br />Paul Gontarz</td><td><img id="ctl02_imgVisitorPlayer" /></td><td>7-6 6-1</td></tr>
        <tr><td>2# Doubles12:00 noon</td><td>William Hamilton<br />Eric Abramson Completed</td><td></td><td>Vs.</td><td>Edwin Ernst<br />Tony Richards</td><td><img id="ctl03_imgVisitorPlayer" /></td><td>5-7 6-4 1-0</td></tr>
        <tr><td>3# Doubles12:00 noon</td><td>Daniel Schneller<br />Conner Harrison Completed</td><td><img id="ctl04_imgHomePlayer" /></td><td>Vs.</td><td>Mark Sophir<br />Kevin Bayer</td><td></td><td>6-3 6-2</td></tr>
        <tr><td>TOTAL TEAM SCORE:</td></tr>
        <tr><td>Schnellaveria (S) (Home Team) 3 WINS Gontarz/Wild William's Wily Wolverines (S) (Visiting Team) 2 WINS</td></tr>
      </table>
    `
    const parsed = parseTennisLinkExportFiles([{ ...screenshot, fileBuffer: Buffer.from(html), mimeType: 'application/vnd.ms-excel' }])
    const draft = buildScorecardOcrDraftFromText(parsed.rawText, [screenshot], parsed.provider)

    expect(parsed.detectedImportType).toBe('scorecard')
    expect(draft.externalMatchId).toBe('1011650664')
    expect(draft.homeTeam).toBe('Schnellaveria (S)')
    expect(draft.awayTeam).toBe("Gontarz/Wild William's Wily Wolverines (S)")
    expect(draft.lineCount).toBe(5)
    expect(draft.lines[0]?.homePlayers.join(' ')).toContain('Kevin Chen')
    expect(draft.lines[0]?.winner).toBe('home')
    expect(draft.lines[2]?.awayPlayers.join(' ')).toContain('Paul Gontarz')
    expect(draft.lines[2]?.winner).toBe('away')
  })

  it('turns match schedule export rows into schedule matches', () => {
    const html = `
      <table>
        <tr><td>Flight</td><td>USTA Section</td><td>District/Area</td><td>League</td></tr>
        <tr><td>Men 4.5</td><td>USTA/MISSOURI VALLEY</td><td>ST. LOUIS</td><td>2026 Adult 18 & Over Spring</td></tr>
        <tr><td>Match ID</td><td>Schedule Date</td><td>Schedule Time</td><td>Home Team</td><td>Captain/Phone</td><td>Visiting Team</td><td>Captain/Phone</td><td>Facility/Match Site</td></tr>
        <tr><td>1011650664</td><td>1/18/2026</td><td>12:00 PM</td><td>Schnellaveria (S)</td><td></td><td>Gontarz/Wild William's Wily Wolverines (S)</td><td></td><td>Forest Lake Tennis Club</td></tr>
      </table>
    `
    const parsed = parseTennisLinkExportFiles([{ ...screenshot, fileBuffer: Buffer.from(html), mimeType: 'application/vnd.ms-excel' }])
    const draft = buildScheduleOcrDraftFromText(parsed.rawText, [screenshot], parsed.provider)

    expect(parsed.detectedImportType).toBe('schedule')
    expect(draft.matches[0]?.externalMatchId).toBe('1011650664')
    expect(draft.matches[0]?.facility).toBe('Forest Lake Tennis Club')
  })

  it('turns team summary export rows into roster players', () => {
    const html = `
      <table>
        <tr><td>Section</td><td>District/Area</td><td>League</td><td>Flight</td></tr>
        <tr><td>USTA/MISSOURI VALLEY</td><td>ST. LOUIS</td><td>2026 Adult 18 & Over Spring</td><td>Men 4.5</td></tr>
        <tr><td>Team Name</td><td>Wins*</td><td>Losses</td></tr>
        <tr><td>Meinert/The Other Guys (S)</td><td>5</td><td>10</td></tr>
        <tr><td>Player Name</td><td>NTRP</td><td>Player Name</td><td>NTRP</td></tr>
        <tr><td>Nathan Meinert</td><td>4.5</td><td>Connor Zielonko</td><td>4</td></tr>
      </table>
    `
    const parsed = parseTennisLinkExportFiles([{ ...screenshot, fileBuffer: Buffer.from(html), mimeType: 'application/vnd.ms-excel' }])
    const draft = buildTeamSummaryOcrDraftFromText(parsed.rawText, [screenshot], parsed.provider)

    expect(parsed.detectedImportType).toBe('team_summary')
    expect(draft.rosterTeamName).toBe('Meinert/The Other Guys (S)')
    expect(draft.players.map((player) => player.name)).toContain('Nathan Meinert')
    expect(draft.players.map((player) => player.name)).toContain('Connor Zielonko')
  })

  it('flags mixed export types without guessing the import type', () => {
    const scorecardHtml = '<table><tr><td>Scorecard for Match # 1011650664</td></tr></table>'
    const scheduleHtml = '<table><tr><td>Match Schedule by Flight Report</td></tr><tr><td>Match ID</td><td>Schedule Date</td><td>Schedule Time</td><td>Home Team</td><td></td><td>Visiting Team</td><td></td><td>Facility/Match Site</td></tr></table>'

    const parsed = parseTennisLinkExportFiles([
      { ...screenshot, uploadOrder: 1, fileName: 'Scorecard.xls', fileBuffer: Buffer.from(scorecardHtml), mimeType: 'application/vnd.ms-excel' },
      { ...screenshot, uploadOrder: 2, fileName: 'MatchSchedule.xls', fileBuffer: Buffer.from(scheduleHtml), mimeType: 'application/vnd.ms-excel' },
    ])

    expect(parsed.mixedImportTypes).toBe(true)
    expect(parsed.detectedImportType).toBeUndefined()
    expect(parsed.warnings).toContain('Multiple TennisLink export types were found. Upload one type at a time.')
  })
})
