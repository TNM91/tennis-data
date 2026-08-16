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
