import { describe, expect, it, vi } from 'vitest'
import {
  buildCaptainRosterContactRows,
  buildCaptainContactReviewHref,
  getCaptainRosterPhoneCoverage,
  normalizeCaptainRosterContactKey,
  selectCaptainContactRowsForScope,
  syncAuthoritativeCaptainRoster,
  upsertCaptainRosterContacts,
} from '../captain-roster-contacts'
import type { DataAssistTeamSummaryParsedDraft } from '../data-assist-team-summary-parser'

const parsedDraft: DataAssistTeamSummaryParsedDraft = {
  draftKind: 'team_summary',
  rosterSource: 'player_roster',
  rosterTeamName: 'Example Aces',
  leagueName: '2026 Tri-Level',
  flight: 'Men 3.5/4.0/4.5',
  ustaSection: 'USTA/MISSOURI VALLEY',
  districtArea: 'ST. LOUIS',
  teams: [],
  players: [{ name: 'Alex Captain', ntrp: 4.5, teamName: 'Example Aces', phone: '314-555-0100' }],
  contacts: [{ name: 'Alex Captain', phone: '314-555-0100', email: 'alex@example.com', role: 'Captain', isCaptain: true }],
  playerCount: 1,
  contactCount: 1,
  teamCount: 0,
  parserWarnings: [],
  rawTextPreview: '',
  sourceScreenshotCount: 1,
  provider: 'tennislink_export',
  confidenceScore: 0.96,
}

describe('captain roster contacts', () => {
  it('uses the same punctuation-insensitive team key for imports and Captain lookup', () => {
    expect(normalizeCaptainRosterContactKey('SuperSmash Bros/Pottebaum-Meinart'))
      .toBe('supersmash bros pottebaum meinart')
  })

  it('falls back to team contacts when TennisLink scope labels differ', () => {
    const contacts = [
      { team_name: 'SuperSmash Bros/Pottebaum-Meinart', league_name: '2026 Adult Tri-Level', flight: '3.5/4.0/4.5', full_name: 'Alex Captain', phone: '3145550100' },
    ]
    expect(selectCaptainContactRowsForScope({
      rows: contacts,
      team: 'SuperSmash Bros / Pottebaum-Meinart',
      league: 'Tri Level 2026',
      flight: 'Men 3.5 / 4.0 / 4.5',
    })).toEqual(contacts)
  })

  it('matches imported phones to roster names without punctuation or case sensitivity', () => {
    expect(getCaptainRosterPhoneCoverage({
      rosterNames: ["Alex O'Brien", 'Jamie Smith'],
      contacts: [
        { full_name: 'ALEX O BRIEN', phone: '(314) 555-0100' },
        { full_name: 'Jamie Smith', phone: '314-555-0101' },
      ],
    })).toMatchObject({ readyCount: 2, missingCount: 0 })
  })

  it('builds a focused contact link that names the players needing updates', () => {
    expect(buildCaptainContactReviewHref({
      baseHref: '/captain/messaging?team=Example%20Aces&league=2026',
      missingNames: ['Casey Partner'],
    })).toBe('/captain/messaging?team=Example+Aces&league=2026&contactView=missing&missingContacts=Casey+Partner#captain-contact-manager')
  })

  it('scopes imported contact rows to the captain and team', () => {
    expect(buildCaptainRosterContactRows({ parsedDraft, captainUserId: 'captain-1', batchId: 'batch-1' })).toEqual([
      expect.objectContaining({
        captain_user_id: 'captain-1',
        normalized_team_name: 'example aces',
        normalized_name: 'alex captain',
        phone: '314-555-0100',
        email: 'alex@example.com',
        is_captain: true,
        source: 'tennislink_player_roster',
      }),
    ])
  })

  it('upserts contacts on the private captain/team/player scope', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn().mockReturnValue({ upsert })
    const count = await upsertCaptainRosterContacts({
      supabase: { from } as never,
      parsedDraft,
      captainUserId: 'captain-1',
      batchId: 'batch-1',
    })

    expect(count).toBe(1)
    expect(from).toHaveBeenCalledWith('captain_roster_contacts')
    expect(upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: 'captain_user_id,normalized_team_name,normalized_name,league_name,flight',
    })
  })

  it('removes older team-summary rows when a Player Roster is authoritative', async () => {
    const deletedRosterIds: string[][] = []
    const deletedContactIds: string[][] = []
    const makeSelect = (data: unknown[]) => {
      const builder = {
        eq: vi.fn(() => builder),
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
      }
      return builder
    }
    const from = vi.fn((table: string) => ({
      select: () => table === 'team_roster_members'
        ? makeSelect([
            { id: 'keep-player', player_name: 'Alex Captain' },
            { id: 'old-player', player_name: 'Former Player' },
          ])
        : makeSelect([
            { id: 'keep-contact', normalized_name: 'alex captain' },
            { id: 'old-contact', normalized_name: 'former player' },
          ]),
      delete: () => ({
        in: async (_column: string, ids: string[]) => {
          if (table === 'team_roster_members') deletedRosterIds.push(ids)
          else deletedContactIds.push(ids)
          return { error: null }
        },
      }),
    }))

    await syncAuthoritativeCaptainRoster({
      supabase: { from } as never,
      parsedDraft,
      captainUserId: 'captain-1',
    })

    expect(deletedRosterIds).toEqual([['old-player']])
    expect(deletedContactIds).toEqual([['old-contact']])
  })

  it('keeps Team Summary imports additive', async () => {
    const from = vi.fn()
    await expect(syncAuthoritativeCaptainRoster({
      supabase: { from } as never,
      parsedDraft: { ...parsedDraft, rosterSource: 'team_summary' },
      captainUserId: 'captain-1',
    })).resolves.toEqual({ removedRosterCount: 0, removedContactCount: 0 })
    expect(from).not.toHaveBeenCalled()
  })
})
