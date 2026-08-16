import { LEVEL_UP_CARDS } from '@/lib/level-up/level-up-cards'
import type { LevelUpCompletion } from '@/lib/level-up/level-up-types'
import type { LevelUpSession } from '@/lib/level-up-sessions'

export type MyLabLevelUpProofSource = 'device' | 'account' | 'account-and-device'

export type MyLabLevelUpProofRecord = {
  id: string
  cardId: string
  cardTitle: string
  identitySlug: string
  rating: number | null
  note: string
  completedAt: string
  durationMinutes: number | null
  nextCue: string
  sharedWithCoach: boolean
  source: MyLabLevelUpProofSource
}

export type MyLabWeeklyImprovementPlanMode = 'baseline' | 'repeat' | 'pressure'

export type MyLabWeeklyImprovementPlan = {
  mode: MyLabWeeklyImprovementPlanMode
  modeLabel: string
  cardId: string
  cardTitle: string
  identitySlug: string
  focusLabel: string
  completedSessions: number
  targetSessions: number
  progressPercent: number
  progressLabel: string
  nextAction: string
  nextCta: string
  nextHref: string
  proofTarget: string
  why: string
  trendLabel: string
  coachSummary: string
}

export function mergeMyLabLevelUpProofRecords(
  localCompletions: LevelUpCompletion[],
  remoteSessions: LevelUpSession[],
) {
  const byId = new Map<string, MyLabLevelUpProofRecord>()

  for (const completion of localCompletions) {
    const card = LEVEL_UP_CARDS.find((candidate) => candidate.id === completion.cardId)
    byId.set(completion.id, {
      id: completion.id,
      cardId: completion.cardId,
      cardTitle: card?.title || 'Level Up card',
      identitySlug: card?.identitySlugs?.[0] || 'relentless-competitor-4-0',
      rating: typeof completion.proofRating === 'number' ? completion.proofRating : null,
      note: completion.note?.trim() || '',
      completedAt: completion.completedAt,
      durationMinutes: typeof completion.durationMinutes === 'number' ? completion.durationMinutes : null,
      nextCue: '',
      sharedWithCoach: false,
      source: 'device',
    })
  }

  for (const session of remoteSessions) {
    const card = resolveRemoteLevelUpCard(session)
    const existing = byId.get(session.id)
    const sessionCardId = card?.id || session.sessionJson.cardId || existing?.cardId || session.focusId

    byId.set(session.id, {
      id: session.id,
      cardId: sessionCardId,
      cardTitle: card?.title || session.drillTitle || existing?.cardTitle || 'Level Up card',
      identitySlug: session.identitySlug || card?.identitySlugs?.[0] || existing?.identitySlug || 'relentless-competitor-4-0',
      rating: session.rating,
      note: session.note.trim() || existing?.note || '',
      completedAt: session.completedAt,
      durationMinutes: Math.max(1, Math.round(session.elapsedSeconds / 60)) || existing?.durationMinutes || null,
      nextCue: session.starterRead?.starterSmartNext || existing?.nextCue || '',
      sharedWithCoach: session.sharedWithCoach,
      source: existing ? 'account-and-device' : 'account',
    })
  }

  return [...byId.values()]
    .sort((left, right) => getTimestamp(right.completedAt) - getTimestamp(left.completedAt))
    .slice(0, 40)
}

