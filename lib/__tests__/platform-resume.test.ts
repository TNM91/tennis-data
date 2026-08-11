import { describe, expect, it } from 'vitest'
import {
  applyPlatformResumeHandoff,
  buildPlatformResumeHandoff,
  buildPlatformResumeCandidates,
  getPlatformResumeDetail,
  mergePlatformResumeCandidates,
  sanitizePlatformResumeCandidates,
  type PlatformResumeCandidate,
} from '../platform-resume'

function recentCandidate(
  input: Omit<PlatformResumeCandidate, 'status' | 'actionLabel' | 'reason' | 'priority'>,
): PlatformResumeCandidate {
  return { ...input, status: 'recent', actionLabel: `Continue ${input.lane}`, reason: '', priority: 0 }
}

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
    expect(candidates[0]).toMatchObject({
      label: 'SuperSmash Bros',
      href: '/team-room?team=SuperSmash+Bros',
      status: 'recent',
    })
  })

  it('puts real unfinished Captain work ahead of newer browsing history', () => {
    const candidates = buildPlatformResumeCandidates({
      captain: {
        lastTool: 'lineup-builder',
        lastToolLabel: 'Lineup Builder',
        team: 'SuperSmash Bros',
        league: 'Tri-Level',
        flight: '3.5/4.0/4.5',
        pendingResponseCount: 3,
        lastVisitedAt: '2026-08-03T12:00:00.000Z',
      },
      explore: {
        lastSurface: 'player',
        contextLabel: 'Casey Lee',
        lastHref: '/players/1',
        lastVisitedAt: '2026-08-03T16:00:00.000Z',
      },
    })

    expect(candidates[0]).toMatchObject({
      id: 'captain',
      status: 'unfinished',
      actionLabel: 'Check replies',
      reason: '3 players still need to answer',
    })
    expect(candidates[0].href).toContain('/captain/availability?')
  })

  it('puts an upcoming match action ahead of a higher-priority generic draft', () => {
    const now = Date.parse('2026-08-03T12:00:00')
    const candidates = buildPlatformResumeCandidates({
      captain: {
        lastTool: 'lineup-builder',
        team: 'SuperSmash Bros',
        eventDate: '2026-08-04',
        weekStatus: 'draft-lineup',
        lineupCount: 2,
        lastVisitedAt: '2026-08-01T12:00:00.000Z',
      },
      improve: {
        lastSurface: 'conversation',
        conversationDraft: 'Coach, I tried it...',
        lastVisitedAt: '2026-08-03T11:00:00.000Z',
      },
    }, now)

    expect(candidates.map((item) => item.id)).toEqual(['captain', 'improve'])
    expect(candidates[0]).toMatchObject({ actionLabel: 'Finish lineup', dueAt: '2026-08-04' })
    expect(getPlatformResumeDetail(candidates[0], now)).toContain('Tomorrow')
  })

  it('keeps an old past-due draft available without letting it dominate current work', () => {
    const now = Date.parse('2026-08-03T12:00:00')
    const candidates = buildPlatformResumeCandidates({
      captain: {
        lastTool: 'lineup-builder',
        team: 'SuperSmash Bros',
        eventDate: '2026-07-20',
        weekStatus: 'draft-lineup',
        lineupCount: 2,
        lastVisitedAt: '2026-07-20T12:00:00.000Z',
      },
      improve: {
        lastSurface: 'conversation',
        conversationDraft: 'Coach, I tried it...',
        lastVisitedAt: '2026-08-03T11:00:00.000Z',
      },
    }, now)

    expect(candidates.map((item) => item.id)).toEqual(['improve', 'captain'])
    expect(getPlatformResumeDetail(candidates[1], now)).toContain('Past due')
  })

  it('uses Coach and League dates in the same urgency model', () => {
    const now = Date.parse('2026-08-03T12:00:00')
    const candidates = buildPlatformResumeCandidates({
      coach: {
        lastSurface: 'assignment',
        playerName: 'Avery',
        assignmentDraft: { title: 'Serve pattern', dueDate: '2026-08-06' },
        lastVisitedAt: '2026-08-03T10:00:00.000Z',
      },
      league: {
        lastSurface: 'tournament',
        tournamentDraft: { name: 'Summer Cup', startsOn: '2026-08-10' },
        lastVisitedAt: '2026-08-03T11:00:00.000Z',
      },
    }, now)

    expect(candidates.find((item) => item.id === 'coach')?.dueAt).toBe('2026-08-06')
    expect(candidates.find((item) => item.id === 'league')?.dueAt).toBe('2026-08-10')
    expect(getPlatformResumeDetail(candidates.find((item) => item.id === 'coach')!, now)).toContain('In 3 days')
  })

  it('recognizes unsent messages, assignments, training, and league drafts', () => {
    const candidates = buildPlatformResumeCandidates({
      captain: {
        lastTool: 'team-room',
        teamRoomId: 'room-1',
        team: 'SuperSmash Bros',
        lastHref: '/team-room?team=SuperSmash+Bros',
        lastVisitedAt: '2026-08-03T12:00:00.000Z',
      },
      teamRoomDraftPending: true,
      coach: {
        lastSurface: 'assignment',
        playerName: 'Avery',
        assignmentDraft: { title: 'Serve pattern' },
        lastVisitedAt: '2026-08-03T15:00:00.000Z',
      },
      improve: {
        lastSurface: 'conversation',
        conversationId: 'thread-1',
        conversationDraft: 'Coach, I tried it...',
        lastVisitedAt: '2026-08-03T14:00:00.000Z',
      },
      league: {
        lastSurface: 'team-results',
        leagueName: 'Summer League',
        teamResultDraft: { teamAName: 'A', teamBName: 'B' },
        lastVisitedAt: '2026-08-03T13:00:00.000Z',
      },
    })

    expect(candidates.map((item) => item.actionLabel)).toEqual([
      'Finish message',
      'Finish reply',
      'Finish team result',
      'Finish assignment',
    ])
    expect(candidates.find((item) => item.id === 'coach')?.href).toContain('/coach#coach-lesson-frame')
  })

  it('guides a Captain through availability, lineup, then communication', () => {
    const captain = {
      lastTool: 'team-room' as const,
      team: 'SuperSmash Bros',
      eventDate: '2026-08-04',
      weekStatus: 'draft-lineup' as const,
      lineupCount: 2,
      lastVisitedAt: '2026-08-03T12:00:00.000Z',
    }

    const waitingOnPlayers = buildPlatformResumeCandidates({
      captain: { ...captain, pendingResponseCount: 2 },
      teamRoomDraftPending: true,
    })
    const readyToBuild = buildPlatformResumeCandidates({
      captain: { ...captain, lineupCount: 0 },
      teamRoomDraftPending: true,
    })
    const lineupInProgress = buildPlatformResumeCandidates({ captain })
    const readyToSend = buildPlatformResumeCandidates({
      captain: { ...captain, weekStatus: 'ready-to-send' },
    })

    expect(waitingOnPlayers[0].actionLabel).toBe('Check replies')
    expect(readyToBuild[0]).toMatchObject({ actionLabel: 'Build lineup', status: 'unfinished' })
    expect(lineupInProgress[0].actionLabel).toBe('Finish lineup')
    expect(readyToSend[0].actionLabel).toBe('Send lineup')
  })

  it('promotes the next action in the same lane when work is completed', () => {
    const previous = buildPlatformResumeCandidates({
      captain: {
        lastTool: 'availability',
        team: 'SuperSmash Bros',
        eventDate: '2026-08-04',
        pendingResponseCount: 2,
        weekStatus: 'draft-lineup',
        lineupCount: 0,
        lastVisitedAt: '2026-08-03T12:00:00.000Z',
      },
    })
    const next = buildPlatformResumeCandidates({
      captain: {
        lastTool: 'availability',
        team: 'SuperSmash Bros',
        eventDate: '2026-08-04',
        pendingResponseCount: 0,
        weekStatus: 'draft-lineup',
        lineupCount: 0,
        lastVisitedAt: '2026-08-03T12:01:00.000Z',
      },
      improve: {
        lastSurface: 'conversation',
        conversationDraft: 'Still writing',
        lastVisitedAt: '2026-08-03T12:02:00.000Z',
      },
    })

    const handoff = buildPlatformResumeHandoff(previous, next)
    const promoted = applyPlatformResumeHandoff(next, handoff)

    expect(handoff).toMatchObject({
      completedActionLabel: 'Check replies',
      candidate: {
        id: 'captain',
        actionLabel: 'Build lineup',
        handoff: true,
      },
    })
    expect(promoted.map((candidate) => candidate.id)).toEqual(['captain', 'improve'])
  })

  it('turns a completed lineup send into the match-day handoff', () => {
    const previous = buildPlatformResumeCandidates({
      captain: {
        lastTool: 'messaging',
        team: 'SuperSmash Bros',
        eventDate: '2026-08-04',
        weekStatus: 'ready-to-send',
        lineupCount: 3,
        lastVisitedAt: '2026-08-03T12:00:00.000Z',
      },
    })
    const next = buildPlatformResumeCandidates({
      captain: {
        lastTool: 'messaging',
        team: 'SuperSmash Bros',
        eventDate: '2026-08-04',
        weekStatus: 'finalized',
        lineupCount: 3,
        lastVisitedAt: '2026-08-03T12:01:00.000Z',
      },
    })

    expect(buildPlatformResumeHandoff(previous, next)?.candidate).toMatchObject({
      actionLabel: 'Open match day',
      reason: 'The team update is handled',
      href: '/captain?team=SuperSmash+Bros&date=2026-08-04#captain-match-day-command-strip',
      handoff: true,
    })
  })

  it('uses role-specific next steps after Coach and League saves', () => {
    const coachPrevious = buildPlatformResumeCandidates({
      coach: {
        lastSurface: 'assignment',
        studentLinkId: 'student-1',
        playerName: 'Avery',
        assignmentDraft: { title: 'Serve pattern' },
        lastVisitedAt: '2026-08-03T12:00:00.000Z',
      },
    })
    const coachNext = buildPlatformResumeCandidates({
      coach: {
        lastSurface: 'assignment',
        studentLinkId: 'student-1',
        playerName: 'Avery',
        assignmentId: 'assignment-1',
        lastVisitedAt: '2026-08-03T12:01:00.000Z',
      },
    })
    const leaguePrevious = buildPlatformResumeCandidates({
      league: {
        lastSurface: 'team-results',
        leagueId: 'league-1',
        leagueName: 'Summer League',
        teamResultDraft: { teamAName: 'A', teamBName: 'B' },
        lastVisitedAt: '2026-08-03T12:00:00.000Z',
      },
    })
    const leagueNext = buildPlatformResumeCandidates({
      league: {
        lastSurface: 'team-results',
        leagueId: 'league-1',
        leagueName: 'Summer League',
        lastVisitedAt: '2026-08-03T12:01:00.000Z',
      },
    })

    expect(buildPlatformResumeHandoff(coachPrevious, coachNext)?.candidate).toMatchObject({
      actionLabel: 'Open player bench',
      href: '/coach?studentLinkId=student-1#coach-linked-dashboard',
    })
    expect(buildPlatformResumeHandoff(leaguePrevious, leagueNext)?.candidate).toMatchObject({
      actionLabel: 'Review results',
      href: '/league-coordinator/results?leagueId=league-1',
    })
  })

  it('does not create a handoff while the same task is still open', () => {
    const candidates = buildPlatformResumeCandidates({
      coach: {
        lastSurface: 'assignment',
        playerName: 'Avery',
        assignmentDraft: { title: 'Serve pattern' },
        lastVisitedAt: '2026-08-03T12:00:00.000Z',
      },
    })

    expect(buildPlatformResumeHandoff(candidates, candidates)).toBeNull()
  })

  it('starts a linked upcoming match with availability from Captain home', () => {
    const now = Date.parse('2026-08-03T12:00:00')
    const candidates = buildPlatformResumeCandidates({
      captain: {
        lastTool: 'hub',
        team: 'SuperSmash Bros',
        league: 'Tri-Level',
        flight: '3.5/4.0/4.5',
        eventDate: '2026-08-04',
        opponentTeam: 'Topspin Club',
        lastVisitedAt: '2026-08-03T10:00:00.000Z',
      },
    }, now)

    expect(candidates[0]).toMatchObject({
      id: 'captain',
      actionLabel: 'Check availability',
      reason: 'Start with player availability',
      dueAt: '2026-08-04',
    })
    expect(candidates[0].href).toContain('/captain/availability?')
    expect(getPlatformResumeDetail(candidates[0], now)).toContain('Tomorrow')
  })

  it('uses the newest device or cloud state and lets an equal local draft add its action signal', () => {
    const local = [recentCandidate({
      id: 'coach', lane: 'Coach', label: 'Assignment', context: 'Avery', href: '/coach#assignment', visitedAt: '2026-08-03T13:00:00.000Z',
    }), {
      ...recentCandidate({
        id: 'captain', lane: 'Team Chat', label: 'Team', context: '', href: '/team-room?team=Team', visitedAt: '2026-08-03T12:00:00.000Z',
      }),
      status: 'unfinished' as const,
      actionLabel: 'Finish message',
      reason: 'Unsent team message',
      priority: 140,
    }]
    const cloud = [recentCandidate({
      id: 'coach', lane: 'Coach', label: 'Bench', context: '', href: '/coach', visitedAt: '2026-08-03T11:00:00.000Z',
    }), recentCandidate({
      id: 'captain', lane: 'Team Chat', label: 'Team', context: '', href: '/team-room?team=Team', visitedAt: '2026-08-03T12:00:00.000Z',
    })]

    expect(mergePlatformResumeCandidates(local, cloud)).toEqual([
      local[1],
      local[0],
    ])
  })

  it('rejects unsafe or malformed API candidates', () => {
    expect(sanitizePlatformResumeCandidates([
      { id: 'captain', lane: 'Captain', label: 'Lineup', context: '', href: '/captain/lineup-builder', visitedAt: '2026-08-03T15:00:00.000Z', status: 'unfinished', actionLabel: 'Finish lineup', reason: '2 courts in draft', priority: 110, dueAt: '2026-08-04' },
      { id: 'coach', lane: 'Coach', label: 'Player', context: '', href: '//example.com', visitedAt: '2026-08-03T15:00:00.000Z', status: 'recent' },
      { id: 'unknown', lane: 'Other', label: 'Other', context: '', href: '/other', visitedAt: '2026-08-03T15:00:00.000Z', status: 'recent' },
    ])).toEqual([expect.objectContaining({ dueAt: '2026-08-04' })])
  })
})
