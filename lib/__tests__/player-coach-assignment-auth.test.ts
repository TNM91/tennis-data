vi.mock('../native-coach-activity-push',()=>({scheduleCoachActivityPush:vi.fn()}))
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { GET } from '../../app/api/player/coach-assignments/route'
import { createTacticalTemplate } from '../tactical/templates'

const auth = vi.hoisted(() => vi.fn())
vi.mock('../player-api-auth', () => ({getSignedInPlayerApiAuth: auth}))

const source = readFileSync(join(process.cwd(), 'app/api/player/coach-assignments/route.ts'), 'utf8')

describe('player coach assignment ownership', () => {
  it('requires the assignment link to belong to the signed-in player before completion', () => {
    expect(source).toContain('getSignedInPlayerApiAuth')
    expect(source).toContain(".from('coach_player_links')")
    expect(source).toContain(".eq('id', existing.studentLinkId)")
    expect(source).toContain(".eq('player_user_id', auth.userId)")
    expect(source).toContain("if (!linkData)")
    expect(source).toContain("Assignment was not found for this player.")
    expect(source).toContain(".eq('student_link_id', existing.studentLinkId)")
  })

  it('delivers a shared snapshot only to the linked player, separately from the inbox list', async () => {
    const now = '2026-11-18T12:00:00Z'
    const board = {...createTacticalTemplate('poach'), note: '', cues: []}
    const reference = {id: board.id, updatedAt: now}
    const rows: Record<string, Record<string, unknown>[]> = {
      coach_player_links: [{id: 'link', player_user_id: 'player', status: 'active', updated_at: now}],
      coach_assignments: [
        {id: 'practice', student_link_id: 'link', status: 'assigned', title: 'Poach', updated_at: now,
          assignment_json: {tactics: reference, tacticsBoard: {reference, board}}},
        {id: 'draft', student_link_id: 'link', status: 'draft', title: 'Draft', updated_at: now,
          assignment_json: {tactics: reference, tacticsBoard: {reference, board}}},
      ],
    }
    const supabase = {from: (table: string) => {
      let matches = rows[table]
      const query = {
        select: () => query, limit: () => query, order: () => query,
        eq: (key: string, value: unknown) => { matches = matches.filter(row => row[key] === value); return query },
        in: (key: string, values: unknown[]) => { matches = matches.filter(row => values.includes(row[key])); return query },
        maybeSingle: async () => ({data: matches[0] ?? null}),
        then: (resolve: (result: {data: typeof matches}) => unknown) => Promise.resolve({data: matches}).then(resolve),
      }
      return query
    }}
    const base = 'https://example.test/api/player/coach-assignments'
    const get = (suffix = '') => GET(new Request(base + suffix))
    auth.mockResolvedValue({ok: true, userId: 'player', supabase})
    const list = await (await get()).json()
    expect(list.assignments).toHaveLength(1)
    expect(list.assignments[0].assignment).toEqual({tactics: reference})
    const shared = await get('?board=practice')
    expect(shared.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await shared.json()).toMatchObject({ok: true, assignmentId: 'practice', tactics: {reference, board: {id: board.id}}})
    expect((await get('?board=draft')).status).toBe(404)
    auth.mockResolvedValue({ok: true, userId: 'other', supabase})
    expect((await get('?board=practice')).status).toBe(404)
  })
})
