import { beforeEach, describe, expect, it, vi } from 'vitest'

type SupabaseResult = {
  data: unknown
  error: { message: string } | null
}

const supabaseState: {
  results: SupabaseResult[]
  upsertPayloads: unknown[]
} = {
  results: [],
  upsertPayloads: [],
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => supabaseState.results.shift() ?? { data: null, error: null },
        }),
      }),
      upsert: (payload: unknown) => {
        supabaseState.upsertPayloads.push(payload)
        return {
          select: () => ({
            maybeSingle: async () => supabaseState.results.shift() ?? { data: null, error: null },
          }),
        }
      },
    }),
  },
}))

const store = new Map<string, string>()

vi.mock('@/lib/profile-link-storage', () => ({
  isMissingProfileLinkSchemaError: (message: string | null | undefined) => {
    const normalized = (message || '').toLowerCase()
    return (
      normalized.includes('linked_player_id') ||
      normalized.includes('linked_player_name') ||
      normalized.includes('linked_team_name') ||
      normalized.includes('linked_league_name') ||
      normalized.includes('linked_flight') ||
      normalized.includes('linked_team_at')
    )
  },
  readLocalProfileLink: (userId: string | null | undefined) => {
    if (!userId) return null
    return JSON.parse(store.get(`tenaceiq-profile-link-v1:${userId}`) || 'null') as unknown
  },
  writeLocalProfileLink: (userId: string, link: unknown) => {
    store.set(`tenaceiq-profile-link-v1:${userId}`, JSON.stringify(link))
  },
}))

beforeEach(() => {
  supabaseState.results = []
  supabaseState.upsertPayloads = []
  store.clear()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    },
  })
})

