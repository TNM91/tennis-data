import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicPlayerEvidence } from '../public-player-evidence'

const mocks = vi.hoisted(() => ({ profile: vi.fn(), metadata: vi.fn() }))
vi.mock('../public-player-evidence-server', () => ({ getPublicPlayerProfile: mocks.profile }))
vi.mock('../route-metadata', () => ({ getPlayerMetadataById: mocks.metadata }))
vi.mock('@/app/components/public-player-evidence', () => ({ PublicPlayerSnapshot: () => null }))
vi.mock('@/app/components/public-player-content-context', () => ({ PublicPlayerContentProvider: () => null }))

import { generateMetadata } from '../../app/players/[id]/layout'

const id = '00000000-0000-0000-0000-000000000001'
const params = Promise.resolve({ id })
const profile: PublicPlayerEvidence = {
  player: { id, name: 'Alex', location: null },
  results: Array.from({ length: 3 }, (_, i) => ({ id: String(i), date: '2026-10-01', format: 'singles', score: '6-4 6-3', result: 'W', opponents: [], partner: null, competition: null })),
}

describe('public player indexing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.metadata.mockResolvedValue({ title: 'Alex Player Profile', alternates: { canonical: `/players/${id}` } })
  })
  it('preserves metadata and indexability for profiles with sufficient scored evidence', async () => {
    mocks.profile.mockResolvedValue(profile)
    expect(await generateMetadata({ params })).toEqual({ title: 'Alex Player Profile', alternates: { canonical: `/players/${id}` } })
  })
  it('keeps sparse profiles accessible but excludes them from indexing', async () => {
    mocks.profile.mockResolvedValue({ ...profile, results: profile.results.slice(0, 2) })
    expect(await generateMetadata({ params })).toMatchObject({ robots: { index: false, follow: true }, alternates: { canonical: `/players/${id}` } })
  })
  it('excludes confirmed missing profiles without describing them as real players', async () => {
    mocks.profile.mockResolvedValue(null)
    expect(await generateMetadata({ params })).toEqual({ robots: { index: false, follow: true } })
    expect(mocks.metadata).not.toHaveBeenCalled()
  })
  it('does not convert a database outage into a cached missing or thin profile', async () => {
    mocks.profile.mockRejectedValue(new Error('Public data unavailable'))
    await expect(generateMetadata({ params })).rejects.toThrow('Public data unavailable')
  })
})
