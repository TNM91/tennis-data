import { describe, expect, it } from 'vitest'
import { getCoachLaunchProgress } from '@/lib/coach-launch-progress'
import type { CoachAssignment, CoachStudentLink } from '@/lib/coach-storage'
import type { CoachStudentInvite } from '@/lib/coach-invites'

const student: CoachStudentLink = {
  id: 'student-1', coachUserId: 'coach-1', playerUserId: null, playerId: null, playerName: 'Maya', identitySlug: 'all-court',
  levelLabel: '4.0', playerEmail: '', playerPhone: '', contactPreference: 'in_app', setupStatus: 'manual', status: 'active', notes: '', updatedAt: '2026-09-02T00:00:00.000Z',
}

const invite: CoachStudentInvite = {
  id: 'invite-1', studentLinkId: 'student-1', inviteEmail: '', inviteToken: 'token', inviteHref: '/coach/invite/token', status: 'pending', message: '', expiresAt: null, updatedAt: '2026-09-02T00:00:00.000Z',
}

const assignment: CoachAssignment = {
  id: 'assignment-1', studentLinkId: 'student-1', title: 'Serve targets', focus: 'Serve', dueDate: null, status: 'assigned', assignment: {}, updatedAt: '2026-09-02T00:00:00.000Z',
}

describe('coach launch progress', () => {
  it('keeps the first player loop ordered until a player returns proof', () => {
    expect(getCoachLaunchProgress({ students: [student], invites: [invite], assignments: [assignment] })).toMatchObject({
      completed: 3,
      total: 4,
      complete: false,
      steps: { player: true, connection: true, assignment: true, proof: false },
    })
  })

  it('earns the Coach launch after the first player check-in', () => {
    const completedAssignment: CoachAssignment = {
      ...assignment,
      status: 'completed',
      assignment: { playerCheckIn: { recap: '60 serves complete', evidence: 'Target chart', completedAt: '2026-09-02T00:00:00.000Z' } },
    }
    expect(getCoachLaunchProgress({ students: [student], invites: [invite], assignments: [completedAssignment] })).toMatchObject({
      completed: 4,
      complete: true,
    })
  })
})
