import { describe, expect, it } from 'vitest'
import { normalizeOcrText, parseDataAssistScorecardText } from '../data-assist-scorecard-parser'

describe('Data Assist scorecard OCR text parser', () => {
  it('extracts core scorecard fields from labeled TennisLink-style text', () => {
    const parsed = parseDataAssistScorecardText(`
      TennisLink Scorecard
      Match ID: USTA-123456789
      Match Date: 04/12/2026
      Home Team: Dallas Indoor Aces
      Away Team: Plano Net Rush

      1D John Smith / Bob Lee def. Adam Roe / Tim Fox 6-4 6-3
      2D Mary Lane / Sara Cross defeated Kim North / Ana West 7-6(4) 6-2
      1S Jane Ace def. Molly Baseline 6-1 6-0
    `)

    expect(parsed.externalMatchId).toBe('USTA-123456789')
    expect(parsed.matchDate).toBe('04/12/2026')
    expect(parsed.homeTeam).toBe('Dallas Indoor Aces')
    expect(parsed.awayTeam).toBe('Plano Net Rush')
    expect(parsed.lineCount).toBe(3)
    expect(parsed.lines[0]).toMatchObject({
      lineLabel: '1 Doubles',
      homePlayers: ['John Smith', 'Bob Lee'],
      awayPlayers: ['Adam Roe', 'Tim Fox'],
      score: '6-4 6-3',
      winner: 'home',
    })
    expect(parsed.lines[1].score).toBe('7-6(4) 6-2')
    expect(parsed.lines[1].sets).toEqual([
      { homeGames: 7, awayGames: 6, tiebreak: 4 },
      { homeGames: 6, awayGames: 2 },
    ])
    expect(parsed.lines[1].setWinnerSide).toBe('home')
    expect(parsed.confidenceScore).toBeGreaterThanOrEqual(0.85)
    expect(parsed.parserWarnings).toEqual([])
  })

  it('supports matchup-line team detection and away winner wording', () => {
    const parsed = parseDataAssistScorecardText(`
      TennisLink Match # TX99887766
      Played: April 18, 2026
      Lakewood Blue vs Oak Creek Green
      Court 1 Singles Alex Home lost to Ryan Away 4-6 2-6
      Court 2 Doubles Home One & Home Two d. Away One & Away Two 6-4 7-5
    `)

    expect(parsed.externalMatchId).toBe('TX99887766')
    expect(parsed.matchDate).toBe('April 18, 2026')
    expect(parsed.homeTeam).toBe('Lakewood Blue')
    expect(parsed.awayTeam).toBe('Oak Creek Green')
    expect(parsed.lines[0]).toMatchObject({
      lineLabel: '1 Singles',
      homePlayers: ['Alex Home'],
      awayPlayers: ['Ryan Away'],
      winner: 'away',
    })
    expect(parsed.lines[1].lineLabel).toBe('2 Doubles')
  })

  it('parses TennisLink table-style scorecard rows without def wording', () => {
    const parsed = parseDataAssistScorecardText(`
      Scorecard for Match # 1011650664 in 2026 Adult 18 & Over Spring
      Schnellaveria (S) Vs. Gontarz/Wild William's Wily Wolverines (S)
      Date Scheduled: 1/18/2026 12:00 PM
      Date Match Played: 1/18/2026
      1# Singles 12:00 noon Kevin Chen Completed Vs. Ralf Nosic Winner marker: home 6-2 6-1
      2# Singles 12:00 noon Zachanas Barringer Completed Vs. Shawn Khosla 6-1 6-0
      1# Doubles 12:00 noon Neil Arora / Cyrus Mevorach Completed Vs. Stefan Nosic / Paul Gontarz Winner marker: away 7-6 6-1
    `)

    expect(parsed.externalMatchId).toBe('1011650664')
    expect(parsed.matchDate).toBe('1/18/2026')
    expect(parsed.homeTeam).toBe('Schnellaveria (S)')
    expect(parsed.awayTeam).toBe("Gontarz/Wild William's Wily Wolverines (S)")
    expect(parsed.lineCount).toBe(3)
    expect(parsed.lines[0]).toMatchObject({
      lineLabel: '1 Singles',
      homePlayers: ['Kevin Chen'],
      awayPlayers: ['Ralf Nosic'],
      score: '6-2 6-1',
      winner: 'home',
      winnerSource: 'dom_marker',
    })
    expect(parsed.lines[2].homePlayers).toEqual(['Neil Arora', 'Cyrus Mevorach'])
    expect(parsed.lines[2]).toMatchObject({
      winner: 'away',
      winnerSource: 'dom_marker',
    })
    expect(parsed.lines[2].sets).toEqual([
      { homeGames: 7, awayGames: 6 },
      { homeGames: 6, awayGames: 1 },
    ])
  })

  it('recovers match identity and review rows from full-page TennisLink screenshot OCR', () => {
    const parsed = parseDataAssistScorecardText(`
      Scorecard for Match # 1011650664 in 2026 Adult 18 & Over Spring
      Status: Confimed by 48 hr le Today's Date: 05/07/2026 7:32 PMEST
      Gontarzila Willams Wily
      Schnellaveria (5)
      ve
      Wolverines (5)
      Team 1D:
      Team ID: +r
      Date Scheduled: 1118/2026 12:00 PM
      Date Match Played: 1182026
      Entry Date: 1192026
      Match Win Criteria: Team Wins
      Home Team
      Visiting Team
      3 Set Tie-break
      Kev Chen
      18 Singles
      Vs.
      Raff Nosic
      52
      1200 noon
      Completed
      51
      Zacharias Baringer
      2 Singles
      Shave Khosla
      51
      1200 noon
      Vs.
      Completed
      18 Doues.
      Nel Arora
      Stefan Nosic
      6
      1200 noon
      Cyrus Mevorach
      Vs.
      Paul Gontarz
      51
      Completed
      26 Doubles
      Wiliam Hamdion
      Edun Ema
      57
      Eric Abramson
      Vs.
      1200 noon
      Completed
      Tony Richards
      10
      Daniel Schneller
      3# Doubles
      Conner Hartson
      Vs.
      Mark Soph
      63
      1200 noon
      Kevin B
      62
      Completed
      TOTAL TEAM SCORE
      Schnellaveria (S) (Home Team) 3 WINS.
      Gontarz/Wild Willan's Wily Wolverines (5) (Visting
      am) 2 WINS
    `)

    expect(parsed.externalMatchId).toBe('1011650664')
    expect(parsed.matchDate).toBe('1/18/2026')
    expect(parsed.homeTeam).toBe('Schnellaveria (S)')
    expect(parsed.awayTeam).toContain('Gontarz/Wild')
    expect(parsed.lineCount).toBe(5)
    expect(parsed.lines[0]).toMatchObject({
      lineLabel: '1 Singles',
      homePlayers: ['Kev Chen'],
      awayPlayers: ['Raff Nosic'],
      score: '6-2 6-1',
    })
    expect(parsed.parserWarnings).not.toContain('No scorecard lines parsed.')
  })

  it('returns warnings and low confidence for incomplete OCR text', () => {
    const parsed = parseDataAssistScorecardText(`
      blurry screenshot
      Dallas players
      6-4 6-3
    `)

    expect(parsed.lineCount).toBe(0)
    expect(parsed.confidenceScore).toBeLessThan(0.4)
    expect(parsed.parserWarnings).toContain('Missing TennisLink match id.')
    expect(parsed.parserWarnings).toContain('No scorecard lines parsed.')
  })

  it('normalizes OCR whitespace without changing meaningful line order', () => {
    expect(normalizeOcrText('  A   B\r\n\r\n\r\nC  ')).toBe('A B\n\nC')
  })
})
