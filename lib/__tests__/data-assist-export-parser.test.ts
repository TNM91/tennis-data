import { describe, expect, it } from 'vitest'
import { parseTennisLinkExportFiles } from '../data-assist-export-parser'
import { buildScorecardOcrDraftFromText } from '../data-assist-ocr'
import { buildDataAssistScorecardImportRow } from '../data-assist-import'
import { buildScorecardPlayerRatingSeedMap, inferPlayerBaselineFromRow } from '../ingestion/importEngine'
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

  it('keeps every tri-level court, player pair, and league identity from the export', () => {
    const html = `
      <table>
        <tr><td>Scorecard for Match # 1012101422 in 2026 STL Tri-Level 18 & Over</td></tr>
        <tr><td></td><td>Suddarth Team ID: *****</td><td></td><td>Vs.</td><td>SuperSmash Bros/Pottebaum-Meinart Team ID: *****</td></tr>
        <tr><td>Date Match Played: 8/3/2026</td></tr>
        <tr><td>4.5 Doubles #16:00 pm</td><td>John Schaefer<br />Sean Baldwin<br />Completed</td><td></td><td><font>Vs.<br></font></td><td>Brendan Czaicki<br />CHRISTOPHER KRIEGER</td><td><img id="ctl00_imgVisitorPlayer" /></td><td>6-2<br />7-5</td></tr>
        <tr><td>4.0 Doubles #26:00 pm</td><td>Matthew Suddarth<br />Max Trachtenberg<br />Completed</td><td><img id="ctl01_imgHomePlayer" /></td><td>Vs.</td><td>Joel Pottebaum<br />Diego Mateluna</td><td></td><td>6-3<br />6-2</td></tr>
        <tr><td>3.5 Doubles #36:00 pm</td><td>Anthony Trent<br />Kollin Kolb<br />Completed</td><td></td><td>Vs.</td><td>Miles Yetter<br />Sean Bracken</td><td><img id="ctl02_imgVisitorPlayer" /></td><td>7-5<br />7-5</td></tr>
      </table>
    `
    const parsed = parseTennisLinkExportFiles([{ ...screenshot, fileBuffer: Buffer.from(html), mimeType: 'application/vnd.ms-excel' }])
    const draft = buildScorecardOcrDraftFromText(parsed.rawText, [screenshot], parsed.provider)
    const preview = buildDataAssistScorecardImportRow(draft)

    expect(draft.leagueName).toBe('2026 STL Tri-Level 18 & Over')
    expect(draft.lines.map((line) => line.lineLabel)).toEqual(['1 Doubles', '2 Doubles', '3 Doubles'])
    expect(draft.lines.map((line) => line.ntrp)).toEqual([4.5, 4, 3.5])
    expect(draft.lines[0]?.homePlayers).toEqual(['John Schaefer', 'Sean Baldwin'])
    expect(draft.lines[1]?.winner).toBe('home')
    expect(draft.lines[2]?.awayPlayers).toEqual(['Miles Yetter', 'Sean Bracken'])
    expect(preview.row.leagueName).toBe('2026 STL Tri-Level 18 & Over')
    expect(preview.row.lines).toHaveLength(3)
    expect(preview.row.lines.map((line) => line.ntrp)).toEqual([4.5, 4, 3.5])
    expect(buildScorecardPlayerRatingSeedMap(preview.row)).toMatchObject({
      'john schaefer': 4.5,
      'brendan czaicki': 4.5,
      'matthew suddarth': 4,
      'joel pottebaum': 4,
      'anthony trent': 3.5,
      'miles yetter': 3.5,
    })
    expect(inferPlayerBaselineFromRow({ ...preview.row, flight: 'Men 3.5/4.0/4.5' })).toBeNull()
  })

  it('rejects conflicting official line ratings for the same player', () => {
    expect(() => buildScorecardPlayerRatingSeedMap({
      externalMatchId: 'conflicting-levels',
      matchDate: '2026-08-03',
      homeTeam: 'Home',
      awayTeam: 'Away',
      lines: [
        { lineNumber: 1, matchType: 'singles', ntrp: 4, sideAPlayers: ['Alex Player'], sideBPlayers: ['Jordan One'], winnerSide: 'A' },
        { lineNumber: 2, matchType: 'doubles', ntrp: 3.5, sideAPlayers: ['Alex Player', 'Jordan Two'], sideBPlayers: ['Casey One', 'Casey Two'], winnerSide: 'B' },
      ],
    })).toThrow('Conflicting official NTRP ratings for Alex Player: 4.0 and 3.5')
  })

  it('turns match schedule export rows into schedule matches', () => {
    const html = `
      <table>
        <tr><td>Section</td><td>District/Area</td><td>League</td><td>Flight</td></tr>
        <tr><td>USTA/MISSOURI VALLEY</td><td>ST. LOUIS - St. Louis Local Leagues</td><td>2026 STL Tri-Level 18 &amp; Over</td><td>Men 3.5/4.0/4.5</td></tr>
        <tr><td>Match ID</td><td>Schedule Date</td><td>Schedule Time</td><td>Home Team</td><td>Captain/Phone</td><td>Visiting Team</td><td>Captain/Phone</td><td>Facility/Match Site</td></tr>
        <tr><td>1012000001</td><td>8/3/2026</td><td>6:00 PM</td><td>SuperSmash Bros/Pottebaum-Meinart</td><td>Captain</td><td>Suddarth</td><td>Captain</td><td>Dwight Davis Tennis Center</td></tr>
        <tr><td>1012000002</td><td>8/10/2026</td><td>7:30 PM</td><td>Hamilton</td><td>Captain</td><td>SuperSmash Bros/Pottebaum-Meinart</td><td>Captain</td><td>Shaw Park</td></tr>
        <tr><td>1012000003</td><td>8/17/2026</td><td>6:00 PM</td><td>SuperSmash Bros/Pottebaum-Meinart</td><td>Captain</td><td>Gontarz</td><td>Captain</td><td>Dwight Davis Tennis Center</td></tr>
      </table>
    `
    const parsed = parseTennisLinkExportFiles([{ ...screenshot, fileBuffer: Buffer.from(html), mimeType: 'application/vnd.ms-excel' }])
    const draft = buildScheduleOcrDraftFromText(parsed.rawText, [screenshot], parsed.provider)

    expect(parsed.detectedImportType).toBe('schedule')
    expect(draft).toMatchObject({
      teamName: 'SuperSmash Bros/Pottebaum-Meinart',
      leagueName: '2026 STL Tri-Level 18 & Over',
      flight: 'Men 3.5/4.0/4.5',
      ustaSection: 'USTA/MISSOURI VALLEY',
      districtArea: 'ST. LOUIS - St. Louis Local Leagues',
      matchCount: 3,
    })
    expect(draft.matches[0]).toMatchObject({
      externalMatchId: '1012000001',
      homeTeam: 'SuperSmash Bros/Pottebaum-Meinart',
      awayTeam: 'Suddarth',
      facility: 'Dwight Davis Tennis Center',
      reviewNotes: [],
    })
    expect(draft.matches[1]).toMatchObject({
      homeTeam: 'Hamilton',
      awayTeam: 'SuperSmash Bros/Pottebaum-Meinart',
      facility: 'Shaw Park',
    })
  })

  it('turns team summary export rows into roster players', () => {
    const html = `
      <table>
        <tr><td>Section</td><td>District/Area</td><td>League</td><td>Flight</td></tr>
        <tr><td>USTA/MISSOURI VALLEY</td><td>ST. LOUIS</td><td>2026 Adult 18 & Over Spring</td><td>Men 4.5</td></tr>
        <tr><td>Captain</td><td>Co-Captain</td><td>League Date</td></tr>
        <tr><td>Nathan Meinert 314-555-0100</td><td>David Cabrera 314-555-0101</td><td>01/01/2026 - 04/01/2026</td></tr>
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
    expect(draft.leagueName).toBe('2026 Adult 18 & Over Spring')
    expect(draft.flight).toBe('Men 4.5')
    expect(draft.teams).toEqual([{ name: 'Meinert/The Other Guys (S)', wins: 5, losses: 10 }])
    expect(draft.players.map((player) => player.name)).toContain('Nathan Meinert')
    expect(draft.players.map((player) => player.name)).toContain('Connor Zielonko')
  })

  it('turns a Player Roster export into players, ratings, and private captain contacts', () => {
    const html = `
      <table>
        <tr><td>Team Name</td><td>Team Number</td><td>Season Start</td><td>No. Players</td></tr>
        <tr><td>Example Aces</td><td>123456789</td><td>8/1/2026</td><td>2</td></tr>
        <tr><td>USTA Section</td><td>USTA District</td><td>Local League / League Type</td><td>Team NTRP/Gender</td><td>Flight Name</td></tr>
        <tr><td>USTA/MISSOURI VALLEY</td><td>ST. LOUIS</td><td>2026 STL Tri-Level 18 &amp; Over</td><td>Men</td><td>Men 3.5/4.0/4.5</td></tr>
        <tr><td>Captain Name</td><td>Captain Phone</td><td>Captain E-Mail Address</td></tr>
        <tr><td>Alex Captain</td><td>314-555-0100</td><td>alex@example.com</td></tr>
        <tr><td>Casey Partner</td><td>314-555-0101</td><td>casey@example.com</td></tr>
        <tr><td>Usta#</td><td>Expiry Date</td><td>Player</td><td>Phone no</td><td>Email Address</td><td>NTRP/Rating Date</td><td>Local Matches Played</td><td>Champ Matches Played</td><td>Total Matches Played</td><td>Local Wins by Default</td><td>Champ Wins by Default</td><td>Total Wins by Default</td></tr>
        <tr><td>1112223334</td><td>12/31/2026</td><td>Alex Captain</td><td>314-555-0100</td><td>alex@example.com</td><td>4.5 / 12/31/2025</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
        <tr><td>2223334445</td><td>12/31/2026</td><td>Casey Partner</td><td>314-555-0101</td><td>casey@example.com</td><td>3.5 / 12/31/2025</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
      </table>
    `
    const parsed = parseTennisLinkExportFiles([{ ...screenshot, fileName: 'PlayerRoster_812026.xls', fileBuffer: Buffer.from(html), mimeType: 'application/vnd.ms-excel' }])
    const draft = buildTeamSummaryOcrDraftFromText(parsed.rawText, [screenshot], parsed.provider)

    expect(parsed.detectedImportType).toBe('team_summary')
    expect(draft).toMatchObject({
      rosterSource: 'player_roster',
      rosterTeamName: 'Example Aces',
      leagueName: '2026 STL Tri-Level 18 & Over',
      flight: 'Men 3.5/4.0/4.5',
      playerCount: 2,
      contactCount: 2,
    })
    expect(draft.players).toEqual([
      expect.objectContaining({ name: 'Alex Captain', ntrp: 4.5, phone: '314-555-0100', email: 'alex@example.com', ratingSource: 'verified', mixedPairRole: 'man', ageDivision: '18 & Over' }),
      expect.objectContaining({ name: 'Casey Partner', ntrp: 3.5, phone: '314-555-0101', email: 'casey@example.com', ratingSource: 'verified', mixedPairRole: 'man', ageDivision: '18 & Over' }),
    ])
    expect(draft.contacts).toEqual([
      expect.objectContaining({ name: 'Alex Captain', role: 'Captain', isCaptain: true }),
      expect.objectContaining({ name: 'Casey Partner', role: 'Co-Captain', isCaptain: true }),
    ])
    expect(draft.teams).toEqual([])
  })

  it('links a Tri-Level Team Summary to the captain team named in standings', () => {
    const html = `
      <table>
        <tr><td>Section</td><td>District/Area</td><td>League</td><td>Flight</td></tr>
        <tr><td>USTA/MISSOURI VALLEY</td><td>ST. LOUIS - St. Louis Local Leagues</td><td>2026 STL Tri-Level 18 &amp; Over</td><td>Men 3.5/4.0/4.5</td></tr>
        <tr><td>Captain</td><td>Co-Captain</td><td>League Date</td></tr>
        <tr><td>Joel Pottebaum 636-555-0100</td><td>Nathan Meinert 636-555-0101</td><td>08/03/2026 - 10/05/2026</td></tr>
        <tr><td>Team Name</td><td>Wins*</td><td>Losses</td><td>Indiv. Wins</td></tr>
        <tr><td>Hamilton</td><td>0</td><td>0</td><td>0</td></tr>
        <tr><td>Gontarz</td><td>0</td><td>0</td><td>0</td></tr>
        <tr><td>SuperSmash Bros/Pottebaum-Meinart</td><td>0</td><td>0</td><td>0</td></tr>
        <tr><td>Suddarth</td><td>0</td><td>0</td><td>0</td></tr>
        <tr><td>Players</td></tr>
        <tr><td>Player Name</td><td>NTRP</td><td>Player Name</td><td>NTRP</td></tr>
        <tr><td>Joel Pottebaum</td><td>4</td><td>Miles Yetter</td><td>3.5</td></tr>
        <tr><td>Nathan Meinert</td><td>4.5</td><td>Sam Edwards</td><td>4</td></tr>
      </table>
    `
    const parsed = parseTennisLinkExportFiles([{ ...screenshot, fileBuffer: Buffer.from(html), mimeType: 'application/vnd.ms-excel' }])
    const draft = buildTeamSummaryOcrDraftFromText(parsed.rawText, [screenshot], parsed.provider)

    expect(draft).toMatchObject({
      rosterTeamName: 'SuperSmash Bros/Pottebaum-Meinart',
      leagueName: '2026 STL Tri-Level 18 & Over',
      flight: 'Men 3.5/4.0/4.5',
      playerCount: 4,
      teamCount: 4,
    })
    expect(draft.players.every((player) => player.teamName === 'SuperSmash Bros/Pottebaum-Meinart')).toBe(true)
    expect(draft.parserWarnings).toEqual([])
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
