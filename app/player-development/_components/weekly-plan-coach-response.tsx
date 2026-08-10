import type { WeeklyLevelUpPlan } from '@/lib/level-up/weekly-plan'
import styles from './player-development.module.css'

export default function WeeklyPlanCoachResponse({ plan }: { plan: WeeklyLevelUpPlan }) {
  const response = plan.coachResponse
  if (!response) return null

  return (
    <div className={styles.liveWeeklyCoachResponse} data-action={response.action}>
      <span>Coach update</span>
      <strong>
        {response.action === 'acknowledged'
          ? 'Your coach reviewed this week.'
          : response.action === 'adjusted'
            ? 'Your coach added a cue.'
            : `Your coach changed one rep to ${response.replacementRep?.title ?? 'a coach pick'}.`}
      </strong>
      {response.note ? <p>{response.note}</p> : null}
    </div>
  )
}
