import type {LabGoal} from './my-lab-goal-sync'
export function goalReadinessChecksFor(goal: LabGoal) {
  return [
    { label: 'Goal', complete: Boolean(goal.goal.trim()) },
    { label: 'Update', complete: Boolean(goal.progressUpdate.trim()) },
    { label: 'Strength', complete: Boolean(goal.doingWell.trim()) },
    { label: 'Improve', complete: Boolean(goal.improveNext.trim()) },
    { label: 'Notes', complete: Boolean(goal.notes.trim()) },
  ]
}

export function goalReadinessScoreFor(goal: LabGoal) {
  if (goal.progressStatus === 'completed') return 100
  const checks = goalReadinessChecksFor(goal)
  return Math.round((checks.filter((item) => item.complete).length / checks.length) * 100)
}

