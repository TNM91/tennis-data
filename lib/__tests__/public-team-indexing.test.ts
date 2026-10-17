import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicTeamEvidence } from '../public-competition-evidence'
const mocks = vi.hoisted(() => ({ profile: vi.fn() }))
vi.mock('../public-competition-evidence-server', () => ({ getPublicTeamProfile: mocks.profile }))
vi.mock('../route-metadata', () => ({ buildRouteMetadata: (input: { title: string; description: string; path: string }) => ({ title: input.title, description: input.description, alternates: { canonical: input.path } }) }))
vi.mock('../share-card', () => ({ buildShareCardImageUrl: () => '/share-card.png' }))
vi.mock('@/app/components/public-team-profile-snapshot', () => ({ default: () => null }))
vi.mock('@/app/components/public-competition-content-context', () => ({ PublicCompetitionContentProvider: () => null }))
import { generateMetadata } from '../../app/teams/[team]/layout'

const evidence: PublicTeamEvidence = { name: 'Ace/Deuce', results: Array.from({ length: 3 }, (_, i) => ({ id: String(i), date: '2026-10-05', opponent: 'Court Crew', league: 'Local', flight: '4.0', format: 'doubles', score: '6-4 6-3', result: 'W' })) }
const params = Promise.resolve({ team: 'Ace~2FDeuce' })
describe('public team indexing', () => {
  beforeEach(() => vi.clearAllMocks())
  it('decodes slashes and uses a routable canonical for evidenced teams', async () => {
    mocks.profile.mockResolvedValue(evidence)
    const metadata = await generateMetadata({ params })
    expect(mocks.profile).toHaveBeenCalledWith('Ace/Deuce')
    expect(metadata).toMatchObject({ alternates: { canonical: '/teams/Ace~2FDeuce' } })
    expect(metadata.robots).toBeUndefined()
  })
  it('excludes sparse team pages while keeping their canonical', async () => {
    mocks.profile.mockResolvedValue({ ...evidence, results: evidence.results.slice(0, 2) })
    expect(await generateMetadata({ params })).toMatchObject({ robots: { index: false, follow: true }, alternates: { canonical: '/teams/Ace~2FDeuce' } })
  })
  it('does not index invalid team names', async () => {
    mocks.profile.mockResolvedValue(null)
    expect(await generateMetadata({ params })).toEqual({ robots: { index: false, follow: true } })
  })
  it('does not convert a database outage into a thin page', async () => {
    mocks.profile.mockRejectedValue(new Error('Public team data unavailable'))
    await expect(generateMetadata({ params })).rejects.toThrow('Public team data unavailable')
  })
})
