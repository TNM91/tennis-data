export type CaptainLevelUpChallenge = {
  id: string
  title: string
  focus: string
  detail: string
  proof: string
  cardIds: string[]
}

export const CAPTAIN_LEVEL_UP_CHALLENGES: CaptainLevelUpChallenge[] = [
  {
    id: 'rhythm-builder',
    title: 'Rhythm Builder',
    focus: 'Ready feet, wall rhythm, and pre-play readiness',
    detail: 'Use this as a low-friction team habit for players who need a clean starting rhythm before practice or match warm-up.',
    proof: 'Track aggregate completion only. Individual proof and notes stay private unless players choose to share.',
    cardIds: ['split-step-rhythm', 'wall-rally-rhythm', 'dynamic-tennis-warm-up'],
  },
  {
    id: 'consistency-builder',
    title: 'Consistency Builder',
    focus: 'Crosscourt tolerance, wide-ball neutralizing, and post-play recovery',
    detail: 'Use this when the lineup week needs cleaner rally habits and fewer preventable misses.',
    proof: 'Track aggregate completion only. Individual misses, notes, and proof scores stay private by default.',
    cardIds: ['crosscourt-consistency', 'wide-ball-neutralizer', 'post-play-mobility-reset'],
  },
  {
    id: 'point-start-routine',
    title: 'Point-Start Routine',
    focus: 'Serve target, return job, and 30-30 reset clarity',
    detail: 'Use this when the team week depends on better first-two-shot decisions under pressure.',
    proof: 'Aggregate completion only; players control whether any personal proof detail is shared.',
    cardIds: ['serve-target-call', 'return-depth-lane', '30-30-pressure-game'],
  },
  {
    id: 'match-day-routine',
    title: 'Match-Day Routine',
    focus: 'Warm-up, return intent, and post-match debrief',
    detail: 'Run this as a team habit before the next lineup week. Completion can be tracked as an aggregate team signal.',
    proof: 'Aggregate completion only. Private player proof and notes stay with each player.',
    cardIds: ['five-minute-match-primer', 'return-30-30-game', 'post-match-five-minute-debrief'],
  },
  {
    id: 'doubles-readiness',
    title: 'Doubles Readiness',
    focus: 'Partner first move, poach timing, and 30-30 doubles clarity',
    detail: 'Use this when the team week depends on clearer doubles jobs and partner communication.',
    proof: 'Track who completed the challenge; keep individual notes private unless players share them.',
    cardIds: ['partner-first-move-call', 'poach-timing-shadow', 'doubles-30-30-game'],
  },
]

export function buildCaptainLevelUpChallenge(challengeId: string, requestedCardId = ''): CaptainLevelUpChallenge | null {
  const challenge = CAPTAIN_LEVEL_UP_CHALLENGES.find((item) => item.id === challengeId)
  if (!challenge) return null

  if (!requestedCardId || challenge.cardIds.includes(requestedCardId)) return challenge

  return {
    ...challenge,
    cardIds: [requestedCardId, ...challenge.cardIds.filter((cardId) => cardId !== requestedCardId)],
  }
}

export function appendLevelUpChallengeHref(href: string, challengeId: string, cardId = '') {
  const [path, hash = ''] = href.split('#')
  const separator = path.includes('?') ? '&' : '?'
  const params = new URLSearchParams({ levelUpChallenge: challengeId })
  if (cardId) params.set('card', cardId)
  const nextPath = `${path}${separator}${params.toString()}`
  return hash ? `${nextPath}#${hash}` : nextPath
}

export function getCaptainLevelUpAggregateCompletionLabel(challenge: CaptainLevelUpChallenge) {
  if (challenge.id === 'match-day-routine') return '8 of 12 players completed match-day routine'
  return `0 of 12 players completed ${challenge.title.toLowerCase()}`
}
