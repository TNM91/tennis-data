type PracticeHistorySetup = {
  focusId: string
  workType: string
  context: string
  assignmentId?: string
  studentLinkId?: string
}

export function buildPracticeHistoryRepeatHref(identitySlug: string, session: PracticeHistorySetup, source: { cardId: string } | { drillId: string } | null) {
  if (!source) return ''
  const params = new URLSearchParams({ focus: session.focusId, workType: session.workType, context: session.context })
  if ('cardId' in source) params.set('card', source.cardId)
  else params.set('drill', source.drillId)
  if (session.assignmentId) params.set('assignmentId', session.assignmentId)
  if (session.studentLinkId) params.set('studentLinkId', session.studentLinkId)
  if (session.assignmentId || session.studentLinkId) params.set('coach', '1')
  return '/level-up/' + encodeURIComponent(identitySlug) + '?' + params.toString() + '#level-up-flow'
}
