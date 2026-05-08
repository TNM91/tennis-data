import { describe, expect, it } from 'vitest'
import { buildScheduleOcrDraftFromText } from '../data-assist-schedule-parser'

describe('buildScheduleOcrDraftFromText', () => {
  it('parses structured TennisLink team schedule rows', () => {
    const draft = buildScheduleOcrDraftFromText(
      [
        'Team: Meinert/The Other Guys (S)',
        '2026 Adult 18 & Over Spring',
        'Men 4.5',
        'TennisLink structured schedule read',
        'Schedule row | 1011650666 | 1/18/2026 | 5:30 PM | Hodge/Kamman (S) | Meinert/The Other Guys (S) | St. Clair Tennis Club',
        'Schedule row | 1011650669 | 1/25/2026 | 10:00 AM | Meinert/The Other Guys (S) | Schnellaveria (S) | Vetta West',
      ].join('\n'),
      [],
      'tesseract',
    )

    expect(draft.teamName).toBe('Meinert/The Other Guys (S)')
    expect(draft.leagueName).toBe('2026 Adult 18 & Over Spring')
    expect(draft.flight).toBe('Men 4.5')
    expect(draft.matchCount).toBe(2)
    expect(draft.matches[0]).toMatchObject({
      externalMatchId: '1011650666',
      matchDate: '1/18/2026',
      matchTime: '5:30 PM',
      homeTeam: 'Hodge/Kamman (S)',
      awayTeam: 'Meinert/The Other Guys (S)',
      facility: 'St. Clair Tennis Club',
    })
    expect(draft.matches[1].reviewNotes).toEqual([])
  })

  it('repairs common OCR slips from full-page team schedule screenshots', () => {
    const draft = buildScheduleOcrDraftFromText(
      [
        'Team: Meinert/The Other Guys (S)',
        '2026 Adult 18 & Over Spring',
        'Schedule row | 1011650869 | 1252026 | 10.00 am | Meier The Other Guys | chnellaveria se | Vetta West | 1011650869 1252026 10.00 am Meinert The Other Guys Schnellaveria Vetta West',
        'Schedule row | 1011650674 | 2m2028 | S00 PM | The Other Guys | waa foverines | Missoun Ate Club West | 1011650674 282026 900 AM Meinert The Other Guys Gontarz Wid William Wily Wolverines Missouri Athletic Club West',
      ].join('\n'),
      [],
      'tesseract',
    )

    expect(draft.matches[0]).toMatchObject({
      externalMatchId: '1011650669',
      matchDate: '1/25/2026',
      matchTime: '10:00 AM',
      homeTeam: 'Meinert/The Other Guys (S)',
      awayTeam: 'Schnellaveria (S)',
      facility: 'Vetta West',
    })
    expect(draft.matches[1]).toMatchObject({
      externalMatchId: '1011650674',
      matchDate: '2/8/2026',
      matchTime: '9:00 AM',
      homeTeam: 'Meinert/The Other Guys (S)',
      awayTeam: "Gontarz/Wild William's Wily Wolverines (S)",
      facility: 'Missouri Athletic Club - West',
    })
  })

  it('prefers known team schedule rows over neighboring OCR bleed', () => {
    const draft = buildScheduleOcrDraftFromText(
      [
        'Team: Meinert/The Other Guys (S)',
        '2026 Adult 18 & Over Spring',
        'Schedule row | 1011650672 | 2m2028 | S00 AM | Huchet/Ariston | Levin/Collop | Sunset Tennis Center | 1011650672 212026 1200 PM Meinert The Other Guys Huchet Ariston Vetta West',
      ].join('\n'),
      [],
      'tesseract',
    )

    expect(draft.matches[0]).toMatchObject({
      externalMatchId: '1011650672',
      matchDate: '2/1/2026',
      matchTime: '12:00 PM',
      homeTeam: 'Meinert/The Other Guys (S)',
      awayTeam: 'Huchet/Ariston (S)',
      facility: 'Vetta West',
    })
    expect(draft.matches[0].reviewNotes).toEqual([])
  })

  it('drops orphan OCR rows that do not belong to the detected team schedule', () => {
    const draft = buildScheduleOcrDraftFromText(
      [
        'Team: Meinert/The Other Guys (S)',
        '2026 Adult 18 & Over Spring',
        'Schedule row | 1011650707 | 532026 | 1200 PM | Schnellaveria | The Other Guys | Forest Lake Tennis Club | 1011650707 532026 1200 PM Schnellaveria Meinert The Other Guys Forest Lake Tennis Club',
        'Schedule row | 1011650685 | | 1000 AM | Hodge/Kamman | Schnellaveria | | neighbor row bleed',
        'Schedule row | 1011650650 | 152026 | | | | | footer bleed',
      ].join('\n'),
      [],
      'tesseract',
    )

    expect(draft.matches.map((match) => match.externalMatchId)).toEqual(['1011650707'])
    expect(draft.matches[0].reviewNotes).toEqual([])
  })
})
