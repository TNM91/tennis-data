export type CaptainLevelUpChallenge = {
  id: string
  title: string
  focus: string
  detail: string
  proof: string
  cardIds: string[]
}

export type CaptainLevelUpChallengeProgress = {
  launched: boolean
  completedCount: number
  connectedCount: number
  launchedAt: string
  messageId: string
}

export type CaptainLevelUpSessionSignal = {
  playerUserId: string
  focusId: string
  drillTitle: string
}

export type CaptainLevelUpTimedSessionSignal = CaptainLevelUpSessionSignal & {
  completedAt: string
}

export type CaptainLevelUpChallengeLaunch = {
  id: string
  createdAt: string
  status?: string
}

export type CaptainLevelUpRecommendationInput = {
  teamName?: string
  leagueName?: string
  flight?: string
  singlesLines: number
  doublesLines: number
  pendingResponseCount: number
  lineupReady: boolean
  matchDate?: string
  todayDate?: string
}

export type CaptainLevelUpRecommendation = {
  challenge: CaptainLevelUpChallenge
  reason: string
}

export const CAPTAIN_LEVEL_UP_IDENTITY_SLUG = 'relentless-competitor-4-0'

const CAPTAIN_LEVEL_UP_CARD_TITLES: Record<string, string> = {
  'split-step-rhythm': 'Split-Step Rhythm',
  'wall-rally-rhythm': 'Wall Rally Rhythm',
  'dynamic-tennis-warm-up': 'Dynamic Tennis Warm-Up',
  'crosscourt-consistency': 'Crosscourt Consistency',
  'wide-ball-neutralizer': 'Wide-Ball Neutralizer',
  'post-play-mobility-reset': 'Post-Play Mobility Reset',
  'serve-target-call': 'Serve Target Call',
  'return-depth-lane': 'Return Depth Lane',
  '30-30-pressure-game': '30-30 Pressure Game',
  'five-minute-match-primer': 'Five-Minute Match Primer',
  'return-30-30-game': 'Return 30-30 Game',
  'post-match-five-minute-debrief': 'Post-Match Five-Minute Debrief',
  'partner-first-move-call': 'Partner First-Move Call',
  'poach-timing-shadow': 'Poach Timing Shadow',
  'doubles-30-30-game': 'Doubles 30-30 Game',
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

export function recommendCaptainLevelUpChallenge(
  input: CaptainLevelUpRecommendationInput,
): CaptainLevelUpRecommendation {
  const scopeLabel = [input.teamName, input.leagueName, input.flight].filter(Boolean).join(' ')
  const isTriLevel = /\btri[\s-]?level\b/i.test(scopeLabel)
  const isDoublesOnly = isTriLevel || (input.doublesLines >= 3 && input.singlesLines === 0)

  if (isDoublesOnly) {
    return buildRecommendation(
      'doubles-readiness',
      isTriLevel
        ? 'Tri-Level is doubles only, so partner movement and poach timing matter most.'
        : 'This team plays doubles first, so partner movement and poach timing matter most.',
    )
  }

  const daysUntilMatch = getDaysBetweenDateKeys(input.todayDate, input.matchDate)
  if (daysUntilMatch !== null && daysUntilMatch >= 0 && daysUntilMatch <= 2) {
    return buildRecommendation(
      'match-day-routine',
      'Match day is close, so warm-up and return intent come first.',
    )
  }

  if (input.pendingResponseCount > 0) {
    return buildRecommendation(
      'rhythm-builder',
      'Keep preparation moving with a short routine while availability replies come in.',
    )
  }

  if (input.lineupReady) {
    return buildRecommendation(
      'point-start-routine',
      'The lineup is taking shape. Give every court the same point-start plan.',
    )
  }

  return buildRecommendation(
    'consistency-builder',
    'Build repeatable rally habits before the lineup is locked.',
  )
}

export function appendLevelUpChallengeHref(href: string, challengeId: string, cardId = '') {
  const [path, hash = ''] = href.split('#')
  const separator = path.includes('?') ? '&' : '?'
  const params = new URLSearchParams({ levelUpChallenge: challengeId })
  if (cardId) params.set('card', cardId)
  const nextPath = `${path}${separator}${params.toString()}`
  return hash ? `${nextPath}#${hash}` : nextPath
}

export function getCaptainLevelUpCardDetails(challenge: Pick<CaptainLevelUpChallenge, 'cardIds'>) {
  return challenge.cardIds.map((cardId) => ({
    id: cardId,
    title: CAPTAIN_LEVEL_UP_CARD_TITLES[cardId] ?? formatCardTitle(cardId),
  }))
}

export function buildCaptainLevelUpCardHref(cardId: string) {
  const params = new URLSearchParams({ card: cardId })
  return `/level-up/${CAPTAIN_LEVEL_UP_IDENTITY_SLUG}?${params.toString()}#level-up-flow`
}

export function getCaptainLevelUpCompletedPlayerIds(
  challenge: CaptainLevelUpChallenge,
  sessions: CaptainLevelUpSessionSignal[],
) {
  const completedByPlayer = getCaptainLevelUpCompletedCardIdsByPlayer(challenge, sessions)
  return Array.from(completedByPlayer.entries())
    .filter(([, completed]) => challenge.cardIds.length > 0 && completed.length === challenge.cardIds.length)
    .map(([playerUserId]) => playerUserId)
}

export function getCaptainLevelUpCompletedCardIdsByPlayer(
  challenge: CaptainLevelUpChallenge,
  sessions: CaptainLevelUpSessionSignal[],
) {
  const cards = getCaptainLevelUpCardDetails(challenge)
  const cardIdByTitle = new Map(cards.map((card) => [normalizeCardSignal(card.title), card.id] as const))
  const requiredCardIds = new Set(cards.map((card) => card.id))
  const completedByPlayer = new Map<string, Set<string>>()

  for (const session of sessions) {
    const playerUserId = session.playerUserId.trim()
    if (!playerUserId) continue
    const cardId = requiredCardIds.has(session.focusId)
      ? session.focusId
      : cardIdByTitle.get(normalizeCardSignal(session.drillTitle))
    if (!cardId) continue
    const completed = completedByPlayer.get(playerUserId) ?? new Set<string>()
    completed.add(cardId)
    completedByPlayer.set(playerUserId, completed)
  }

  return new Map(Array.from(completedByPlayer.entries()).map(([playerUserId, completed]) => [
    playerUserId,
    challenge.cardIds.filter((cardId) => completed.has(cardId)),
  ]))
}

export function getCaptainLevelUpCompletedPlayerIdsForRun(
  challenge: CaptainLevelUpChallenge,
  sessions: CaptainLevelUpTimedSessionSignal[],
  launchedAt: string,
  closedAt = '',
) {
  const launchedAtTime = new Date(launchedAt).getTime()
  const closedAtTime = closedAt ? new Date(closedAt).getTime() : Number.POSITIVE_INFINITY
  return getCaptainLevelUpCompletedPlayerIds(
    challenge,
    sessions.filter((session) => {
      const completedAtTime = new Date(session.completedAt).getTime()
      return completedAtTime >= launchedAtTime && completedAtTime <= closedAtTime
    }),
  )
}

export function selectActiveCaptainLevelUpChallenge(
  launches: CaptainLevelUpChallengeLaunch[],
) {
  let selected: CaptainLevelUpChallengeLaunch | null = null
  for (const launch of launches) {
    if (!launch.id || launch.status === 'closed' || launch.status === 'scheduled') continue
    const launchTime = new Date(launch.createdAt).getTime()
    const selectedTime = selected ? new Date(selected.createdAt).getTime() : Number.NEGATIVE_INFINITY
    if (!selected || launchTime > selectedTime || (launchTime === selectedTime && launch.id > selected.id)) {
      selected = launch
    }
  }
  return selected?.id || ''
}

export function getCaptainLevelUpAggregateCompletionLabel(progress: CaptainLevelUpChallengeProgress | null) {
  if (!progress) return 'Checking connected team progress...'
  if (!progress.launched) {
    return progress.connectedCount
      ? `${progress.connectedCount} connected teammate${progress.connectedCount === 1 ? '' : 's'} can join`
      : 'Connect teammates to track progress'
  }
  return `${progress.completedCount} of ${progress.connectedCount} connected teammate${progress.connectedCount === 1 ? '' : 's'} completed`
}

function normalizeCardSignal(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function buildRecommendation(challengeId: string, reason: string): CaptainLevelUpRecommendation {
  const challenge = buildCaptainLevelUpChallenge(challengeId)
  if (!challenge) throw new Error(`Unknown Captain Level Up challenge: ${challengeId}`)
  return { challenge, reason }
}

function getDaysBetweenDateKeys(startValue = '', endValue = '') {
  const start = parseDateKey(startValue)
  const end = parseDateKey(endValue)
  if (start === null || end === null) return null
  return Math.round((end - start) / 86_400_000)
}

function parseDateKey(value: string) {
  const dateKey = value.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null
  const parsed = new Date(`${dateKey}T00:00:00.000Z`)
  const timestamp = parsed.getTime()
  return !Number.isNaN(timestamp) && parsed.toISOString().slice(0, 10) === dateKey
    ? timestamp
    : null
}

function formatCardTitle(cardId: string) {
  return cardId
    .split('-')
    .filter(Boolean)
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '')
    .join(' ')
}
