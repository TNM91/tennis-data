export function formatCaptainAvailabilityDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return 'the next match'
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function buildCaptainAvailabilityRequestMessage(input: {
  teamName: string
  opponentTeam?: string
  matchDate: string
  matchTime?: string
  facility?: string
  requestUrl: string
}) {
  const opponent = input.opponentTeam?.trim()
  const matchLine = [
    `${input.teamName.trim()}${opponent ? ` vs ${opponent}` : ''}`,
    formatCaptainAvailabilityDate(input.matchDate),
    input.matchTime?.trim(),
  ].filter(Boolean).join(' - ')

  return [
    'Can you play?',
    matchLine,
    input.facility?.trim() ? `Location: ${input.facility.trim()}` : '',
    `Reply here: ${input.requestUrl.trim()}`,
    'No TIQ account is needed.',
  ].filter(Boolean).join('\n')
}
