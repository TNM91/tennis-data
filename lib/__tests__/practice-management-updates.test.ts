import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), identity: vi.fn(), message: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }))
vi.mock('@/lib/internal-messages', () => ({ getInternalIdentity: mocks.identity, sendInternalMessage: mocks.message }))
vi.mock('@/lib/tiq-league-schedule-service', () => ({}))
import { listCaptainPracticeManagementOverview, updateInternalScheduleEvent } from '@/lib/internal-scheduling'
const row = { id: 'event', conversation_id: 'thread', event_type: 'captain_practice', title: 'Team practice', scheduled_date: '2026-10-07', scheduled_time: '20:00', facility: 'Courts', recurrence_rule: 'weekly', status: 'proposed', created_by_user_id: 'captain', metadata: { practiceNotes: 'Serve', publicToken: 'same-token' } }
function chain(result: unknown) {
  const query: Record<string, unknown> = {}
  for (const name of ['select', 'eq', 'neq', 'order', 'limit', 'in', 'update']) query[name] = vi.fn(() => query)
  query.single = vi.fn(async () => result)
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return query
}
describe('practice management updates', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.identity.mockResolvedValue({ userId: 'captain' }); mocks.message.mockResolvedValue(undefined) })
  it('advances due repeats before loading the practice list', async () => {
    mocks.rpc.mockResolvedValue({ error: null })
    mocks.from.mockReturnValue(chain({ data: [], error: null }))
    expect(await listCaptainPracticeManagementOverview()).toEqual([])
    expect(mocks.rpc).toHaveBeenCalledWith('advance_captain_practices')
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.from.mock.invocationCallOrder[0])
  })
  it('updates the existing event and preserves its signup token', async () => {
    const read = chain({ data: [row], error: null })
    const write = chain({ data: row, error: null })
    mocks.from.mockReturnValueOnce(read).mockReturnValueOnce(write)
    await updateInternalScheduleEvent({ eventId: 'event', actorUserId: 'captain', scheduledDate: '2026-10-14', scheduledTime: '19:00', scheduledEndTime: '21:00', facility: 'New courts', notes: 'Returns', recurrenceRule: 'biweekly' })
    expect(write.update).toHaveBeenCalledWith(expect.objectContaining({ scheduled_date: '2026-10-14', recurrence_rule: 'biweekly', metadata: expect.objectContaining({ publicToken: 'same-token', practiceEndTime: '21:00', practiceNotes: 'Returns' }) }))
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })
  it('rejects editing another captain practice', async () => {
    mocks.from.mockReturnValue(chain({ data: [row], error: null }))
    await expect(updateInternalScheduleEvent({ eventId: 'event', actorUserId: 'other', scheduledDate: '2026-10-14' })).rejects.toThrow('Only the captain')
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
})