describe('user profile links', () => {
  it('falls back to a local link when the cloud profile row has no linked player', async () => {
    const { loadUserProfileLink } = await import('../user-profile')
    store.set(
      'tenaceiq-profile-link-v1:user-1',
      JSON.stringify({
        linked_player_id: 'player-1',
        linked_player_name: 'Linked Player',
        linked_team_name: 'Linked Team',
        linked_league_name: 'Linked League',
      }),
    )
    supabaseState.results = [
      {
        data: {
          linked_player_id: null,
          linked_player_name: null,
          linked_team_name: null,
          linked_league_name: null,
          linked_flight: null,
          profile_photo_url: null,
          message_display_name: null,
        },
        error: null,
      },
    ]

    const result = await loadUserProfileLink('user-1')

    expect(result.source).toBe('local')
    expect(result.data?.linked_player_id).toBe('player-1')
    expect(result.data?.linked_player_name).toBe('Linked Player')
  })

  it('keeps the local linked player when cloud only has display metadata', async () => {
    const { loadUserProfileLink } = await import('../user-profile')
    store.set(
      'tenaceiq-profile-link-v1:user-4',
      JSON.stringify({
        linked_player_id: 'player-4',
        linked_player_name: 'Local Player',
        linked_team_name: 'Local Team',
        linked_league_name: null,
      }),
    )
    supabaseState.results = [
      {
        data: {
          linked_player_id: null,
          linked_player_name: null,
          linked_team_name: null,
          linked_league_name: null,
          linked_flight: null,
          profile_photo_url: null,
          message_display_name: 'Cloud Display',
        },
        error: null,
      },
    ]

    const result = await loadUserProfileLink('user-4')

    expect(result.source).toBe('local')
    expect(result.data?.linked_player_id).toBe('player-4')
    expect(result.data?.linked_player_name).toBe('Local Player')
    expect(result.data?.linked_team_name).toBe('Local Team')
    expect(result.data?.message_display_name).toBe('Cloud Display')
  })

  it('backfills a local player link to the cloud profile when cloud identity is empty', async () => {
    const { loadUserProfileLink } = await import('../user-profile')
    store.set(
      'tenaceiq-profile-link-v1:user-5',
      JSON.stringify({
        linked_player_id: 'player-5',
        linked_player_name: 'Backfill Player',
        linked_team_name: 'Backfill Team',
        linked_league_name: 'Backfill League',
        linked_flight: '4.0',
      }),
    )
    supabaseState.results = [
      {
        data: {
          linked_player_id: null,
          linked_player_name: null,
          linked_team_name: null,
          linked_league_name: null,
          linked_flight: null,
          profile_photo_url: null,
          message_display_name: 'Backfill Display',
        },
        error: null,
      },
    ]

    const result = await loadUserProfileLink('user-5')
    await Promise.resolve()

    expect(result.source).toBe('local')
    expect(result.data?.linked_player_id).toBe('player-5')
    expect(supabaseState.upsertPayloads).toContainEqual({
      id: 'user-5',
      linked_player_id: 'player-5',
      linked_player_name: 'Backfill Player',
      linked_team_name: 'Backfill Team',
      linked_league_name: 'Backfill League',
      linked_flight: '4.0',
    })
  })

  it('backfills local links with a compatibility payload when optional profile columns are unavailable', async () => {
    const { loadUserProfileLink } = await import('../user-profile')
    store.set(
      'tenaceiq-profile-link-v1:user-6',
      JSON.stringify({
        linked_player_id: 'player-6',
        linked_player_name: 'Compatibility Player',
        linked_team_name: 'Compatibility Team',
        linked_league_name: 'Compatibility League',
        linked_flight: '3.5',
      }),
    )
    supabaseState.results = [
      {
        data: {
          linked_player_id: null,
          linked_player_name: null,
          linked_team_name: null,
          linked_league_name: null,
          linked_flight: null,
          profile_photo_url: null,
          message_display_name: null,
        },
        error: null,
      },
      {
        data: null,
        error: { message: 'Could not find the linked_flight column of profiles in the schema cache' },
      },
      {
        data: {
          linked_player_id: 'player-6',
        },
        error: null,
      },
    ]

    const result = await loadUserProfileLink('user-6')
    await Promise.resolve()
    await Promise.resolve()

    expect(result.source).toBe('local')
    expect(supabaseState.upsertPayloads).toContainEqual({
      id: 'user-6',
      linked_player_id: 'player-6',
      linked_player_name: 'Compatibility Player',
      linked_team_name: 'Compatibility Team',
      linked_league_name: 'Compatibility League',
    })
  })

  it('returns the local link when cloud load fails for a non-schema reason', async () => {
    const { loadUserProfileLink } = await import('../user-profile')
    store.set(
      'tenaceiq-profile-link-v1:user-3',
      JSON.stringify({
        linked_player_id: 'player-3',
        linked_player_name: 'Recovered Player',
        linked_team_name: null,
        linked_league_name: null,
      }),
    )
    supabaseState.results = [
      {
        data: null,
        error: { message: 'temporary profile storage failure' },
      },
    ]

    const result = await loadUserProfileLink('user-3')

    expect(result.source).toBe('local')
    expect(result.error?.message).toContain('temporary profile storage failure')
    expect(result.data?.linked_player_id).toBe('player-3')
    expect(result.data?.linked_player_name).toBe('Recovered Player')
  })

  it('keeps a local copy when cloud save fails for a non-schema reason', async () => {
    const { saveUserProfileLink } = await import('../user-profile')
    supabaseState.results = [
      {
        data: null,
        error: { message: 'new row violates row-level security policy' },
      },
    ]

    const payload = {
      linked_player_id: 'player-2',
      linked_player_name: 'Saved Player',
      linked_team_name: 'Saved Team',
      linked_league_name: 'Saved League',
      linked_flight: '4.0',
      linked_team_at: '2026-05-23T00:00:00.000Z',
      profile_photo_url: null,
      message_display_name: null,
    }
    const result = await saveUserProfileLink('user-2', payload)
    const stored = JSON.parse(store.get('tenaceiq-profile-link-v1:user-2') || '{}') as typeof payload

    expect(result.source).toBe('local')
    expect(result.error?.message).toContain('row-level security')
    expect(stored.linked_player_id).toBe('player-2')
    expect(stored.linked_player_name).toBe('Saved Player')
  })

  it('saves profile links with a compatibility payload when optional profile columns are unavailable', async () => {
    const { saveUserProfileLink } = await import('../user-profile')
    supabaseState.results = [
      {
        data: null,
        error: { message: 'Could not find the linked_team_at column of profiles in the schema cache' },
      },
      {
        data: {
          linked_player_id: 'player-7',
          linked_player_name: 'Compatible Save',
          linked_team_name: null,
          linked_league_name: null,
        },
        error: null,
      },
    ]

    const payload = {
      linked_player_id: 'player-7',
      linked_player_name: 'Compatible Save',
      linked_team_name: null,
      linked_league_name: null,
      linked_flight: '4.5',
      linked_team_at: '2026-05-23T00:00:00.000Z',
      profile_photo_url: null,
      message_display_name: null,
    }
    const result = await saveUserProfileLink('user-7', payload)

    expect(result.source).toBe('cloud')
    expect(supabaseState.upsertPayloads).toContainEqual({
      id: 'user-7',
      linked_player_id: 'player-7',
      linked_player_name: 'Compatible Save',
      linked_team_name: null,
      linked_league_name: null,
    })
  })
})