export function buildMyLabWeeklyImprovementPlan(
  proofs: MyLabLevelUpProofRecord[],
  now = new Date(),
): MyLabWeeklyImprovementPlan {
  const targetSessions = 4
  const latestProof = proofs[0]
  const card = LEVEL_UP_CARDS.find((candidate) => candidate.id === latestProof?.cardId) ?? LEVEL_UP_CARDS[0]
  const cardTitle = latestProof?.cardTitle || card?.title || 'First Level Up rep'
  const identitySlug = latestProof?.identitySlug || card?.identitySlugs?.[0] || 'relentless-competitor-4-0'
  const currentWeekProofs = proofs.filter((proof) => isInCurrentWeek(proof.completedAt, now))
  const completedSessions = Math.min(targetSessions, currentWeekProofs.length)
  const rating = latestProof?.rating ?? null
  const cardRatings = proofs
    .filter((proof) => proof.cardId === latestProof?.cardId && typeof proof.rating === 'number')
    .slice(0, 3)
    .map((proof) => proof.rating as number)
  const trendLabel = buildTrendLabel(cardRatings)
  const mode: MyLabWeeklyImprovementPlanMode = !latestProof
    ? 'baseline'
    : rating !== null && rating >= 4
      ? 'pressure'
      : 'repeat'
  const nextAction = mode === 'baseline'
    ? card?.routine?.[0] || 'Run one short rep and score it honestly.'
    : mode === 'pressure'
      ? card?.progression || latestProof?.nextCue || 'Add one pressure layer while keeping the same proof standard.'
      : rating !== null && rating <= 2
        ? card?.regression || latestProof?.nextCue || 'Scale the rep down and chase one clean cue.'
        : latestProof?.nextCue || 'Repeat the same card cleaner before changing the plan.'
  const modeLabel = mode === 'pressure' ? 'Add pressure' : mode === 'repeat' ? 'Repeat cleaner' : 'Build baseline'
  const nextCta = mode === 'pressure' ? 'Run pressure rep' : mode === 'repeat' ? 'Repeat cleaner' : 'Start first rep'
  const proofTarget = card?.proof || (latestProof?.rating === null ? 'Save one honest 0-5 proof score.' : `${latestProof?.rating}/5 proof`)
  const why = !latestProof
    ? 'One scored rep gives My Lab enough signal to adjust the next practice.'
    : rating === null
      ? 'The rep is saved, but it needs a proof score before the plan should change.'
      : rating >= 4
        ? `${cardTitle} scored ${rating}/5. Keep the cue and test it under more pressure.`
        : rating <= 2
          ? `${cardTitle} scored ${rating}/5. Make the rep easier before adding speed or pressure.`
          : `${cardTitle} scored ${rating}/5. One cleaner repeat is more useful than a new drill.`
  const coachSummary = latestProof
    ? `${cardTitle}: ${rating === null ? 'proof saved' : `${rating}/5`}. Next: ${nextAction}`
    : `${cardTitle}: build a baseline with one scored rep.`

  return {
    mode,
    modeLabel,
    cardId: latestProof?.cardId || card?.id || '',
    cardTitle,
    identitySlug,
    focusLabel: card?.pack || 'Level Up',
    completedSessions,
    targetSessions,
    progressPercent: Math.round((completedSessions / targetSessions) * 100),
    progressLabel: `${completedSessions} of ${targetSessions} proof sessions`,
    nextAction,
    nextCta,
    nextHref: latestProof
      ? `/level-up/${identitySlug}?card=${encodeURIComponent(latestProof.cardId)}#level-up-flow`
      : card
        ? `/level-up/${identitySlug}?card=${encodeURIComponent(card.id)}#level-up-flow`
        : '/level-up',
    proofTarget,
    why,
    trendLabel,
    coachSummary,
  }
}

function resolveRemoteLevelUpCard(session: LevelUpSession) {
  const savedCardId = session.sessionJson.cardId
  const normalizedTitle = normalizeTitle(session.drillTitle)

  return LEVEL_UP_CARDS.find((candidate) => candidate.id === savedCardId)
    ?? LEVEL_UP_CARDS.find((candidate) => candidate.id === session.focusId)
    ?? LEVEL_UP_CARDS.find((candidate) => normalizeTitle(candidate.title) === normalizedTitle)
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function getTimestamp(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function isInCurrentWeek(value: string, now: Date) {
  const completedAt = new Date(value)
  if (Number.isNaN(completedAt.getTime())) return false

  const weekStart = new Date(now)
  const day = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1))
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  return completedAt >= weekStart && completedAt < weekEnd
}

function buildTrendLabel(ratings: number[]) {
  if (ratings.length < 2) return ratings.length ? 'Baseline set' : 'No baseline yet'
  const change = ratings[0] - ratings[1]
  if (change > 0) return `Improving +${change}`
  if (change < 0) return `Reset ${change}`
  return 'Holding steady'
}
