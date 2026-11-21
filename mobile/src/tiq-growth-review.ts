import type {GrowthPlan} from '../../lib/tiq-growth'
import {growthReady} from '../../lib/tiq-growth'
import type {TiqAssessment} from '../../lib/tiq-self-assessment'
import {tiqSkills, tiqSkillLevels} from '../../lib/tiq-assessment-skills'
import {html} from './match-details'

export function growthReviewChoices(plan: GrowthPlan, baseline: TiqAssessment | null, assessments: TiqAssessment[]) {
  return assessments.filter(row => row.id !== plan.baseline && Date.parse(row.createdAt) > Date.parse(plan.createdAt)
    && (!baseline || row.date >= baseline.date))
    .sort((a, b) => b.date.localeCompare(a.date) || Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id))
}

export function growthNextStep(plan: GrowthPlan, choices: TiqAssessment[], today: string) {
  if (plan.state !== 'active') return null
  if (growthReady(plan, today)) {
    if (choices.length) return {action: 'review', title: 'Review your new assessment',
      copy: 'Compare your starting point with your latest eligible self-assessment before finishing this plan.', label: 'Preview progress review'} as const
    return {action: 'retake', title: plan.logs.length >= plan.sessions ? 'Your planned practices are logged' : 'Your review date is here',
      copy: 'Try your court target, then take a fresh self-assessment. Practice totals do not change your TiQ.', label: 'Start progress review'} as const
  }
  return plan.logs.length === 0
    ? {action: 'drill', title: 'Take your target to court', copy: 'Open the drill for this skill. After you practice, record what happened below.', label: 'Start this drill'} as const
    : {action: 'log', title: 'Keep building your court evidence', copy: `${plan.logs.length} of ${plan.sessions} planned practices logged. Add your next completed practice and its court result.`, label: 'Log next practice'} as const
}

export function growthReviewHtml(plan: GrowthPlan, baseline: TiqAssessment | null, reassessment: TiqAssessment | null) {
  const skill = tiqSkills.find(row => row.id === plan.skill)!
  const before = baseline?.answers[plan.skill], after = reassessment?.answers[plan.skill]
  const change = before === undefined || after === undefined ? 'Comparison unavailable'
    : after > before ? 'Higher self-rating' : after < before ? 'Lower self-rating' : 'Same self-rating'
  const source = (label: string, row: TiqAssessment | null) => `<div><dt>${label}</dt><dd>${row
    ? `<time datetime="${html(row.date)}">${html(new Date(row.date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))}</time><strong>${tiqSkillLevels[row.answers[plan.skill]]}</strong><p>${html(skill.levels[row.answers[plan.skill]])}</p>`
    : '<p>Assessment removed or unavailable.</p>'}</dd></div>`
  return `<section class="tiq-growth-review" aria-label="${skill.skill} practice review"><h3>${skill.skill} review</h3>
    <p class="tiq-growth-change">${change}</p><dl>${source('Starting assessment', baseline)}${source('Review assessment', reassessment)}</dl>
    <p>${plan.logs.length} ${plan.logs.length === 1 ? 'practice' : 'practices'} logged. These are your self-assessments; logging practice does not change your TiQ.</p></section>`
}
