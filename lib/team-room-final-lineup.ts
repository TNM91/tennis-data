export type TeamRoomFinalLineupReceipt = {
  lineupId: string
  sourceMessageId: string
  announcementMessageId: string
  sentAt: string
  sentByUserId: string
  sentByName: string
}

export function buildTeamRoomFinalLineupReceipt(input: TeamRoomFinalLineupReceipt) {
  return {
    lineupId: cleanText(input.lineupId),
    sourceMessageId: cleanText(input.sourceMessageId),
    announcementMessageId: cleanText(input.announcementMessageId),
    sentAt: cleanText(input.sentAt),
    sentByUserId: cleanText(input.sentByUserId),
    sentByName: cleanText(input.sentByName),
  } satisfies TeamRoomFinalLineupReceipt
}

export function readTeamRoomFinalLineupReceipt(value: unknown): TeamRoomFinalLineupReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const receipt = buildTeamRoomFinalLineupReceipt({
    lineupId: cleanText(row.lineupId),
    sourceMessageId: cleanText(row.sourceMessageId),
    announcementMessageId: cleanText(row.announcementMessageId),
    sentAt: cleanText(row.sentAt),
    sentByUserId: cleanText(row.sentByUserId),
    sentByName: cleanText(row.sentByName),
  })
  return receipt.lineupId
    && receipt.sourceMessageId
    && receipt.announcementMessageId
    && receipt.sentAt
    && receipt.sentByUserId
    ? receipt
    : null
}

export function isTeamRoomFinalLineupSent(value: unknown, lineupId: string) {
  return readTeamRoomFinalLineupReceipt(value)?.lineupId === cleanText(lineupId)
}

export function buildPublishedLineupChangeAnnouncement(input: {
  courtLabel: string
  outgoingPlayerName: string
  replacementPlayerName: string
  afterPlayers: string[]
  matchDate?: string | null
  opponent?: string | null
}) {
  const opponent = cleanText(input.opponent)
  const matchContext = [
    cleanText(input.matchDate),
    opponent ? `vs ${opponent}` : '',
  ].filter(Boolean).join(' ')
  const courtLabel = cleanText(input.courtLabel) || 'Court'
  const players = input.afterPlayers.map(cleanText).filter(Boolean).join(' / ')
  return [
    `Final lineup changed${matchContext ? ` — ${matchContext}` : ''}`,
    `${courtLabel}: ${players || input.replacementPlayerName}`,
    `${cleanText(input.replacementPlayerName)} replaces ${cleanText(input.outgoingPlayerName)}.`,
    `${cleanText(input.replacementPlayerName)}, please confirm this court.`,
  ].filter(Boolean).join('\n')
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
