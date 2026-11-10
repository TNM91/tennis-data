import { createClient } from '@supabase/supabase-js'
import { afterEach, expect, it, vi } from 'vitest'
import { GET } from '../../app/api/mobile/first-party/setup/route'
import { buildProductAccessState } from '../access-model-core'
import { loadFirstPartySetup } from '../first-party-setup'
import { buildSetupTracks, readSetupTracks, setupTracks } from '../setup-trophies'

vi.mock('../player-api-auth', () => ({ loadPlayerAccess: vi.fn() }))

const owner = '10000000-0000-4000-8000-000000000001'
const room = '10000000-0000-4000-8000-000000000002'
const captain = { teamName: 'Baseline Aces', leagueName: 'City League', flight: '4.5', roomId: room }

afterEach(() => vi.unstubAllEnvs())

it('denies signed-out setup requests and returns only private responses', async () => {
  const response = await GET(new Request('https://example.test/api/mobile/first-party/setup'))
  expect(response.status).toBe(401)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
})

it('requires real milestones for each plan and rejects unknown or repeated steps', () => {
  const complete = Object.fromEntries(setupTracks.full_court.steps.map(step => [step, true]))
  const tracks = buildSetupTracks(['free', 'full_court'], { ...complete, account: true, teammate: false })
  expect(tracks).toEqual([
    { tier: 'free', done: ['account'] },
    { tier: 'full_court', done: setupTracks.full_court.steps.filter(step => step !== 'teammate') },
  ])
  expect(readSetupTracks(tracks)).toEqual(tracks)
  expect(() => readSetupTracks([{ tier: 'captain', done: ['invite', 'invite'] }])).toThrow()
  expect(() => readSetupTracks([{ tier: 'captain', done: ['scorecard'] }])).toThrow()
})

it('counts only the signed-in captain’s current reviewed room and separates creating a link from a teammate joining', async () => {
  vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', JSON.stringify([captain]))
  let removed = false
  let joins = 0
  const client = createClient('https://example.test', 'test-key', { auth: { persistSession: false }, global: {
    fetch: async (input, init) => {
      expect(init?.method ?? 'GET').toBe('GET')
      const url = new URL(String(input))
      switch (url.pathname.split('/').at(-1)) {
        case 'team_profile_links': return Response.json([{ profile_user_id: owner, team_name: captain.teamName,
          league_name: captain.leagueName, flight: captain.flight, status: 'accepted', archived_at: null,
          source_type: 'tiq_entry', team_role: 'captain', team_roles: ['captain'] }])
        case 'internal_conversations': return Response.json([{ id: room, related_entity_id: 'baseline aces__city league__4 5' }])
        case 'internal_conversation_participants': return Response.json([{ conversation_id: room }])
        case 'team_room_member_removals': return Response.json(removed ? [{ conversation_id: room }] : [])
        case 'team_room_invites':
          expect(url.searchParams.get('created_by_user_id')).toBe('eq.' + owner)
          expect(url.searchParams.get('conversation_id')).toBe('in.(' + room + ')')
          return Response.json([{ accepted_count: joins }])
        case 'native_personal_matches': return Response.json([{ id: 'scorecard' }])
        case 'level_up_sessions':
          expect(url.searchParams.get('player_user_id')).toBe('eq.' + owner)
          return Response.json([])
        default: throw Error('Unexpected setup query')
      }
    },
  } })
  const access = buildProductAccessState('member', { captainSubscriptionActive: true })
  const captainProgress = async () => (await loadFirstPartySetup(client, client, owner, access)).find(track => track.tier === 'captain')?.done
  expect(await captainProgress()).toEqual(['team', 'invite'])
  joins = 1
  expect(await captainProgress()).toEqual(['team', 'invite', 'teammate'])
  removed = true
  expect(await captainProgress()).toEqual([])
})
