import { describe, expect, it, vi } from 'vitest'
import {
  buildCoachAssignmentPayload,
  buildCoachStudentLinkPayload,
  buildCoachAssignmentReview,
  buildPlayerAssignmentCompletion,
  assignmentNeedsCoachReview,
  getCoachAssignmentReview,
  getCoachAssignmentDueState,
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
      }),
    ).toEqual({
      detail: 'Track target clarity.',
      volume: '60 reps',
      tracker: ['Target called', 'Made target window'],
      prompt: 'Log the best pressure target.',
    })

    expect(getCoachAssignmentSummary({ sets: 3, tracker: 'none' })).toMatchObject({
      volume: '3 sets',
      tracker: [],
    })
  })
})
