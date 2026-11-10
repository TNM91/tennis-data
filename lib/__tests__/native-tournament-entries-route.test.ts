import {beforeEach,expect,it,vi} from 'vitest'
import {GET} from '../../app/api/mobile/tournaments/entries/route'
import {tournamentOwner as owner} from '../../tests/fixtures/native-tournaments'

const {auth} = vi.hoisted(() => ({auth: vi.fn()}))
vi.mock('../player-api-auth', () => ({getSignedInPlayerApiAuth: auth}))

const url = 'https://example.invalid/api/mobile/tournaments/entries'
const entryId = (index: number) => '10000000-0000-4000-8000-' + String(index).padStart(12, '0')
const entry = (index: number, tournament_id: string, status = 'pending') => ({
 id: entryId(index), tournament_id, status, submitted_by_user_id: owner, phone: 'private-contact',
})
const names = [
 {id: 'event', event_id: null, is_event: true, name: 'Fall Open', is_public: true, status: 'scheduled'},
 {id: 'division', event_id: 'event', is_event: false, name: '4.0 Doubles', is_public: true, status: 'open'},
 {id: 'standalone', event_id: null, is_event: false, name: 'Spring Singles', is_public: true, status: 'completed'},
 {id: 'private', event_id: null, is_event: true, name: 'Private Event', is_public: false, status: 'open'},
 {id: 'orphan', event_id: 'private', is_event: false, name: 'Private Division', is_public: true, status: 'open'},
]

function fixture(rows: ReturnType<typeof entry>[]) {
 const filters: [string, unknown][] = []
 const from = vi.fn((table: string) => {
  let ids: string[] = []
  const query = {
   select: () => query,
   eq: (field: string, value: unknown) => {filters.push([field, value]);return query},
   neq: (field: string, value: unknown) => {filters.push([field, value]);return query},
   in: (_field: string, values: string[]) => {ids = values;return query},
   order: () => query,
   limit: () => query,
   abortSignal: async () => ({
    data: table === 'tiq_tournament_entries' ? rows : names.filter(row => ids.includes(row.id) && row.is_public),
    error: null,
   }),
  }
  return query
 })
 auth.mockResolvedValue({ok: true, userId: owner, supabase: {from}})
 return {from, filters}
}

beforeEach(() => vi.clearAllMocks())

it('returns only account-scoped summaries and omits details for unpublished events', async () => {
 const {filters} = fixture([entry(1, 'division'), entry(2, 'standalone', 'approved'), entry(3, 'orphan', 'declined')])
 const response = await GET(new Request(url))
 expect(response.status).toBe(200)
 expect(response.headers.get('Cache-Control')).toBe('private, no-store')
 expect(filters).toContainEqual(['submitted_by_user_id', owner])
 expect(filters).toContainEqual(['is_public', true])
 expect(filters).toContainEqual(['status', 'draft'])
 expect(await response.json()).toEqual({
  ok: true, owner, more: false, entries: [
   {id: entryId(1), status: 'pending', eventName: 'Fall Open', divisionName: '4.0 Doubles', selection: {parent: 'event', division: 'division'}},
   {id: entryId(2), status: 'approved', eventName: 'Spring Singles', divisionName: '', selection: {parent: '', division: 'standalone'}},
   {id: entryId(3), status: 'declined', eventName: '', divisionName: '', selection: null},
  ],
 })
})

it('rejects unauthenticated, injected and mixed-account reads', async () => {
 const {from} = fixture([])
 auth.mockResolvedValueOnce({ok: false, response: Response.json({}, {status: 401})})
 expect((await GET(new Request(url))).status).toBe(401)
 expect((await GET(new Request(url+'?owner=other'))).status).toBe(400)
 expect(from).not.toHaveBeenCalled()
 fixture([{...entry(1, 'division'), submitted_by_user_id: 'other'}])
 expect((await GET(new Request(url))).status).toBe(503)
})

it('discloses when older entry records are outside the list', async () => {
 fixture(Array.from({length: 31}, (_,index) => entry(index, 'division')))
 const response = await GET(new Request(url))
 const payload = await response.json()
 expect(payload.entries).toHaveLength(30)
 expect(payload.more).toBe(true)
})

it('finds a decision entry by exact division regardless of the general list limit', async () => {
 const {filters} = fixture([entry(1, 'division', 'approved')])
 const response = await GET(new Request(url+'?division=division'))
 expect(response.status).toBe(200)
 expect(filters).toContainEqual(['tournament_id', 'division'])
 expect(filters).toContainEqual(['submitted_by_user_id', owner])
 expect(await response.json()).toMatchObject({more: false, entries: [
  {id: entryId(1), status: 'approved', selection: {parent: 'event', division: 'division'}},
 ]})
})

it('rejects ambiguous division queries and duplicate or unrelated receipts', async () => {
 const {from} = fixture([])
 for(const suffix of ['?division=', '?division=../bad', '?division=division&division=other']){
  expect((await GET(new Request(url+suffix))).status).toBe(400)
 }
 expect(from).not.toHaveBeenCalled()
 fixture([entry(1, 'division'), entry(2, 'division')])
 expect((await GET(new Request(url+'?division=division'))).status).toBe(409)
 fixture([entry(1, 'standalone')])
 expect((await GET(new Request(url+'?division=division'))).status).toBe(503)
})
