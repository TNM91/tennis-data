import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getClientAuthState: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { getClientAuthState } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import {
  listTiqLeagueScheduleItems,
  saveTiqLeagueScheduleItem,
  updateTiqLeagueScheduleStatus,
  type TiqLeagueScheduleItem,
} from '../tiq-league-schedule-service'

const STORAGE_KEY = 'tenaceiq_tiq_league_schedule_items'

type QueryResult = {
  data: unknown
  error: unknown
}

function makeQuery(result: QueryResult) {
  const chain: Record<string, unknown> = {
    data: result.data,
    error: result.error,
  }

  for (const method of ['select', 'eq', 'neq', 'order', 'insert', 'update']) {
    chain[method] = vi.fn(() => chain)
  }
  chain.single = vi.fn(async () => result)

  return chain
}

function installLocalSchedule(items: Partial<TiqLeagueScheduleItem>[] = []) {
  const store = new Map<string, string>([[STORAGE_KEY, JSON.stringify(items)]])
  const localStorage = {
    getItem: vi.fn((key: string) => store.get(key) || null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
  }

  vi.stubGlobal('window', { localStorage })

  return {
    read() {
      return JSON.parse(store.get(STORAGE_KEY) || '[]') as TiqLeagueScheduleItem[]
    },
  }
}

function scheduleItem(overrides: Partial<TiqLeagueScheduleItem>): TiqLeagueScheduleItem {
  return {
    id: 'schedule-1',
    leagueId: 'league-1',
    leagueFormat: 'individual',
    participantAName: 'Alice',
    participantAId: '',
    participantBName: 'Bob',
    participantBId: '',
    scheduledDate: '2026-02-01',
    scheduledTime: '09:00',
    facility: 'Court 1',
    status: 'confirmed',
    notes: '',
    proposedByUserId: 'user-1',
    confirmedByUserId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('tiq league schedule service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getClientAuthState as Mock).mockResolvedValue({ user: { id: 'user-1' } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists Supabase schedule items with normalized fields', async () => {
    const fromMock = supabase.from as Mock
    fromMock.mockReturnValue(makeQuery({
      data: [
        {
          id: 'schedule-1',
          league_id: 'league-1',
          league_format: 'INDIVIDUAL',
          participant_a_name: ' Alice ',
          participant_b_name: ' Bob ',
          scheduled_date: '2026-02-01',
          scheduled_time: '09:00',
          status: 'unknown',
        },
      ],
      error: null,
    }))

    const result = await listTiqLeagueScheduleItems(' league-1 ')

    expect(result.source).toBe('supabase')
    expect(result.warning).toBeNull()
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'schedule-1',
        leagueId: 'league-1',
        leagueFormat: 'individual',
        participantAName: 'Alice',
        participantBName: 'Bob',
        status: 'proposed',
      }),
    ])
  })

  it('falls back to sorted local schedule items when Supabase is unavailable', async () => {
    installLocalSchedule([
      scheduleItem({ id: 'late', scheduledDate: '2026-02-05', scheduledTime: '18:00' }),
      scheduleItem({ id: 'cancelled', status: 'cancelled', scheduledDate: '2026-02-01' }),
      scheduleItem({ id: 'other-league', leagueId: 'league-2', scheduledDate: '2026-02-01' }),
      scheduleItem({ id: 'early', scheduledDate: '2026-02-01', scheduledTime: '08:00' }),
    ])
    ;(supabase.from as Mock).mockReturnValue(makeQuery({ data: null, error: { message: 'offline' } }))

    const result = await listTiqLeagueScheduleItems('league-1')

    expect(result.source).toBe('local')
    expect(result.warning).toContain('cloud sync catches up')
    expect(result.items.map((item) => item.id)).toEqual(['early', 'late'])
  })

  it('requires sign-in before saving a schedule item', async () => {
    ;(getClientAuthState as Mock).mockResolvedValue({ user: null })

    const result = await saveTiqLeagueScheduleItem({
      leagueId: 'league-1',
      leagueFormat: 'individual',
      participantAName: 'Alice',
      participantBName: 'Bob',
      scheduledDate: '2026-02-01',
      status: 'proposed',
    })

    expect(result).toEqual({
      item: null,
      source: 'local',
      warning: 'Sign in to schedule this TIQ league match.',
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('stores a clean local copy when saving cannot reach Supabase', async () => {
    const local = installLocalSchedule()
    const query = makeQuery({ data: null, error: { message: 'offline' } })
    ;(supabase.from as Mock).mockReturnValue(query)

    const result = await saveTiqLeagueScheduleItem({
      leagueId: ' league-1 ',
      leagueFormat: 'team',
      participantAName: ' Team A ',
      participantBName: ' Team B ',
      scheduledDate: ' 2026-02-01 ',
      scheduledTime: ' 19:00 ',
      facility: ' Courts 1-2 ',
      status: 'coordinator_set',
      notes: ' Warm up at 6:45 ',
    })

    expect(result.source).toBe('local')
    expect(result.warning).toContain('Cloud sync will retry later')
    expect(result.item).toEqual(expect.objectContaining({
      leagueId: 'league-1',
      participantAName: 'Team A',
      participantBName: 'Team B',
      scheduledDate: '2026-02-01',
      scheduledTime: '19:00',
      facility: 'Courts 1-2',
      status: 'coordinator_set',
      confirmedByUserId: 'user-1',
    }))
    expect(local.read()).toHaveLength(1)
  })

  it('updates local schedule status when Supabase status updates fail', async () => {
    const local = installLocalSchedule([
      scheduleItem({ id: 'schedule-1', status: 'confirmed', confirmedByUserId: 'old-user' }),
    ])
    ;(supabase.from as Mock).mockReturnValue(makeQuery({ data: null, error: { message: 'offline' } }))

    const result = await updateTiqLeagueScheduleStatus({
      scheduleItemId: 'schedule-1',
      status: 'completed',
    })

    expect(result.source).toBe('local')
    expect(result.item).toEqual(expect.objectContaining({
      id: 'schedule-1',
      status: 'completed',
      confirmedByUserId: '',
    }))
    expect(local.read()[0]).toEqual(expect.objectContaining({ status: 'completed' }))
  })
})
