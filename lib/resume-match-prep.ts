import type { LabGoal } from './my-lab-goal-sync'
export type ResumeMatchPrep = { title: string; courtPlan: string; href: string }
export function buildResumeMatchPrepHref(goalId: string): string | null {
  if (!goalId.startsWith('matchup-prep-')) return null
  const [type, ...ids] = goalId.slice('matchup-prep-'.length).split(':')
  const keys = type === 'singles' ? ['playerA', 'playerB'] : type === 'doubles' ? ['a1', 'a2', 'b1', 'b2'] : []
  if (!keys.length || ids.length !== keys.length || new Set(ids).size !== ids.length || ids.some(id => !/^[a-zA-Z0-9_-]{1,100}$/.test(id))) return null
  const params = new URLSearchParams({ type, courtside: '1' })
  keys.forEach((key, index) => params.set(key, ids[index]))
  return '/matchup?' + params.toString() + '#courtside-match-prep'
}
export function latestResumeMatchPrep(goals: LabGoal[]): ResumeMatchPrep | null {
  const candidates = goals.filter(goal => goal.progressStatus !== 'completed').map(goal => ({ goal, href: buildResumeMatchPrepHref(goal.id) }))
    .filter(item => item.href && item.goal.goal.trim() && item.goal.improveNext.trim())
    .sort((a, b) => (Date.parse(b.goal.updatedAt || '') || 0) - (Date.parse(a.goal.updatedAt || '') || 0) || a.goal.id.localeCompare(b.goal.id))
  const latest = candidates[0]
  return latest ? { title: latest.goal.goal, courtPlan: latest.goal.improveNext, href: latest.href! } : null
}
