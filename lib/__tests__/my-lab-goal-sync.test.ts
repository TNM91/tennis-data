import { describe, expect, it, vi } from 'vitest'
import { createGoalSync, mergeGoalRecords, visibleGoals, type LabGoal, type GoalRecord } from '../my-lab-goal-sync'
const goal = (id: string, title = id): LabGoal => ({ id, goal: title, progressStatus: 'in-progress', progressUpdate: '', doingWell: '', improveNext: '', notes: '', updatedAt: '2026-10-09T10:00:00.000Z' })
const record = (id: string, time: string, value: LabGoal | null = goal(id)): GoalRecord => ({ id, goal: value, editedAt: time })
function device(server: { records: GoalRecord[] }, local: GoalRecord[] = []) {
  let cache = local, visible: LabGoal[] = [], status = ''
  const sync = createGoalSync({ transport: {
    load: async () => server.records,
    save: async rows => { server.records = mergeGoalRecords(server.records, rows); return server.records },
  }, readCache: () => cache, writeCache: rows => { cache = rows }, onGoals: goals => { visible = goals }, onStatus: value => { status = value }, now: () => '2026-10-09T12:00:00.000Z' })
  return { sync, goals: () => visible, cache: () => cache, status: () => status }
}
describe('Private My Lab goal continuity', () => {
  it('does not claim an empty notebook is synced while account reads are unavailable', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue([record('a', '2026-10-09T10:00:00.000Z')])
    let status = '', goals: LabGoal[] = []
    const sync = createGoalSync({ transport: { load, save: async rows => rows }, readCache: () => [], writeCache: () => {}, onGoals: rows => { goals = rows }, onStatus: value => { status = value } })
    await sync.start([]); expect(status).toBe('device'); await sync.flush()
    expect(load).toHaveBeenCalledTimes(2); expect(goals[0].id).toBe('a'); expect(status).toBe('synced')
  })

  it('prefers account data for equal legacy timestamps and preserves removals', () => {
    const local = record('a', '1970-01-01T00:00:00.000Z', goal('a', 'Local')), remote = record('a', '1970-01-01T00:00:00Z', goal('a', 'Account'))
    expect(visibleGoals(mergeGoalRecords([local], [remote]))[0].goal).toBe('Account')
    expect(visibleGoals(mergeGoalRecords([{ ...local, goal: null }], [remote]))).toEqual([])
  })

  it('does not write unchanged account goals on a return visit', async () => {
    const rows = [record('a', '2026-10-09T10:00:00.000Z')], save = vi.fn(async records => records)
    const sync = createGoalSync({ transport: { load: async () => rows, save }, readCache: () => rows, writeCache: () => {}, onGoals: () => {}, onStatus: () => {} })
    await sync.start([]); await sync.flush(); expect(save).not.toHaveBeenCalled()
  })

  it('imports a legacy local notebook and restores it on a fresh device', async () => {
    const server = { records: [] as GoalRecord[] }, first = device(server)
    await first.sync.start([goal('prep', 'Protect the second serve')])
    const second = device(server); await second.sync.start([])
    expect(second.goals()[0].goal).toBe('Protect the second serve')
    expect(second.status()).toBe('synced')
  })
  it('preserves separate goals edited concurrently on two devices', async () => {
    const server = { records: [record('a', '2026-10-09T10:00:00Z'), record('b', '2026-10-09T10:00:00Z')] }
    const first = device(server), second = device(server); await first.sync.start([]); await second.sync.start([])
    first.sync.update([goal('a', 'New serve plan'), goal('b')]); second.sync.update([goal('a'), goal('b', 'New return plan')])
    await first.sync.flush(); await second.sync.flush()
    expect(visibleGoals(server.records).map(g => g.goal).sort()).toEqual(['New return plan', 'New serve plan'])
  })
  it('does not resurrect a removed goal from a stale device or legacy cache', async () => {
    const server = { records: [record('a', '2026-10-09T10:00:00Z')] }, first = device(server), stale = device(server)
    await first.sync.start([]); await stale.sync.start([]); first.sync.update([]); await first.sync.flush(); await stale.sync.flush()
    const returning = device(server, first.cache()); await returning.sync.start([goal('a')])
    expect(returning.goals()).toEqual([]); expect(visibleGoals(server.records)).toEqual([])
  })
  it('keeps an edit made while the initial account read is pending', async () => {
    let resolve!: (value: GoalRecord[]) => void
    const pending = new Promise<GoalRecord[]>(r => { resolve = r }), visible: LabGoal[][] = []
    const sync = createGoalSync({ transport: { load: () => pending, save: async rows => rows }, readCache: () => [], writeCache: () => {}, onGoals: g => visible.push(g), onStatus: () => {} })
    const start = sync.start([goal('a')]); sync.update([goal('a', 'Edited while loading')]); resolve([record('a', '2026-10-09T10:00:00Z')]); await start
    expect(visible.at(-1)?.[0].goal).toBe('Edited while loading')
  })
  it('retains local edits on a failed save and retries when requested', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementation(async rows => rows)
    let status = '', cached: GoalRecord[] = []
    const sync = createGoalSync({ transport: { load: async () => [], save }, readCache: () => [], writeCache: rows => { cached = rows }, onGoals: () => {}, onStatus: s => { status = s } })
    await sync.start([goal('a')]); expect(status).toBe('device'); expect(cached[0].goal?.id).toBe('a')
    await sync.flush(); expect(status).toBe('synced')
  })
  it('ignores responses after an account or player scope is disposed', async () => {
    let resolve!: (value: GoalRecord[]) => void
    const pending = new Promise<GoalRecord[]>(r => { resolve = r }), onGoals = vi.fn()
    const sync = createGoalSync({ transport: { load: () => pending, save: async rows => rows }, readCache: () => [], writeCache: () => {}, onGoals, onStatus: () => {} })
    const start = sync.start([]); onGoals.mockClear(); sync.dispose(); resolve([record('private', '2026-10-09T10:00:00Z')]); await start
    expect(onGoals).not.toHaveBeenCalled()
  })
})
