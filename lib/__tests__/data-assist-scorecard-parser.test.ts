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
