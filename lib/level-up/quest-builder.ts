import { LEVEL_UP_CARDS } from './level-up-cards'
import type { LevelUpHabitCategory, LevelUpHabitPath, LevelUpQuestBuilderPlan, LevelUpQuestTemplate } from './level-up-types'

export const LEVEL_UP_QUEST_TEMPLATES: LevelUpQuestTemplate[] = [
  {
    id: 'serve-routine-builder',
    title: 'Serve Routine Builder',
    category: 'tennis-skill',
    cadence: 'practice-day',
    xp: 20,
    level: 'starter',
    description: 'Build one repeatable serve target and reset habit before tracking makes.',
    proof: 'Serve target called before each rep.',
    linkedCardIds: ['serve-target-ladder', 'second-serve-routine-reps'],
    starterHabit: 'Call the serve target before every practice serve.',
  },
  {
    id: 'first-step-footwork',
    title: 'First-Step Footwork',
    category: 'fitness',
    cadence: 'daily',
    xp: 15,
    level: 'starter',
    description: 'Use short movement blocks that connect footwork to the first ball, not generic conditioning.',
    proof: 'Split-step timing scored after the drill.',
    linkedCardIds: ['split-step-rhythm', 'four-cone-tennis-star'],
    starterHabit: 'Complete one controlled first-step block.',
  },
  {
    id: 'match-day-hydration',
    title: 'Match-Day Hydration',
    category: 'nutrition-hydration',
    cadence: 'match-day',
    xp: 10,
    level: 'starter',
    description: 'Create a simple pre-match water and snack routine that supports energy on court.',
    proof: 'Hydration plan checked before warm-up.',
    linkedCardIds: ['dynamic-tennis-warm-up', 'five-minute-match-primer'],
    starterHabit: 'Pack water before leaving for the court.',
  },
  {
    id: 'pressure-reset',
    title: 'Pressure Reset',
    category: 'mindset',
    cadence: 'practice-day',
    xp: 15,
    level: 'builder',
    description: 'Turn errors and tight points into a trained between-point routine.',
    proof: 'Reset used before the next point.',
    linkedCardIds: ['three-step-reset', 'closing-game-routine'],
    starterHabit: 'Use one breath and one target after every miss.',
  },
  {
    id: 'post-play-recovery',
    title: 'Post-Play Recovery',
    category: 'recovery',
    cadence: 'practice-day',
    xp: 10,
    level: 'starter',
    description: 'Finish practices and matches with a short reset so the next session starts cleaner.',
    proof: 'Recovery reset completed after play.',
    linkedCardIds: ['post-play-mobility-reset', 'post-match-five-minute-debrief'],
    starterHabit: 'Do one mobility reset before leaving the court.',
  },
  {
    id: 'opponent-scout-note',
    title: 'Opponent Scout Note',
    category: 'match-prep',
    cadence: 'weekly',
    xp: 15,
    level: 'builder',
    description: 'Capture one scouting pattern and convert it into a next-practice action.',
    proof: 'One proof, one leak, one next rep.',
    linkedCardIds: ['post-match-five-minute-debrief', 'return-30-30-game'],
    starterHabit: 'Write one useful note after a match or scout.',
  },
]

export const LEVEL_UP_HABIT_PATHS: LevelUpHabitPath[] = [
  {
    id: 'new-player-rhythm',
    label: 'Newer players',
    title: 'Find the first repeatable rhythm',
    playerLevel: 'Learning the game or returning after time away',
    weeklyTarget: '3 short habits, 1 proof score each',
    bestFor: 'Players who need simple wins before bigger tactics.',
    linkedCardIds: ['split-step-rhythm', 'wall-rally-rhythm', 'dynamic-tennis-warm-up'],
    habits: ['Start every session with ready feet.', 'Use one wall or shadow rhythm block.', 'Rate readiness before full swings.'],
    proof: 'One clean timing score after each session.',
  },
  {
    id: 'recreational-consistency',
    label: 'Recreational players',
    title: 'Build rallies that survive pressure',
    playerLevel: '2.5-3.5 players building consistency',
    weeklyTarget: '2 court habits, 1 recovery habit',
    bestFor: 'Players who want fewer loose errors without overthinking.',
    linkedCardIds: ['crosscourt-consistency', 'wide-ball-neutralizer', 'post-play-mobility-reset'],
    habits: ['Build crosscourt before changing direction.', 'Neutralize wide balls before attacking.', 'Reset the body after play.'],
    proof: 'Rally quality and recovery scored 0-5.',
  },
  {
    id: 'competitive-point-start',
    label: 'Competitive players',
    title: 'Own the first two shots',
    playerLevel: '3.5-4.5 players chasing sharper point starts',
    weeklyTarget: '2 serve/return habits, 1 pressure habit',
    bestFor: 'Players who need better starts, not more random reps.',
    linkedCardIds: ['serve-target-call', 'return-depth-lane', '30-30-pressure-game'],
    habits: ['Call the serve target before the motion.', 'Pick the return job before the toss.', 'Use one reset at 30-30.'],
    proof: 'Point-start clarity, not make percentage.',
  },
  {
    id: 'doubles-team-clarity',
    label: 'Doubles and teams',
    title: 'Make partner jobs visible',
    playerLevel: 'Any level playing doubles or team tennis',
    weeklyTarget: '2 communication habits, 1 match-day habit',
    bestFor: 'Partners and captains who need shared language.',
    linkedCardIds: ['partner-first-move-call', 'switch-call-drill', 'five-minute-match-primer'],
    habits: ['Call the first move early.', 'Practice switch language before points.', 'Set one match-day job before warm-up.'],
    proof: 'Partner could act on the call.',
  },
]

export function buildLevelUpQuestBuilderPlan(identitySlug: string): LevelUpQuestBuilderPlan {
  const templates = LEVEL_UP_QUEST_TEMPLATES
    .map((template) => {
      const primaryCard = findBestTemplateCard(template.linkedCardIds, identitySlug)
      return primaryCard
        ? {
            ...template,
            primaryCard,
            drillHref: `/level-up/${identitySlug}?card=${primaryCard.id}#level-up-flow`,
          }
        : null
    })
    .filter((template): template is LevelUpQuestBuilderPlan['templates'][number] => Boolean(template))

  return {
    templates,
    categories: [...new Set(templates.map((template) => template.category))],
  }
}

export function buildLevelUpHabitPaths(identitySlug: string) {
  return LEVEL_UP_HABIT_PATHS.map((path) => {
    const linkedCards = path.linkedCardIds
      .map((cardId) => LEVEL_UP_CARDS.find((card) => card.id === cardId))
      .filter((card): card is NonNullable<typeof card> => Boolean(card))
    const primaryCard = linkedCards.find((card) => card.identitySlugs?.includes(identitySlug)) ?? linkedCards[0] ?? null

    return {
      ...path,
      linkedCards,
      primaryCard,
      drillHref: primaryCard ? `/level-up/${identitySlug}?card=${primaryCard.id}#level-up-flow` : `/level-up/${identitySlug}#quest-builder`,
    }
  })
}

export function formatHabitCategory(category: LevelUpHabitCategory) {
  return category.replaceAll('-', ' / ')
}

function findBestTemplateCard(cardIds: string[], identitySlug: string) {
  const cards = cardIds
    .map((cardId) => LEVEL_UP_CARDS.find((card) => card.id === cardId))
    .filter((card): card is NonNullable<typeof card> => Boolean(card))

  return cards.find((card) => card.identitySlugs?.includes(identitySlug)) ?? cards[0] ?? null
}
