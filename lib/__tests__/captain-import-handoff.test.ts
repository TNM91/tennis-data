import { describe, expect, it } from 'vitest'
import {
  buildCaptainImportHandoff,
  buildCaptainImportReturnHref,
  buildConsumedCaptainHandoffHref,
  isCaptainImportDraft,
  readCaptainImportHandoff,
} from '../captain-import-handoff'

describe('Captain import handoff', () => {
  it('returns an imported roster to the exact team with durable completion counts', () => {
    const handoff = buildCaptainImportHandoff({
      batchId: 'batch-123',
      parsedDraft: {
        draftKind: 'team_summary',
        rosterTeamName: 'Meinert Tri-Level',
        leagueName: '2026 Tri-Level',
        flight: '3.5 / 4.0 / 4.5',
        ustaSection: 'Missouri Valley',
        districtArea: 'St. Louis',
        teams: [],
        players: [
          { name: 'Player One', ntrp: 3.5, teamName: 'Meinert Tri-Level' },
          { name: 'Player Two', ntrp: 4, teamName: 'Meinert Tri-Level' },
        ],
        contacts: [
          { name: 'Player One', phone: '5551112222', email: 'one@example.com', role: 'Captain', isCaptain: true },
        ],
        playerCount: 2,
        contactCount: 1,
        teamCount: 1,
        parserWarnings: [],
        rawTextPreview: '',
        sourceScreenshotCount: 1,
        provider: 'mock_review',
        confidenceScore: 1,
      },
    })

    const href = buildCaptainImportReturnHref('/captain?layer=usta#captain-team-scope', handoff)
    const url = new URL(href, 'https://tenaceiq.example')

    expect(url.pathname).toBe('/captain')
    expect(url.searchParams.get('layer')).toBe('usta')
    expect(url.searchParams.get('team')).toBe('Meinert Tri-Level')
    expect(url.searchParams.get('league')).toBe('2026 Tri-Level')
    expect(url.searchParams.get('flight')).toBe('3.5 / 4.0 / 4.5')
    expect(url.searchParams.get('importPlayers')).toBe('2')
    expect(url.searchParams.get('importContacts')).toBe('1')
    expect(url.hash).toBe('#captain-team-scope')
    expect(readCaptainImportHandoff(url.searchParams)).toEqual(handoff)

    url.searchParams.set('setupResult', 'player-linked')
    const consumedHref = new URL(
      buildConsumedCaptainHandoffHref(url.searchParams, url.hash),
      'https://tenaceiq.example',
    )
    expect(consumedHref.searchParams.get('captainImport')).toBeNull()
    expect(consumedHref.searchParams.get('importBatch')).toBeNull()
    expect(consumedHref.searchParams.get('importPlayers')).toBeNull()
    expect(consumedHref.searchParams.get('importContacts')).toBeNull()
    expect(consumedHref.searchParams.get('setupResult')).toBeNull()
    expect(consumedHref.searchParams.get('team')).toBe('Meinert Tri-Level')
    expect(consumedHref.searchParams.get('league')).toBe('2026 Tri-Level')
    expect(consumedHref.searchParams.get('flight')).toBe('3.5 / 4.0 / 4.5')
    expect(consumedHref.searchParams.get('layer')).toBe('usta')
    expect(consumedHref.hash).toBe('#captain-team-scope')
    expect(readCaptainImportHandoff(consumedHref.searchParams)).toBeNull()
  })

  it('captures imported schedule matches and rejects unrelated drafts', () => {
    const schedule = {
      draftKind: 'schedule' as const,
      teamName: 'Tri-Level Team',
      leagueName: 'Tri-Level',
      flight: '4.0 / 4.5 / 5.0',
      ustaSection: '',
      districtArea: '',
      matches: [
        {
          externalMatchId: 'future-1',
          matchDate: '1/15/2099',
          matchTime: '6:00 PM',
          homeTeam: 'Tri-Level Team',
          awayTeam: 'Net Results',
          facility: 'TIQ Courts',
          confidenceScore: 1,
          reviewNotes: [],
        },
      ],
      matchCount: 8,
      parserWarnings: [],
      rawTextPreview: '',
      sourceScreenshotCount: 1,
      provider: 'mock_review' as const,
      confidenceScore: 1,
    }
    const handoff = buildCaptainImportHandoff({ batchId: 'schedule-1', parsedDraft: schedule })

    expect(handoff.matches).toBe(8)
    expect(handoff.nextMatchDate).toBe('2099-01-15')
    expect(handoff.opponent).toBe('Net Results')
    const returnHref = new URL(buildCaptainImportReturnHref('/captain', handoff), 'https://tenaceiq.example')
    expect(returnHref.pathname).toBe('/captain/availability')
    expect(returnHref.searchParams.get('date')).toBe('2099-01-15')
    expect(returnHref.searchParams.get('opponent')).toBe('Net Results')
    expect(buildCaptainImportReturnHref('https://bad.example', handoff)).toBe('/captain')
    expect(isCaptainImportDraft(schedule)).toBe(true)
    expect(isCaptainImportDraft({ draftKind: 'scorecard' })).toBe(false)
  })
})
