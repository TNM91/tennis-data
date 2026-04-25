import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import {
  normalizePlayerName,
  deriveWinnerSide,
  syncTiqIndividualResultToMatch,
} from '../tiq-match-sync'

// ─── Chain mock helper ────────────────────────────────────────────────────────

type ChainResult = { data: unknown; error: unknown }

function makeChain(result: ChainResult | (() => ChainResult)) {
  const resolve = () => Promise.resolve(typeof result === 'function' ? result() : result)
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'ilike', 'not', 'in', 'order', 'upsert', 'insert', 'update', 'delete']) {
    chain[method] = () => chain
  }
  chain['single'] = resolve
  chain['maybeSingle'] = resolve
  return chain
}

function setupFrom(responses: Record<string, ChainResult>) {
  const fromMock = supabase.from as Mock
  fromMock.mockImplementation((table: string) => makeChain(responses[table] ?? { data: null, error: null }))
}

// ─── normalizePlayerName ──────────────────────────────────────────────────────

describe('normalizePlayerName', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizePlayerName('  John Smith  ')).toBe('John Smith')
  })

  it('collapses multiple internal spaces into one', () => {
    expect(normalizePlayerName('John  Smith')).toBe('John Smith')
  })

  it('collapses tabs and mixed whitespace', () => {
    expect(normalizePlayerName('John\t Smith')).toBe('John Smith')
  })

  it('leaves a normal name unchanged', () => {
    expect(normalizePlayerName('Jane Doe')).toBe('Jane Doe')
  })

  it('handles an empty string', () => {
    expect(normalizePlayerName('')).toBe('')
  })

  it('handles a single name with no spaces', () => {
    expect(normalizePlayerName('  Serena  ')).toBe('Serena')
  })
})

// ─── deriveWinnerSide ─────────────────────────────────────────────────────────

describe('deriveWinnerSide', () => {
  const base = {
    id: 'r1',
    league_id: 'league-1',
    player_a_id: 'p-a',
    player_a_name: 'Alice',
    player_b_id: 'p-b',
    player_b_name: 'Bob',
    score: '6-3, 6-2',
    result_date: '2026-04-01',
  }

  it('returns A when winner_player_id matches player_a_id', () => {
    expect(deriveWinnerSide({ ...base, winner_player_id: 'p-a', winner_player_name: 'Alice' })).toBe('A')
  })

  it('returns B when winner_player_id matches player_b_id', () => {
    expect(deriveWinnerSide({ ...base, winner_player_id: 'p-b', winner_player_name: 'Bob' })).toBe('B')
  })

  it('falls back to name comparison when winner_player_id is null', () => {
    expect(deriveWinnerSide({ ...base, winner_player_id: null, winner_player_name: 'Alice' })).toBe('A')
    expect(deriveWinnerSide({ ...base, winner_player_id: null, winner_player_name: 'Bob' })).toBe('B')
  })

  it('returns null when winner cannot be matched', () => {
    expect(deriveWinnerSide({ ...base, winner_player_id: null, winner_player_name: 'Charlie' })).toBeNull()
  })

  it('id match takes priority over mismatched name', () => {
    expect(deriveWinnerSide({ ...base, winner_player_id: 'p-a', winner_player_name: 'Bob' })).toBe('A')
  })
})

// ─── syncTiqIndividualResultToMatch — player resolution ──────────────────────

describe('syncTiqIndividualResultToMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const result = {
    id: 'result-1',
    league_id: 'league-1',
    player_a_id: 'p-a',
    player_a_name: 'Alice',
    player_b_id: 'p-b',
    player_b_name: 'Bob',
    winner_player_id: 'p-a',
    winner_player_name: 'Alice',
    score: '6-3, 6-2',
    result_date: '2026-04-01T00:00:00Z',
  }

  it('resolves players by existing ID and syncs without creating new players', async () => {
    const insertSpy = vi.fn().mockReturnValue(makeChain({ data: null, error: null }))
    const fromMock = supabase.from as Mock

    fromMock.mockImplementation((table: string) => {
      if (table === 'players') {
        return makeChain({ data: { id: 'resolved-id' }, error: null })
      }
      if (table === 'matches') {
        return makeChain({ data: { id: 'match-1' }, error: null })
      }
      // match_players
      const chain = makeChain({ data: null, error: null })
      ;(chain as Record<string, unknown>)['insert'] = insertSpy
      return chain
    })

    await syncTiqIndividualResultToMatch(result)

    expect(insertSpy).toHaveBeenCalledOnce()
    const inserted = insertSpy.mock.calls[0][0] as Array<{ player_id: string }>
    expect(inserted.some((r) => r.player_id === 'resolved-id')).toBe(true)
  })

  it('creates a new player when neither ID nor name resolves to an existing record', async () => {
    const fromMock = supabase.from as Mock
    let createdPlayer = false

    fromMock.mockImplementation((table: string) => {
      if (table === 'players') {
        const chain = makeChain({ data: null, error: null })
        ;(chain as Record<string, unknown>)['insert'] = () => {
          createdPlayer = true
          return makeChain({ data: { id: 'new-player-id' }, error: null })
        }
        return chain
      }
      if (table === 'matches') {
        return makeChain({ data: { id: 'match-1' }, error: null })
      }
      return makeChain({ data: null, error: null })
    })

    await syncTiqIndividualResultToMatch(result)
    expect(createdPlayer).toBe(true)
  })

  it('throws when winner side cannot be determined', async () => {
    const ambiguous = {
      ...result,
      winner_player_id: null,
      winner_player_name: 'Unknown Player',
    }
    await expect(syncTiqIndividualResultToMatch(ambiguous)).rejects.toThrow('Cannot determine winner side')
  })

  it('throws when match upsert fails', async () => {
    const fromMock = supabase.from as Mock
    fromMock.mockImplementation((table: string) => {
      if (table === 'players') return makeChain({ data: { id: 'p-1' }, error: null })
      if (table === 'matches') return makeChain({ data: null, error: { message: 'DB error' } })
      return makeChain({ data: null, error: null })
    })

    await expect(syncTiqIndividualResultToMatch(result)).rejects.toThrow('Failed to sync TIQ individual result')
  })

  it('throws when player resolution returns null for both sides', async () => {
    const fromMock = supabase.from as Mock
    fromMock.mockImplementation((table: string) => {
      if (table === 'players') return makeChain({ data: null, error: { message: 'insert failed' } })
      if (table === 'matches') return makeChain({ data: { id: 'match-1' }, error: null })
      return makeChain({ data: null, error: null })
    })

    await expect(syncTiqIndividualResultToMatch(result)).rejects.toThrow('Failed to resolve players')
  })

  it('uses external_match_id based on the result id', async () => {
    const fromMock = supabase.from as Mock
    let upsertedPayload: Record<string, unknown> | null = null

    fromMock.mockImplementation((table: string) => {
      if (table === 'players') return makeChain({ data: { id: 'p-x' }, error: null })
      if (table === 'matches') {
        const chain = makeChain({ data: { id: 'match-1' }, error: null })
        ;(chain as Record<string, unknown>)['upsert'] = (payload: Record<string, unknown>) => {
          upsertedPayload = payload
          return makeChain({ data: { id: 'match-1' }, error: null })
        }
        return chain
      }
      return makeChain({ data: null, error: null })
    })

    await syncTiqIndividualResultToMatch(result)
    expect((upsertedPayload as unknown as Record<string, unknown>)?.external_match_id).toBe('tiq_ind_result-1')
  })
})
