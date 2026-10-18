type CaptainLineupAnnouncement = {
  dateText: string
  opponent: string
  lineupText: string
  matchTime?: string | null
  location: string
  arrivalTime: string
}

export function buildCaptainLineupAnnouncement(details: CaptainLineupAnnouncement): string {
  const { dateText, opponent, lineupText, matchTime, location, arrivalTime } = details
  return [
    `Lineup is set for ${dateText} vs ${opponent || 'the opponent'}:`,
    lineupText || 'Line assignments are being finalized.',
    matchTime?.trim() ? `Match time: ${matchTime.trim()}.` : '',
    location.trim() ? `Location: ${location.trim()}` : '',
    `Arrive by ${arrivalTime.trim() || matchTime?.trim() || 'match time'}.`,
  ].filter(Boolean).join('\n')
}
