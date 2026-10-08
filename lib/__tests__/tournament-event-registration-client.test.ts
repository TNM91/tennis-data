import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ error: null as null | { message: string }, args: null as unknown, selectColumns: '' }))
vi.mock('../supabase', () => ({ supabase: {
  rpc: vi.fn(async (name: string, args: unknown) => { state.args = { name, args }; return { data: { id: 'saved' }, error: state.error } }),
  from: vi.fn(() => ({ select: (columns: string) => { state.selectColumns = columns; return { eq: () => ({ order: async () => ({ data: [], error: state.error }) }) } } }))
} }))
import { loadEventRegistrations, saveEventRegistration } from '../tournament-event-registration-client'
const draft = { id: 'row', expected_updated_at: 'version', tournament_id: 'division', player_one: 'Morgan', player_two: 'Lee', status: 'confirmed' as const, fee_cents: 8000, paid_cents: 8000, note: '' }
describe('private event registration client', () => {
  beforeEach(() => { state.error = null; state.args = null })
  it('sends the row version through the atomic save without issuing independent field writes', async () => {
    expect(await saveEventRegistration('event', draft)).toEqual({ id: 'saved' })
    expect(state.args).toEqual({ name: 'save_tiq_event_registration', args: { target_event: 'event', registration: draft } })
  })
  it('reports stale saves and never pretends an offline save succeeded', async () => {
    state.error = { message: 'Registration changed. Refresh before saving.' }
    await expect(saveEventRegistration('event', draft)).rejects.toThrow('Registration changed')
    state.error = { message: 'Network error' }
    await expect(saveEventRegistration('event', draft)).rejects.toThrow('could not be saved')
  })
  it('does not turn a load failure into an empty successful roster', async () => {
    state.error = { message: 'permission denied' }
    await expect(loadEventRegistrations('event')).rejects.toThrow('could not load')
    state.error = null
    await expect(loadEventRegistrations('event')).resolves.toEqual([])
  })
})
