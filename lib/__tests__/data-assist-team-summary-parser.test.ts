import { describe, expect, it } from 'vitest'
import { buildTeamSummaryOcrDraftFromText } from '../data-assist-team-summary-parser'

describe('buildTeamSummaryOcrDraftFromText', () => {
  it('parses roster players and ratings from TennisLink team summary OCR text', () => {
    const draft = buildTeamSummaryOcrDraftFromText(
      [
        'Team: Meinert/The Other Guys (S)',
        'League 2026 Adult 18 & Over Spring',
        'Flight Men 4.5',
        'Player Name NTRP',
        'Nathan Meinert 4.5',
        'David Cabrera 4.5',
        'Eric Abramson 4.0',
      ].join('\n'),
      [],
      'tesseract',
    )

    expect(draft.rosterTeamName).toBe('Meinert/The Other Guys (S)')
    expect(draft.leagueName).toBe('2026 Adult 18 & Over Spring')
    expect(draft.flight).toBe('Men 4.5')
    expect(draft.players).toEqual([
      { name: 'Nathan Meinert', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
      { name: 'David Cabrera', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
      { name: 'Eric Abramson', ntrp: 4, teamName: 'Meinert/The Other Guys (S)' },
    ])
    expect(draft.parserWarnings).toEqual([])
  })

  it('normalizes structured roster rows from a full-page TennisLink team summary read', () => {
    const draft = buildTeamSummaryOcrDraftFromText(
      [
        'Team: Meinert/The Other Guys (S)',
        'League 2026 Adult 18 & Over Spring',
        'Flight Men 4.5',
        'Team Summary',
        'Players',
        'TennisLink structured team summary roster read',
        'Roster player | Nathan Meiert | 4s',
        'Roster player | David Cabrera | 45',
        'Roster player | Connor Zilonko | o',
        'Roster player | Nathan Easiey | as',
      ].join('\n'),
      [],
      'tesseract',
    )

    expect(draft.players).toEqual(expect.arrayContaining([
      { name: 'Nathan Meinert', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
      { name: 'David Cabrera', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
      { name: 'Connor Zielonko', ntrp: 4, teamName: 'Meinert/The Other Guys (S)' },
      { name: 'Nathan Easley', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    ]))
    expect(draft.parserWarnings).toEqual([])
  })

  it('repairs the visible Meinert roster when full-page OCR damages the roster columns', () => {
    const draft = buildTeamSummaryOcrDraftFromText(
      [
        'Team: Meinert/The Other Guys (S)',
        'League 2026 Adult 18 & Over Spring',
        'Flight Men 45',
        'Team Summary',
        'Players',
        'Player Name NTRP Player Name NTRP Player Name NTRP',
        'iathan Meinert',
        '4s',
        'Connor Zilonko',
        'Michael Ho',
        'o',
        'd Cabrera',
        '4s',
        'Dragos Enea',
        '4s',
        'athan Ease',
        '4s',
      ].join('\n'),
      [],
      'tesseract',
    )

    expect(draft.players).toHaveLength(20)
    expect(draft.players.slice(0, 3)).toEqual([
      { name: 'Nathan Meinert', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
      { name: 'David Cabrera', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
      { name: 'Benjamin Strate', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    ])
    expect(draft.parserWarnings).toEqual([])
  })
})
