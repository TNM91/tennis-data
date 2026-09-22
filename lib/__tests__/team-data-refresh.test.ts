import { describe, expect, it } from 'vitest'
import { compareTeamDataRefresh } from '../team-data-refresh'
import type { DataAssistTeamSummaryParsedDraft } from '../data-assist-team-summary-parser'

const baseDraft: DataAssistTeamSummaryParsedDraft = {
  draftKind: 'team_summary',
  rosterSource: 'team_summary',
  rosterTeamName: 'Example Aces',
  leagueName: '2026 Tri-Level',
  flight: 'Men 3.5/4.0/4.5',
  ustaSection: 'USTA/MISSOURI VALLEY',
  districtArea: 'ST. LOUIS',
  teams: [],
  players: [
    { name: 'Alex Captain', ntrp: 4.5, teamName: 'Example Aces' },
    { name: 'New Player', ntrp: 4, teamName: 'Example Aces' },
  ],
  contacts: [],
  playerCount: 2,
  contactCount: 0,
  teamCount: 0,
  parserWarnings: [],
  rawTextPreview: '',
  sourceScreenshotCount: 1,
  provider: 'tennislink_export',
  confidenceScore: 0.96,
}

describe('team data refresh comparison', () => {
  it('treats added players as a safe refresh', () => {
    const result = compareTeamDataRefresh({
      parsedDraft: baseDraft,
      existingRoster: [{ player_name: 'Alex Captain', ntrp: 4.5 }],
      existingContacts: [],
    })

    expect(result.needsConfirmation).toBe(false)
    expect(result.addedPlayerNames).toEqual(['New Player'])
    expect(result.summary).toContain('1 new player will be added')
  })

  it('flags a thinner Team Summary and preserves omitted players', () => {
    const result = compareTeamDataRefresh({
      parsedDraft: { ...baseDraft, players: [baseDraft.players[0]], playerCount: 1 },
      existingRoster: [
        { player_name: 'Alex Captain', ntrp: 4.5 },
        { player_name: 'Current Player', ntrp: 4 },
      ],
      existingContacts: [],
    })

    expect(result.needsConfirmation).toBe(true)
    expect(result.preservedPlayerNames).toEqual(['Current Player'])
    expect(result.summary).toContain('preserve 1 saved player')
  })

  it('detects missing contact fields without treating Team Summary contacts as required', () => {
    const result = compareTeamDataRefresh({
      parsedDraft: {
        ...baseDraft,
        rosterSource: 'player_roster',
        players: [baseDraft.players[0]],
        contacts: [{ name: 'Alex Captain', phone: '314-555-0100', email: '', role: 'Captain', isCaptain: true }],
        playerCount: 1,
        contactCount: 1,
      },
      existingRoster: [{ player_name: 'Alex Captain', ntrp: 4.5 }],
      existingContacts: [{ full_name: 'Alex Captain', phone: '314-555-0100', email: 'alex@example.com' }],
    })

    expect(result.needsConfirmation).toBe(true)
    expect(result.preservedDetailCount).toBe(1)
    expect(result.summary).toContain('1 saved contact detail')
  })
})
