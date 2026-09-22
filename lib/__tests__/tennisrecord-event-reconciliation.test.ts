import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { reconcileTennisRecordMatches } from '../tennisrecord/service'

type Op = { name: string; args: unknown[] }
type Call = { table: string; ops: Op[] }
const operation = (c: Call, name: string) => c.ops.find(o => o.name === name)
const url = 'https://www.tennisrecord.com/adult/matchresults.aspx?year=2025&mid=365802'
function fixture(options: { alias?: boolean; failRead?: boolean; failHold?: boolean } = {}) {
  const calls: Call[] = []
  const item = { id: 'incoming', fingerprint: 'fp', source_match_key: 'source-key', source_url: url, participants: [], winner_side: 'B', score_text: '6-2 0-6 1-0' }
  const from = (table: string) => {
    const call: Call = { table, ops: [] }
    const resolve = () => {
      calls.push(call)
      if (operation(call, 'update')) return { data: [], error: options.failHold ? { message: 'hold failed' } : null }
      if (operation(call, 'range')) {
        if (options.failRead) return { data: null, error: { message: 'event read failed' } }
        if (table === 'tennisrecord_canonical_matches') return { data: [{ fingerprint: 'fp' }, ...(options.alias ? [{ fingerprint: 'alias' }] : [])], error: null }
        if (table === 'tennisrecord_staged_matches') return { data: [{ ...item }, { id: 'earlier', fingerprint: options.alias ? 'alias' : 'fp', source_url: url.replace('365802', '365804') }], error: null }
        return { data: [], error: null }
      }
      if (table === 'tennisrecord_staged_matches') return { data: [item], error: null }
      if (table === 'tennisrecord_canonical_matches') return { data: { fingerprint: 'fp', canonical_match_id: 'protected-result' }, error: null }
      throw new Error(`Unexpected access after collision: ${table}`)
    }
    const query: object = new Proxy({}, { get: (_, key: string) => key === 'then'
      ? (done: (r: unknown) => unknown, fail: (e: unknown) => unknown) => Promise.resolve().then(resolve).then(done, fail)
      : (...args: unknown[]) => { call.ops.push({ name: key, args }); return query },
    })
    return query
  }
  return { db: { from } as unknown as SupabaseClient, calls }
}

describe('event identity is rechecked at reconciliation', () => {
  it.each([false, true])('holds a late collision before any result or rating writes (alias=%s)', async alias => {
    const f = fixture({ alias })
    expect(await reconcileTennisRecordMatches(f.db, ['source-key'], false)).toEqual({ created: 0, duplicates: 0, conflicts: 1, ratingChanged: false })
    const writes = f.calls.filter(c => ['update', 'upsert', 'insert', 'delete'].some(name => operation(c, name)))
    expect(writes).toHaveLength(2)
    expect(writes[0].table).toBe('tennisrecord_staged_matches')
    expect(operation(writes[0], 'update')?.args[0]).toMatchObject({ parse_status: 'quarantined', parse_failure_reason: expect.stringContaining('Different source events') })
    expect(operation(writes[0], 'eq')?.args).toEqual(['id', 'incoming'])
    expect(writes[1].table).toBe('tennisrecord_crawl_queue')
    expect(operation(writes[1], 'update')?.args[0]).toMatchObject({ status: 'review' })
    expect(f.calls.some(c => ['players', 'match_players', 'matches', 'tennisrecord_player_identities'].includes(c.table))).toBe(false)
  })
  it('fails before writes if association evidence cannot be read', async () => {
    const f = fixture({ failRead: true })
    await expect(reconcileTennisRecordMatches(f.db, ['source-key'], false)).rejects.toThrow('event read failed')
    expect(f.calls.some(c => ['update', 'upsert', 'insert', 'delete'].some(name => operation(c, name)))).toBe(false)
  })
  it('does not count a failed hold as successful protection', async () => {
    const f = fixture({ failHold: true })
    await expect(reconcileTennisRecordMatches(f.db, ['source-key'], false)).rejects.toThrow('hold failed')
    expect(f.calls.some(c => c.table === 'matches')).toBe(false)
  })
})
