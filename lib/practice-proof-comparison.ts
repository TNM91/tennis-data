type PracticeProof = {
  id: string
  cardId?: string
  focusId: string
  workType: string
  context: string
  drillTitle: string
  rating: number
  completedAt: string
}

export function getPreviousPracticeProof(current: PracticeProof, sessions: PracticeProof[]) {
  const completedAt = Date.parse(current.completedAt)
  if (!Number.isFinite(completedAt)) return null
  return sessions.filter((session) => {
    const earlierAt = Date.parse(session.completedAt)
    const sameDrill = current.cardId
      ? session.cardId === current.cardId
      : !session.cardId && session.drillTitle === current.drillTitle
    return session.id !== current.id && sameDrill && session.focusId === current.focusId &&
      session.workType === current.workType && session.context === current.context &&
      Number.isFinite(session.rating) && session.rating >= 0 && session.rating <= 5 &&
      Number.isFinite(earlierAt) && earlierAt < completedAt
  }).sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))[0] ?? null
}
