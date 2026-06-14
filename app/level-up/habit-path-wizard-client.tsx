'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import styles from '@/app/player-development/_components/player-development.module.css'

export type HabitPathWizardOption = {
  id: string
  label: string
  title: string
  bestFor: string
  weeklyTarget: string
  proof: string
  primaryCardTitle: string
  drillHref: string
  questHref: string
  coachHref: string
  captainHref: string
}

const levelChoices = [
  { id: 'newer', label: 'Newer', pathId: 'new-player-rhythm' },
  { id: 'rec', label: 'Recreational', pathId: 'recreational-consistency' },
  { id: 'comp', label: 'Competitive', pathId: 'competitive-point-start' },
  { id: 'team', label: 'Doubles', pathId: 'doubles-team-clarity' },
] as const

const goalChoices = [
  { id: 'rhythm', label: 'Rhythm', pathId: 'new-player-rhythm' },
  { id: 'errors', label: 'Fewer errors', pathId: 'recreational-consistency' },
  { id: 'starts', label: 'Point starts', pathId: 'competitive-point-start' },
  { id: 'partner', label: 'Partner clarity', pathId: 'doubles-team-clarity' },
] as const

const setupChoices = [
  { id: 'solo', label: 'Solo', boostPathId: 'new-player-rhythm' },
  { id: 'court', label: 'Court', boostPathId: 'recreational-consistency' },
  { id: 'match', label: 'Match day', boostPathId: 'competitive-point-start' },
  { id: 'team', label: 'Team', boostPathId: 'doubles-team-clarity' },
] as const

type LevelChoiceId = (typeof levelChoices)[number]['id']
type GoalChoiceId = (typeof goalChoices)[number]['id']
type SetupChoiceId = (typeof setupChoices)[number]['id']

export default function HabitPathWizardClient({ paths }: { paths: HabitPathWizardOption[] }) {
  const [level, setLevel] = useState<LevelChoiceId>(levelChoices[1].id)
  const [goal, setGoal] = useState<GoalChoiceId>(goalChoices[1].id)
  const [setup, setSetup] = useState<SetupChoiceId>(setupChoices[1].id)

  const recommendedPath = useMemo(() => {
    const votes = new Map<string, number>()
    const levelPath = levelChoices.find((choice) => choice.id === level)?.pathId
    const goalPath = goalChoices.find((choice) => choice.id === goal)?.pathId
    const setupPath = setupChoices.find((choice) => choice.id === setup)?.boostPathId

    if (levelPath) votes.set(levelPath, (votes.get(levelPath) ?? 0) + 2)
    if (goalPath) votes.set(goalPath, (votes.get(goalPath) ?? 0) + 3)
    if (setupPath) votes.set(setupPath, (votes.get(setupPath) ?? 0) + 1)

    return [...paths].sort((left, right) => (votes.get(right.id) ?? 0) - (votes.get(left.id) ?? 0))[0] ?? paths[0]
  }, [goal, level, paths, setup])

  if (!recommendedPath) return null

  return (
    <section className={styles.levelUpHabitWizard} aria-labelledby="habit-path-wizard-title">
      <div className={styles.levelUpQuestPackPreviewHeader}>
        <span>Path Wizard</span>
        <h2 id="habit-path-wizard-title">Find the habit path that fits today.</h2>
        <p>Custom tennis habits work best when the level, goal, and training setup point to the same next rep.</p>
      </div>

      <div className={styles.levelUpHabitWizardGrid}>
        <ChoiceGroup label="Level" value={level} choices={levelChoices} onChange={setLevel} />
        <ChoiceGroup label="Goal" value={goal} choices={goalChoices} onChange={setGoal} />
        <ChoiceGroup label="Setup" value={setup} choices={setupChoices} onChange={setSetup} />

        <article className={styles.levelUpHabitWizardResult}>
          <span>Recommended</span>
          <strong>{recommendedPath.title}</strong>
          <p>{recommendedPath.bestFor}</p>
          <dl>
            <div>
              <dt>Weekly target</dt>
              <dd>{recommendedPath.weeklyTarget}</dd>
            </div>
            <div>
              <dt>Linked drill</dt>
              <dd>{recommendedPath.primaryCardTitle}</dd>
            </div>
          </dl>
          <small>Proof: {recommendedPath.proof}</small>
          <div className={styles.levelUpHabitWizardActions}>
            <Link className="button-primary" href={recommendedPath.questHref}>Build quest</Link>
            <Link className="button-secondary" href={recommendedPath.drillHref}>Start drill</Link>
            <Link className="button-secondary" href={recommendedPath.coachHref}>Coach pack</Link>
            <Link className="button-secondary" href={recommendedPath.captainHref}>Team challenge</Link>
          </div>
        </article>
      </div>
    </section>
  )
}

function ChoiceGroup<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string
  value: T
  choices: ReadonlyArray<{ id: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <fieldset className={styles.levelUpHabitWizardChoice}>
      <legend>{label}</legend>
      <div>
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            data-active={choice.id === value ? 'true' : 'false'}
            onClick={() => onChange(choice.id)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
