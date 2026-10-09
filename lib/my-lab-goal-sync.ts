export type LabGoal = {
  id: string; goal: string; progressStatus: 'not-started' | 'in-progress' | 'improving' | 'completed'
  progressUpdate: string; doingWell: string; improveNext: string; notes: string; updatedAt: string | null
}
export type GoalRecord = { id: string; goal: LabGoal | null; editedAt: string }
export type GoalSyncStatus = 'loading' | 'pending' | 'synced' | 'device'
export const GOAL_SYNC_LABELS: Record<GoalSyncStatus, string> = {
  loading: 'Checking saved goals…', pending: 'Saved here · syncing…', synced: 'Saved to your account', device: 'Saved on this device · account sync unavailable',
}
export function hasGoalContent(goal: LabGoal) {
  return [goal.goal, goal.progressUpdate, goal.doingWell, goal.improveNext, goal.notes].some(value => value.trim())
}
export function mergeGoalRecords(...groups: GoalRecord[][]): GoalRecord[] {
  const merged = new Map<string, GoalRecord>()
  for (const record of groups.flat()) {
    if (!record.id || !Number.isFinite(Date.parse(record.editedAt))) continue
    const previous = merged.get(record.id)
    if (!previous || Date.parse(record.editedAt) > Date.parse(previous.editedAt)
      || (Date.parse(record.editedAt) === Date.parse(previous.editedAt) && (record.goal === null || previous.goal !== null))) merged.set(record.id, record)
  }
  return [...merged.values()]
}
export function visibleGoals(records: GoalRecord[]) {
  return records.filter((record): record is GoalRecord & { goal: LabGoal } => record.goal !== null)
    .map(record => record.goal).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') || a.id.localeCompare(b.id))
}
type GoalTransport = { load: () => Promise<GoalRecord[]>; save: (records: GoalRecord[]) => Promise<GoalRecord[]> }
export function createGoalSync(options: {
  transport: GoalTransport; readCache: () => GoalRecord[]; writeCache: (records: GoalRecord[]) => void
  onGoals: (goals: LabGoal[]) => void; onStatus: (status: GoalSyncStatus) => void; now?: () => string
}) {
  let records: GoalRecord[] = [], active = true, ready = false, saving = false, queued = false, loadedAccount = false
  const acknowledged = new Map<string, string>()
  const fingerprint = (record: GoalRecord) => JSON.stringify(record)
  const acknowledge = (rows: GoalRecord[]) => { for (const row of rows) acknowledged.set(row.id, fingerprint(row)) }
  const now = options.now || (() => new Date().toISOString())
  const cache = () => { try { options.writeCache(records) } catch { /* Account sync still works when browser storage is blocked. */ } }
  const notify = () => { if (active) options.onGoals(visibleGoals(records)) }
  async function flush() {
    if (!active || !ready) return
    if (saving) { queued = true; return }
    saving = true
    if (!loadedAccount) {
      try { const remote = await options.transport.load(); if (!active) { saving = false; return }; acknowledge(remote); records = mergeGoalRecords(records, remote); loadedAccount = true; cache(); notify() }
      catch { saving = false; if (active) options.onStatus('device'); return }
    }
    const snapshot = records.filter(record => acknowledged.get(record.id) !== fingerprint(record))
    if (!snapshot.length) { saving = false; options.onStatus('synced'); return }
    options.onStatus('pending')
    try {
      const remote = await options.transport.save(snapshot)
      if (!active) return
      acknowledge(remote); records = mergeGoalRecords(records, remote); cache(); notify()
      options.onStatus(queued ? 'pending' : 'synced')
    } catch { if (active) options.onStatus('device') }
    finally { saving = false; if (queued && active) { queued = false; void flush() } }
  }
  return {
    async start(local: LabGoal[]) {
      let cached: GoalRecord[] = []
      try { const stored = options.readCache(); cached = Array.isArray(stored) ? stored : [] } catch { /* Retain the legacy notebook when the cache is unavailable. */ }
      // Once a goal has a sync record (including a removal), the legacy list cannot resurrect it.
      const known = new Set(cached.map(record => record.id))
      records = mergeGoalRecords(cached, local.filter(goal => hasGoalContent(goal) && !known.has(goal.id))
        .map(goal => ({ id: goal.id, goal, editedAt: goal.updatedAt || '1970-01-01T00:00:00.000Z' })))
      notify(); options.onStatus('loading')
      let loaded = false
      try { const remote = await options.transport.load(); if (!active) return; acknowledge(remote); records = mergeGoalRecords(records, remote); loaded = true; loadedAccount = true }
      catch { if (active) options.onStatus('device') }
      if (!active) return
      ready = true; cache(); notify()
      if (loaded) await flush()
    },
    update(goals: LabGoal[]) {
      const stamp = new Date(Math.max(Date.parse(now()), ...records.map(record => Date.parse(record.editedAt) + 1))).toISOString(), ids = new Set(goals.map(goal => goal.id))
      const previous = new Map(records.map(record => [record.id, record]))
      const edits: GoalRecord[] = goals.map(goal => {
        const old = previous.get(goal.id)
        return old?.goal && JSON.stringify(old.goal) === JSON.stringify(goal) ? old : { id: goal.id, goal, editedAt: stamp }
      })
      const removals = records.filter(record => record.goal && !ids.has(record.id)).map(record => ({ id: record.id, goal: null, editedAt: stamp }))
      records = mergeGoalRecords(records, edits, removals); cache()
      if (active) options.onStatus('pending')
    },
    flush,
    dispose() { active = false },
  }
}
