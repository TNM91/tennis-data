import { describe, expect, it } from 'vitest'
import {
  buildPlatformResumeCandidates,
  mergePlatformResumeCandidates,
  sanitizePlatformResumeCandidates,
} from '../platform-resume'

describe('platform resume', () => {
  it('orders meaningful work across lanes and turns a captain room into Team Chat', () => {
    const candidates = buildPlatformResumeCandidates({
      captain: {
        lastTool: 'team-room',
        lastToolLabel: 'Team room',
        team: 'SuperSmash Bros',
        lastHref: '/team-room?team=SuperSmash+Bros',
        lastVisitedAt: '2026-08-03T15:00:00.000Z',
      },
      compete: {
        lastSurface: 'matchup',
        lastSurfaceLabel: 'Matchup',
        matchupLabel: 'Lee vs Diaz',
        lastHref: '/matchup?a=Lee&b=Diaz',
        lastVisitedAt: '2026-08-03T14:00:00.000Z',
      },
      explore: {
        lastSurface: 'explore',
        lastVisitedAt: '2026-08-03T16:00:00.000Z',
      },
    })

    expect(candidates.map((item) => item.lane)).toEqual(['Team Chat', 'Compete'])
    expect(candidates[0]).toMatchObject({ label: 'SuperSmash Bros', href: '/team-room?team=SuperSmash+Bros' })
  })

  it('uses the newest device or cloud state per lane and removes duplicate destinations', () => {
    const local = [
      { id: 'coach' as const, lane: 'Coach', label: 'Assignment', context: 'Avery', href: '/coach#assignment', visitedAt: '2026-08-03T13:00:00.000Z' },
      { id: 'improve' as const, lane: 'Messages', label: 'Coach message', context: '', href: '/messages?thread=1', visitedAt: '2026-08-03T12:00:00.000Z' },
    ]
    const cloud = [
      { id: 'coach' as const, lane: 'Coach', label: 'Bench', context: '', href: '/coach', visitedAt: '2026-08-03T11:00:00.000Z' },
      { id: 'league' as const, lane: 'Messages', label: 'League message', context: '', href: '/messages?thread=1', visitedAt: '2026-08-03T14:00:00.000Z' },
    ]

    expect(mergePlatformResumeCandidates(local, cloud)).toEqual([
      cloud[1],
      local[0],
    ])
  })

  it('rejects unsafe or malformed API candidates', () => {
    expect(sanitizePlatformResumeCandidates([
      { id: 'captain', lane: 'Captain', label: 'Lineup', context: '', href: '/captain/lineup-builder', visitedAt: '2026-08-03T15:00:00.000Z' },
      { id: 'coach', lane: 'Coach', label: 'Player', context: '', href: '//example.com', visitedAt: '2026-08-03T15:00:00.000Z' },
      { id: 'unknown', lane: 'Other', label: 'Other', context: '', href: '/other', visitedAt: '2026-08-03T15:00:00.000Z' },
    ])).toHaveLength(1)
  })
})
