import { describe, expect, it, vi } from 'vitest'
import {
  buildCoachAssignmentPayload,
  buildCoachStudentLinkPayload,
  buildCoachAssignmentReview,
  buildPlayerAssignmentCompletion,
  buildPlayerAssignmentPackCardCompletion,
  assignmentNeedsCoachReview,
  getCoachAssignmentReview,
  getCoachAssignmentDueState,
  getCoachAssignmentPack,
  getCoachAssignmentPackProgress,
  getCoachAssignmentSummary,
  getPlayerAssignmentCheckIn,
  mapCoachAssignmentRow,
  mapCoachStudentLinkRow,
  normalizeCoachAssignmentStatus,
  normalizeCoachStudentStatus,
  sortCoachAssignmentsForReview,
  sortPlayerAssignmentsForAction,
  type CoachAssignment,
} from '../coach-storage'
import { buildLevelUpSessionPayload, mapLevelUpSessionRow } from '../level-up-sessions'

describe('coach storage helpers', () => {
  it('normalizes student and assignment statuses', () => {
    expect(normalizeCoachStudentStatus('needs_assignment')).toBe('needs_assignment')
    expect(normalizeCoachStudentStatus('unknown')).toBe('active')
    expect(normalizeCoachAssignmentStatus('assigned')).toBe('assigned')
    expect(normalizeCoachAssignmentStatus('late')).toBe('draft')
  })

  it('maps coach student rows to client shape', () => {
    expect(
      mapCoachStudentLinkRow({
        id: 'student-1',
        coach_user_id: 'coach-1',
        player_user_id: null,
        player_id: 'player-1',
        player_name: 'Taylor Player',
        identity_slug: 'relentless-competitor-4-0',
        level_label: '4.0 path',
        status: 'review_notes',
        notes: 'Serve work',
        updated_at: '2026-05-28T12:00:00.000Z',
      }),
    ).toEqual({
      id: 'student-1',
      coachUserId: 'coach-1',
      playerUserId: null,
      playerId: 'player-1',
      playerName: 'Taylor Player',
      identitySlug: 'relentless-competitor-4-0',
      levelLabel: '4.0 path',
      playerEmail: '',
      playerPhone: '',
      contactPreference: 'in_app',
      setupStatus: 'manual',
      status: 'review_notes',
      notes: 'Serve work',
      updatedAt: '2026-05-28T12:00:00.000Z',
    })
  })

  it('requires a player name for student payloads', () => {
    expect(buildCoachStudentLinkPayload({ playerName: '  ' }, 'coach-1')).toBeNull()
  })

  it('builds coach-owned student payloads', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('student-random')

    expect(buildCoachStudentLinkPayload({ playerName: ' Taylor ', status: 'paused' }, 'coach-1')).toMatchObject({
      id: 'coach-student-student-random',
      coach_user_id: 'coach-1',
      player_name: 'Taylor',
      status: 'paused',
      identity_slug: 'relentless-competitor-4-0',
    })
  })

  it('builds assignment payloads with valid dates only', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('assignment-random')

    expect(
      buildCoachAssignmentPayload(
        {
          studentLinkId: 'student-1',
          title: ' Serve targets ',
          dueDate: '2026-06-01',
          status: 'assigned',
          assignment: { reps: 60 },
        },
        'coach-1',
      ),
    ).toMatchObject({
      id: 'coach-assignment-assignment-random',
      coach_user_id: 'coach-1',
      student_link_id: 'student-1',
      title: 'Serve targets',
      due_date: '2026-06-01',
      status: 'assigned',
      assignment_json: { reps: 60 },
    })

    expect(
      buildCoachAssignmentPayload({ studentLinkId: 'student-1', title: 'Serve targets', dueDate: 'soon' }, 'coach-1'),
    ).toMatchObject({ due_date: null })
  })

  it('maps assignment rows to client shape', () => {
    expect(
      mapCoachAssignmentRow({
        id: 'assignment-1',
        student_link_id: 'student-1',
        title: 'Serve targets',
        focus: 'Serve',
        due_date: null,
        status: 'completed',
        assignment_json: { reps: 60 },
        updated_at: '2026-05-28T12:00:00.000Z',
      }),
    ).toMatchObject({
      id: 'assignment-1',
      studentLinkId: 'student-1',
      title: 'Serve targets',
      status: 'completed',
      assignment: { reps: 60 },
    })
  })

  it('builds player assignment completion check-ins without losing coach payload', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00.000Z'))

    expect(
      buildPlayerAssignmentCompletion(
        { templateId: 'serve-target-ladder', reps: 60 },
        { recap: ' Hit 42/60 target serves ', evidence: 'Photo in workbook' },
      ),
    ).toEqual({
      templateId: 'serve-target-ladder',
      reps: 60,
      playerCheckIn: {
        recap: 'Hit 42/60 target serves',
        evidence: 'Photo in workbook',
        completedAt: '2026-05-28T12:00:00.000Z',
      },
    })

    vi.useRealTimers()
  })

  it('reads player assignment check-ins for coach review', () => {
    expect(
      getPlayerAssignmentCheckIn({
        playerCheckIn: {
          recap: 'Hit 42/60 target serves',
          evidence: 'Workbook page 4',
          completedAt: '2026-05-28T12:00:00.000Z',
        },
      }),
    ).toEqual({
      recap: 'Hit 42/60 target serves',
      evidence: 'Workbook page 4',
      completedAt: '2026-05-28T12:00:00.000Z',
    })

    expect(getPlayerAssignmentCheckIn({ playerCheckIn: { recap: ' ', evidence: '' } })).toBeNull()
  })

  it('builds and reads coach assignment reviews', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:30:00.000Z'))

    const assignment = buildCoachAssignmentReview(
      { playerCheckIn: { recap: 'Hit 42/60 serves', evidence: 'Workbook page 4' } },
      { note: 'Good pressure reps.', nextFocus: 'Add second-serve target work.' },
    )

    expect(getCoachAssignmentReview(assignment)).toEqual({
      note: 'Good pressure reps.',
      nextFocus: 'Add second-serve target work.',
      reviewedAt: '2026-05-28T12:30:00.000Z',
    })

    expect(getCoachAssignmentReview({ coachReview: { note: ' ', nextFocus: '' } })).toBeNull()

    vi.useRealTimers()
  })

  it('prioritizes completed player check-ins that need coach review', () => {
    const assignments: CoachAssignment[] = [
      {
        id: 'assigned-work',
        studentLinkId: 'student-1',
        title: 'Assigned work',
        focus: 'Serve',
        dueDate: null,
        status: 'assigned',
        assignment: {},
        updatedAt: '2026-05-28T12:00:00.000Z',
      },
      {
        id: 'reviewed-work',
        studentLinkId: 'student-1',
        title: 'Reviewed work',
        focus: 'Return',
        dueDate: null,
        status: 'completed',
        assignment: {
          playerCheckIn: { recap: 'Done', evidence: '', completedAt: '2026-05-28T12:00:00.000Z' },
          coachReview: { note: 'Good', nextFocus: '', reviewedAt: '2026-05-28T12:05:00.000Z' },
        },
        updatedAt: '2026-05-28T12:05:00.000Z',
      },
      {
        id: 'needs-review',
        studentLinkId: 'student-1',
        title: 'Needs review',
        focus: 'Movement',
        dueDate: null,
        status: 'completed',
        assignment: {
          playerCheckIn: { recap: 'Done', evidence: 'Video', completedAt: '2026-05-28T12:10:00.000Z' },
        },
        updatedAt: '2026-05-28T12:10:00.000Z',
      },
    ]

    expect(assignmentNeedsCoachReview(assignments[2])).toBe(true)
    expect(sortCoachAssignmentsForReview(assignments).map((assignment) => assignment.id)).toEqual([
      'needs-review',
      'assigned-work',
      'reviewed-work',
    ])
  })

  it('labels coach assignment due states', () => {
    const now = new Date('2026-05-28T15:00:00.000Z')

    expect(getCoachAssignmentDueState(null, now)).toEqual({ label: 'No due date', tone: 'none' })
    expect(getCoachAssignmentDueState('2026-05-27', now)).toEqual({ label: 'Overdue 1d', tone: 'overdue' })
    expect(getCoachAssignmentDueState('2026-05-28', now)).toEqual({ label: 'Due today', tone: 'today' })
    expect(getCoachAssignmentDueState('2026-05-29', now)).toEqual({ label: 'Due tomorrow', tone: 'soon' })
    expect(getCoachAssignmentDueState('2026-06-03', now)).toEqual({ label: 'Due in 6d', tone: 'soon' })
    expect(getCoachAssignmentDueState('2026-06-12', now)).toEqual({ label: 'Due 2026-06-12', tone: 'future' })
  })

  it('prioritizes player assignments by due pressure before completed work', () => {
    const now = new Date('2026-05-28T15:00:00.000Z')
    const assignments: CoachAssignment[] = [
      {
        id: 'completed-reviewed',
        studentLinkId: 'student-1',
        title: 'Completed reviewed',
        focus: 'Serve',
        dueDate: '2026-05-26',
        status: 'completed',
        assignment: { coachReview: { note: 'Good', nextFocus: '', reviewedAt: '2026-05-28T12:00:00.000Z' } },
        updatedAt: '2026-05-28T12:00:00.000Z',
      },
      {
        id: 'future',
        studentLinkId: 'student-1',
        title: 'Future',
        focus: 'Return',
        dueDate: '2026-06-02',
        status: 'assigned',
        assignment: {},
        updatedAt: '2026-05-28T12:00:00.000Z',
      },
      {
        id: 'overdue',
        studentLinkId: 'student-1',
        title: 'Overdue',
        focus: 'Movement',
        dueDate: '2026-05-27',
        status: 'assigned',
        assignment: {},
        updatedAt: '2026-05-28T12:00:00.000Z',
      },
      {
        id: 'today',
        studentLinkId: 'student-1',
        title: 'Today',
        focus: 'Doubles',
        dueDate: '2026-05-28',
        status: 'assigned',
        assignment: {},
        updatedAt: '2026-05-28T12:00:00.000Z',
      },
    ]

    expect(sortPlayerAssignmentsForAction(assignments, now).map((assignment) => assignment.id)).toEqual([
      'overdue',
      'today',
      'future',
      'completed-reviewed',
    ])
  })

  it('summarizes structured assignment details for cards', () => {
    expect(
      getCoachAssignmentSummary({
        detail: 'Track target clarity.',
        reps: 60,
        tracker: ['Target called', 'Made target window', '', 42],
        playerPlusPrompt: 'Log the best pressure target.',
        expectedEvidence: '60 serves charted by target.',
      }),
    ).toEqual({
      detail: 'Track target clarity.',
      volume: '60 reps',
      tracker: ['Target called', 'Made target window'],
      prompt: 'Log the best pressure target.',
      expectedEvidence: '60 serves charted by target.',
    })

    expect(getCoachAssignmentSummary({ sets: 3, tracker: 'none' })).toMatchObject({
      volume: '3 sets',
      tracker: [],
      expectedEvidence: '',
    })
  })

  it('reads Level Up assignment packs and folds them into player-facing summaries', () => {
    const assignment = {
      levelUpPack: {
        id: 'doubles-readiness',
        title: 'Doubles Readiness',
        focus: 'Partner first move and poach timing',
        items: [
          {
            cardId: 'partner-first-move-call',
            title: 'Partner First Move Call',
            proof: 'Call the first move before four points.',
            status: 'completed',
          },
          {
            cardId: 'poach-timing-shadow',
            title: 'Poach Timing Shadow',
            proof: 'Log three poach timing reads.',
            status: 'assigned',
          },
        ],
      },
    }

    expect(getCoachAssignmentPack(assignment)).toMatchObject({
      id: 'doubles-readiness',
      title: 'Doubles Readiness',
      items: [
        { cardId: 'partner-first-move-call', status: 'completed' },
        { cardId: 'poach-timing-shadow', status: 'assigned' },
      ],
    })
    expect(getCoachAssignmentPackProgress(assignment)).toMatchObject({
      total: 2,
      completed: 1,
      open: 1,
      percent: 50,
      label: '1/2 complete',
    })
    expect(getCoachAssignmentSummary(assignment)).toMatchObject({
      detail: 'Complete Doubles Readiness: Partner first move and poach timing',
      expectedEvidence: '2 Level Up cards completed with proof.',
      tracker: ['Partner First Move Call: Call the first move before four points.', 'Poach Timing Shadow: Log three poach timing reads.'],
    })
  })

  it('marks Level Up pack items complete when the player completes the coach assignment', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-06T12:00:00.000Z'))

    const completed = buildPlayerAssignmentCompletion(
      {
        levelUpPack: {
          id: 'match-day-routine',
          title: 'Match-Day Routine',
          focus: 'Warm-up and debrief',
          items: [
            { cardId: 'five-minute-match-primer', title: 'Five Minute Match Primer', proof: 'Primer completed.', status: 'started' },
            { cardId: 'post-match-five-minute-debrief', title: 'Post-Match Debrief', proof: 'Debrief note.', status: 'assigned' },
          ],
        },
      },
      { recap: 'Pack done.', evidence: 'Level Up log' },
    )

    expect(getCoachAssignmentPackProgress(completed)).toMatchObject({
      total: 2,
      completed: 2,
      open: 0,
      percent: 100,
      label: '2/2 complete',
    })
    expect(getPlayerAssignmentCheckIn(completed)).toMatchObject({
      recap: 'Pack done.',
      evidence: 'Level Up log',
    })

    vi.useRealTimers()
  })

  it('updates one Level Up pack card without closing the full assignment early', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-07T12:00:00.000Z'))

    const firstCard = buildPlayerAssignmentPackCardCompletion(
      {
        levelUpPack: {
          id: 'doubles-readiness',
          title: 'Doubles Readiness',
          focus: 'Partner clarity',
          items: [
            { cardId: 'partner-first-move-call', title: 'Partner First Move Call', proof: 'Call first move.', status: 'assigned' },
            { cardId: 'poach-timing-shadow', title: 'Poach Timing Shadow', proof: 'Poach timing score.', status: 'assigned' },
          ],
        },
      },
      {
        cardId: 'partner-first-move-call',
        levelUpSessionId: 'level-up-session-1',
        rating: 4,
        completedAt: '2026-06-07T11:45:00.000Z',
        recap: 'First move call stayed clear.',
        evidence: 'Level Up training log',
      },
    )

    expect(firstCard.complete).toBe(false)
    expect(getCoachAssignmentPackProgress(firstCard.assignment)).toMatchObject({
      total: 2,
      completed: 1,
      open: 1,
      complete: false,
    })
    expect(getCoachAssignmentPack(firstCard.assignment)?.items[0]).toMatchObject({
      cardId: 'partner-first-move-call',
      status: 'completed',
      levelUpSessionId: 'level-up-session-1',
      rating: 4,
      recap: 'First move call stayed clear.',
    })
    expect(getPlayerAssignmentCheckIn(firstCard.assignment)).toBeNull()

    const finalCard = buildPlayerAssignmentPackCardCompletion(firstCard.assignment, {
      cardId: 'poach-timing-shadow',
      levelUpSessionId: 'level-up-session-2',
      rating: 5,
      recap: 'Pack finished.',
      evidence: 'Two Level Up logs',
    })

    expect(finalCard.complete).toBe(true)
    expect(getCoachAssignmentPackProgress(finalCard.assignment)).toMatchObject({
      completed: 2,
      open: 0,
      complete: true,
    })
    expect(getPlayerAssignmentCheckIn(finalCard.assignment)).toMatchObject({
      recap: 'Pack finished.',
      evidence: 'Two Level Up logs',
    })

    vi.useRealTimers()
  })

  it('keeps coach assignment, player proof, and coach review connected for Level Up work', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-04T18:00:00.000Z'))

    const assignmentPayload = buildCoachAssignmentPayload(
      {
        id: 'assignment-serve-target',
        studentLinkId: 'student-link-1',
        title: 'Serve Target Call',
        focus: 'Serve routine',
        dueDate: '2026-06-08',
        status: 'assigned',
        assignment: {
          cardId: 'serve-target-call',
          moduleId: 'serve-pressure-routine',
          expectedEvidence: 'Serve target clarity 0-5',
          playerPlusPrompt: 'Run the card, score one proof, and send the short recap.',
          tracker: ['Target called before motion', 'Same routine after misses'],
        },
      },
      'coach-1',
    )

    expect(assignmentPayload).toMatchObject({
      id: 'assignment-serve-target',
      coach_user_id: 'coach-1',
      student_link_id: 'student-link-1',
      title: 'Serve Target Call',
      focus: 'Serve routine',
      status: 'assigned',
      assignment_json: {
        cardId: 'serve-target-call',
        moduleId: 'serve-pressure-routine',
        expectedEvidence: 'Serve target clarity 0-5',
      },
    })

    const levelUpPayload = buildLevelUpSessionPayload(
      {
        id: 'level-up-session-serve-target',
        assignmentId: 'assignment-serve-target',
        studentLinkId: 'student-link-1',
        identitySlug: 'relentless-competitor-4-0',
        focusId: 'serve',
        focusTitle: 'Serve',
        workType: 'court',
        context: 'alone',
        drillTitle: 'Serve Target Call',
        rating: 4,
        feeling: 'ready',
        accessMode: 'coach_invited',
        sharedWithCoach: true,
        elapsedSeconds: 420,
        note: 'Target call stayed clear.',
      },
      'player-1',
      { coachUserId: 'coach-1', studentLinkId: 'student-link-1' },
    )

    expect(levelUpPayload).toMatchObject({
      id: 'level-up-session-serve-target',
      player_user_id: 'player-1',
      coach_user_id: 'coach-1',
      student_link_id: 'student-link-1',
      assignment_id: 'assignment-serve-target',
      identity_slug: 'relentless-competitor-4-0',
      focus_id: 'serve',
      drill_title: 'Serve Target Call',
      rating: 4,
      access_mode: 'coach_invited',
      shared_with_coach: true,
      note: 'Target call stayed clear.',
    })

    const session = mapLevelUpSessionRow({
      ...levelUpPayload!,
      created_at: '2026-06-04T18:00:00.000Z',
    })
    expect(session).toMatchObject({
      playerUserId: 'player-1',
      coachUserId: 'coach-1',
      studentLinkId: 'student-link-1',
      assignmentId: 'assignment-serve-target',
      rating: 4,
      sharedWithCoach: true,
    })

    const completedAssignmentJson = buildPlayerAssignmentCompletion(assignmentPayload!.assignment_json as Record<string, unknown>, {
      recap: `${levelUpPayload!.focus_title}: ${levelUpPayload!.drill_title} (${levelUpPayload!.rating}/5, ${levelUpPayload!.feeling}, 7:00) - ${levelUpPayload!.note}`,
      evidence: 'Level Up training log',
    })
    const checkIn = getPlayerAssignmentCheckIn(completedAssignmentJson)
    expect(checkIn).toMatchObject({
      recap: 'Serve: Serve Target Call (4/5, ready, 7:00) - Target call stayed clear.',
      evidence: 'Level Up training log',
      completedAt: '2026-06-04T18:00:00.000Z',
    })

    const completedAssignment: CoachAssignment = {
      id: 'assignment-serve-target',
      studentLinkId: 'student-link-1',
      title: 'Serve Target Call',
      focus: 'Serve routine',
      dueDate: '2026-06-08',
      status: 'completed',
      assignment: completedAssignmentJson,
      updatedAt: '2026-06-04T18:00:00.000Z',
    }
    expect(assignmentNeedsCoachReview(completedAssignment)).toBe(true)

    const reviewedAssignmentJson = buildCoachAssignmentReview(completedAssignment.assignment, {
      note: 'Strong target clarity. Add pressure without changing the routine.',
      nextFocus: 'Start at 30-30 and keep the same target call.',
    })
    expect(getCoachAssignmentReview(reviewedAssignmentJson)).toMatchObject({
      note: 'Strong target clarity. Add pressure without changing the routine.',
      nextFocus: 'Start at 30-30 and keep the same target call.',
      reviewedAt: '2026-06-04T18:00:00.000Z',
    })

    vi.useRealTimers()
  })
})
