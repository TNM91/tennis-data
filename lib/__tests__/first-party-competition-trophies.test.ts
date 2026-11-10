import { createClient } from '@supabase/supabase-js'
import { afterEach, expect, it, vi } from 'vitest'
import { loadFirstPartyCompetitionTrophies } from '../first-party-competition-trophies'
import { reviewedRevisionDigest } from '../first-party-revisions'
import { publicLeague } from '../native-competitions'
import { tournamentRevisionDigest } from '../native-tournament-approvals'

const owner = '11111111-1111-4111-8111-111111111111'
const organizer = '22222222-2222-4222-8222-222222222222'
const league = { id: 'city', is_public: true, league_format: 'individual', season_status: 'completed',
  league_name: 'City League', season_label: 'Fall', flight: '4.5', created_by_user_id: organizer }
const event = { id: 'open', event_id: null, is_event: true, is_public: true, name: 'Fall Open',
  status: 'completed', created_by_user_id: organizer }
const division = { ...event, id: 'open-45', event_id: event.id, is_event: false, name: 'Men’s 4.5' }
const issued = { created_by_user_id: organizer, placement: 'first', issued_at: '2026-11-10T23:00:00Z' }

afterEach(() => vi.unstubAllEnvs())

it('uses the account’s exact player ID, current approved sources and verified publishers', async () => {
  const fingerprint = reviewedRevisionDigest(publicLeague(league))
  vi.stubEnv('TIQ_FIRST_PARTY_LEAGUE_APPROVALS', JSON.stringify({ city: { summary: fingerprint, detail: fingerprint } }))
  vi.stubEnv('TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS', JSON.stringify(Object.fromEntries([event, division].map(row =>
    [row.id, { summary: tournamentRevisionDigest(row), draw: tournamentRevisionDigest(row, true) }]))))
  let playerId = 'linked-player'
  let parentName = event.name
  const client = createClient('https://example.test', 'key', { auth: { persistSession: false }, global: { fetch: async (input) => {
    const url = new URL(String(input))
    switch (url.pathname.split('/').at(-1)) {
      case 'profiles':
        expect(url.searchParams.get('id')).toBe('eq.' + owner)
        return Response.json({ linked_player_id: playerId })
      case 'tiq_awards':
        expect(url.searchParams.get('recipient_player_id')).toBe('eq.linked-player')
        expect(url.searchParams.has('recipient_name')).toBe(false)
        return Response.json([
          { ...issued, id: 'league-award', source_type: 'league', source_id: league.id, source_name: 'Discard this name' },
          { ...issued, id: 'tournament-award', source_type: 'tournament', source_id: division.id },
          { ...issued, id: 'foreign-award', source_type: 'tournament', source_id: division.id, created_by_user_id: owner },
          { ...issued, id: 'unreviewed-award', source_type: 'league', source_id: 'unknown' },
        ])
      case 'tiq_leagues': return Response.json([league])
      case 'tiq_league_delegates': return Response.json([])
      case 'tiq_tournaments': return Response.json(url.searchParams.get('is_event') === 'eq.true' ? [{ ...event, name: parentName }] : [division])
      default: throw Error('Unexpected trophy query')
    }
  } } })
  expect(await loadFirstPartyCompetitionTrophies(client, client, owner)).toEqual([
    { id: 'league-award', kind: 'league', placement: 'first', name: league.league_name, division: 'Fall · 4.5', awardedOn: '2026-11-10' },
    { id: 'tournament-award', kind: 'tournament', placement: 'first', name: event.name, division: division.name, awardedOn: '2026-11-10' },
  ])
  parentName = 'Changed event'
  expect(await loadFirstPartyCompetitionTrophies(client, client, owner)).toEqual([expect.objectContaining({ id: 'league-award' })])
  playerId = ''
  expect(await loadFirstPartyCompetitionTrophies(client, client, owner)).toEqual([])
})
