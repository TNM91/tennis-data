import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ latest: {} as Record<string, unknown>, failure: false, errorMessage: 'denied', payload: null as Record<string, unknown> | null }))
vi.mock('../supabase', () => ({ supabase: { from: () => {
  let updating = false
  const query = { select: () => query, eq: () => query,
    update: (payload: Record<string, unknown>) => { updating = true; state.payload = payload; return query },
    maybeSingle: async () => updating ? state.failure ? { data: null, error: { message: state.errorMessage } } : { data: { id: '40' }, error: null }
      : { data: state.latest, error: null } }
  return query
} } }))
import { readTiqTournamentRegistry, saveTiqTournamentEventCourtAssignment, upsertTiqTournamentRecord } from '../tiq-tournament-registry'

function seed() {
  upsertTiqTournamentRecord({ name: 'Pumpkin', isEvent: true, format: 'round_robin', entrantType: 'teams', status: 'draft',
    startsOn: '2026-10-17', locationLabel: '', directorNotes: '', entrants: [], isPublic: false }, 'pumpkin')
  return upsertTiqTournamentRecord({ name: '4.0', eventId: 'pumpkin', format: 'round_robin', entrantType: 'teams', status: 'draft',
    startsOn: '2026-10-17', locationLabel: '', directorNotes: '', entrants: ['A', 'B', 'C', 'D'], isPublic: false }, '40')
}
const assignment = { eventId: 'pumpkin', tournamentId: '40', matchId: 'r1-m1', date: '2026-10-17', time: '17:30', court: '1' }
describe('event court assignment persistence', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) } })
    state.failure = false; state.errorMessage = 'denied'; state.payload = null
    const record = seed()
    state.latest = { format: record.format, entrants: record.entrants, results: {}, schedule: {}, status: record.status, updated_at: '2026-10-07T22:00:00Z' }
  })
  it('retains the latest other assignments and updates only scheduling fields', async () => {
    state.latest.schedule = { 'r2-m1': { date: '2026-10-17', time: '19:30', court: '2', updatedAt: '' } }
    const result = await saveTiqTournamentEventCourtAssignment(assignment, 'organizer')
    expect(result.error).toBeNull()
    expect(result.source).toBe('cloud')
    expect(result.data?.schedule['r2-m1']?.court).toBe('2')
    expect(Object.keys(state.payload!).sort()).toEqual(['schedule', 'status', 'updated_at', 'updated_by_user_id'])
    expect(readTiqTournamentRegistry().find(record => record.id === 'pumpkin')?.schedule).toEqual({})
  })
  it('reports rejected saves and restores the previous local assignment', async () => {
    state.failure = true
    const result = await saveTiqTournamentEventCourtAssignment(assignment, 'organizer')
    expect(result.error).toBeInstanceOf(Error)
    expect(readTiqTournamentRegistry().find(record => record.id === '40')?.schedule).toEqual({})
  })
  it('explains an active court lock without retaining an unsaved assignment or notice', async () => {
    state.failure = true
    state.errorMessage = 'This match is called or on court. Undo the call in Next on court before changing its assignment.'
    const result = await saveTiqTournamentEventCourtAssignment(assignment, 'organizer')
    expect(result.error?.message).toBe(state.errorMessage)
    expect(readTiqTournamentRegistry().find(record => record.id === '40')?.schedule).toEqual({})
  })
  it('rejects a different event, an invalid slot, and a match removed from the cloud draw', async () => {
    expect((await saveTiqTournamentEventCourtAssignment({ ...assignment, eventId: 'other' }, 'organizer')).error).toBeInstanceOf(Error)
    expect((await saveTiqTournamentEventCourtAssignment({ ...assignment, date: '2026-02-30' }, 'organizer')).error).toBeInstanceOf(Error)
    state.latest.entrants = []
    expect((await saveTiqTournamentEventCourtAssignment(assignment, 'organizer')).error).toBeInstanceOf(Error)
    expect(state.payload).toBeNull()
  })
  it('clears an assignment without clearing division results', async () => {
    state.latest.results = { 'r1-m1': { winner: 'A', score: '6-4', updatedAt: '' } }
    state.latest.schedule = { 'r1-m1': { date: '2026-10-17', time: '17:30', court: '1', updatedAt: '' } }
    const result = await saveTiqTournamentEventCourtAssignment({ ...assignment, date: '', time: '', court: '' }, 'organizer')
    expect(result.data?.schedule['r1-m1']).toMatchObject({ date: '', time: '', court: '', change: { previous: { date: '2026-10-17', time: '17:30', court: '1' } } })
    expect(result.data?.results['r1-m1'].winner).toBe('A')
  })
})