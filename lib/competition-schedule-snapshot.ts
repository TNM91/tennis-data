type ScheduleSnapshot = { date: string; time: string; location: string }

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function clock(value: unknown) {
  return cleanText(value).replace(/^(\d{2}:\d{2}):00(?:\.0+)?$/, '$1')
}

function site(value: unknown, tournament: boolean) {
  const location = cleanText(value)
  // Older tournament replies stored "Court" before the published court label.
  return tournament ? location.replace(/(^| · )(?:Court\s+)+(?=[^·]+$)/i, '$1') : location
}

export function sameCompetitionScheduleSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
  current: ScheduleSnapshot,
  tournament = false,
) {
  return cleanText(snapshot?.date) === cleanText(current.date)
    && clock(snapshot?.time) === clock(current.time)
    && site(snapshot?.location, tournament) === site(current.location, tournament)
}
