'use client'
import { useEffect, useRef, useState } from 'react'
import { supabaseUrl, supabaseKey } from './supabase'
import { createGoalSync, GOAL_SYNC_LABELS, type LabGoal, type GoalRecord, type GoalSyncStatus } from './my-lab-goal-sync'

export function useMyLabGoalSync(options: {
  userId: string | null; playerId: string | null; token: string; enabled: boolean
  readLocal: () => LabGoal[]; onGoals: (goals: LabGoal[]) => void
}) {
  const [status, setStatus] = useState<GoalSyncStatus>('device')
  const [readyScope, setReadyScope] = useState('')
  const latest = useRef(options)
  useEffect(() => { latest.current = options })
  const controller = useRef<ReturnType<typeof createGoalSync> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scope = options.enabled && options.userId && options.playerId && options.token ? options.userId + ':' + options.playerId : ''
  useEffect(() => {
    if (!scope) return
    const { userId, playerId, token } = latest.current
    const cacheKey = 'tenaceiq-my-lab-goal-sync-v1:' + scope
    const headers = { apikey: supabaseKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
    // Bind requests to this session token; an account switch cannot redirect queued writes.
    async function request(endpoint: string, init?: RequestInit) {
      const response = await fetch(supabaseUrl + '/rest/v1/' + endpoint, { ...init, headers, signal: AbortSignal.timeout(15000) })
      if (!response.ok) throw new Error('Goal sync unavailable')
      return response.json() as Promise<Array<{ goal_id: string; payload: LabGoal | null; edited_at: string }>>
    }
    const decode = (rows: Array<{ goal_id: string; payload: LabGoal | null; edited_at: string }>): GoalRecord[] => rows.map(row => ({ id: row.goal_id, goal: row.payload, editedAt: new Date(row.edited_at).toISOString() }))
    const sync = createGoalSync({
      transport: {
        load: async () => decode(await request('my_lab_goals?select=goal_id,payload,edited_at&user_id=eq.' + userId + '&player_id=eq.' + encodeURIComponent(playerId || ''))),
        save: async records => {
          if (!records.length) return []
          return decode(await request('rpc/sync_my_lab_goals', { method: 'POST', body: JSON.stringify({ p_player_id: playerId, p_goals: records.map(record => ({ goal_id: record.id, payload: record.goal, edited_at: record.editedAt })) }) }))
        },
      },
      readCache: () => JSON.parse(localStorage.getItem(cacheKey) || '[]') as GoalRecord[],
      writeCache: records => localStorage.setItem(cacheKey, JSON.stringify(records)),
      onGoals: goals => latest.current.onGoals(goals), onStatus: setStatus,
    })
    controller.current = sync
    let active = true
    void sync.start(latest.current.readLocal()).then(() => { if (active) setReadyScope(scope) })
    const retry = () => { void sync.flush() }
    window.addEventListener('online', retry)
    return () => {
      active = false; sync.dispose(); controller.current = null
      if (timer.current) clearTimeout(timer.current)
      window.removeEventListener('online', retry)
    }
  }, [scope, options.token])
  return {
    ready: !scope || readyScope === scope,
    label: scope ? GOAL_SYNC_LABELS[status] : 'Saved on this device',
    canRetry: Boolean(scope) && status === 'device',
    retry: () => { void controller.current?.flush() },
    save: (goals: LabGoal[]) => {
      controller.current?.update(goals)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => { void controller.current?.flush() }, 1000)
    },
  }
}
