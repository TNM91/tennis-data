import { getPlayerAssignmentCheckIn, type CoachAssignment, type CoachStudentLink } from '@/lib/coach-storage'
import type { CoachStudentInvite } from '@/lib/coach-invites'

export type CoachLaunchStepId = 'player' | 'connection' | 'assignment' | 'proof'

export type CoachLaunchProgress = {
  completed: number
  total: number
  complete: boolean
  steps: Record<CoachLaunchStepId, boolean>
}

export function getCoachLaunchProgress({
  students,
  invites,
  assignments,
}: {
  students: CoachStudentLink[]
  invites: CoachStudentInvite[]
  assignments: CoachAssignment[]
}): CoachLaunchProgress {
  const hasPlayer = students.length > 0
  const hasConnection = students.some((student) => student.setupStatus === 'linked') || invites.some((invite) => (
    invite.status === 'pending' || invite.status === 'accepted'
  ))
  const hasAssignment = assignments.some((assignment) => (
    assignment.status === 'assigned' || assignment.status === 'completed'
  ))
  const hasProof = assignments.some((assignment) => (
    assignment.status === 'completed' || Boolean(getPlayerAssignmentCheckIn(assignment.assignment))
  ))
  const steps = {
    player: hasPlayer,
    connection: hasConnection,
    assignment: hasAssignment,
    proof: hasProof,
  }
  const completed = Object.values(steps).filter(Boolean).length

  return {
    completed,
    total: 4,
    complete: completed === 4,
    steps,
  }
}
