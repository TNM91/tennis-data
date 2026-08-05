export type CaptainLineupConfirmationSeenEntry = {
  userId: string
  confirmationId: string
  seenAt: string
}

export type CaptainConfirmedLineupChange = {
  messageId: string
  respondedAt: string
  courtLabel: string
  outgoingPlayerName: string
  replacementPlayerName: string
  afterPlayers: string[]
}

export function buildCaptainLineupConfirmationId(change: CaptainConfirmedLineupChange) {
  return [
    change.messageId.trim(),
    change.respondedAt.trim(),
    normalizeKey(change.courtLabel),
    normalizeKey(change.replacementPlayerName),
  ].filter(Boolean).join(':')
}

export function buildCaptainLineupConfirmationShareBody(input: {
  change: CaptainConfirmedLineupChange
  matchDate?: string | null
  opponent?: string | null
}) {
  const matchContext = [input.matchDate?.trim(), input.opponent?.trim() ? `vs ${input.opponent.trim()}` : '']
    .filter(Boolean)
    .join(' ')
  const courtPlayers = input.change.afterPlayers.map((name) => name.trim()).filter(Boolean).join(' / ')
  return [
    `${input.change.courtLabel.trim() || 'Court'} confirmed${matchContext ? ` for ${matchContext}` : ''}: ${input.change.replacementPlayerName.trim()} is in for ${input.change.outgoingPlayerName.trim()}.`,
    courtPlayers ? `Court: ${courtPlayers}.` : '',
  ].filter(Boolean).join(' ')
}

export function hasSeenCaptainLineupConfirmation(
  entries: CaptainLineupConfirmationSeenEntry[],
  userId: string,
  confirmationId: string,
) {
  return entries.some((entry) => entry.userId === userId && entry.confirmationId === confirmationId)
}

export function rememberCaptainLineupConfirmation(
  entries: CaptainLineupConfirmationSeenEntry[],
  input: CaptainLineupConfirmationSeenEntry,
  limit = 100,
) {
  return [
    input,
    ...entries.filter((entry) => !(
      entry.userId === input.userId && entry.confirmationId === input.confirmationId
    )),
  ].slice(0, limit)
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
