export type TeamRoomFinalLineupReceipt = {
  lineupId: string
  sourceMessageId: string
  announcementMessageId: string
  sentAt: string
  sentByUserId: string
  sentByName: string
}

export type TeamRoomLineupAnnouncement = {
  kind: 'final' | 'change'
  sourceMessageId: string
  lineupId: string
  previousFinalLineupId: string
}

export type TeamRoomLineupAnnouncementStatus = 'current' | 'pending' | 'superseded' | 'past'

export type TeamRoomFinalLineupReview = {
  requiredCount: number
  seenCount: number
  seenProfileIds: string[]
  unseenProfileIds: string[]
  unseenNames: string[]
  currentUserRequired: boolean
  currentUserSeen: boolean
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

export function readTeamRoomLineupAnnouncement(value: unknown): TeamRoomLineupAnnouncement | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const kind = row.finalLineupAnnouncement === true
    ? 'final'
    : row.finalLineupChangeAnnouncement === true ? 'change' : null
  const sourceMessageId = cleanText(row.sourceMessageId)
  if (!kind || !sourceMessageId) return null
  return {
    kind,
    sourceMessageId,
    lineupId: cleanText(row.lineupId),
    previousFinalLineupId: cleanText(row.previousFinalLineupId),
  }
}

export function getTeamRoomLineupAnnouncementStatus(input: {
  announcementMessageId: string
  sourceMessageId: string
  currentReceipt: TeamRoomFinalLineupReceipt | null
  activeSourceMessageId: string
  pendingAnnouncementMessageId?: string
}): TeamRoomLineupAnnouncementStatus {
  if (cleanText(input.announcementMessageId) === input.currentReceipt?.announcementMessageId) return 'current'
  if (cleanText(input.announcementMessageId) === cleanText(input.pendingAnnouncementMessageId)) return 'pending'
  if (cleanText(input.sourceMessageId) === cleanText(input.activeSourceMessageId)) return 'superseded'
  return 'past'
}

export function buildTeamRoomFinalLineupReview(input: {
  members: Array<{ id: string; name: string; playerName?: string }>
  lineup: Array<{ players: string[] }>
  seenProfileIds: string[]
  publisherUserId: string
  currentUserId: string
}): TeamRoomFinalLineupReview {
  const lineupNames = new Set(input.lineup.flatMap((court) => court.players.map(normalizePersonKey)).filter(Boolean))
  const requiredMembers = Array.from(new Map(input.members.map((member) => [member.id, member])).values())
    .filter((member) => [member.name, member.playerName].map(normalizePersonKey).some((name) => lineupNames.has(name)))
  const seenIds = new Set(input.seenProfileIds.map(cleanText).filter(Boolean))
  if (input.publisherUserId) seenIds.add(cleanText(input.publisherUserId))
  const seenMembers = requiredMembers.filter((member) => seenIds.has(member.id))
  const unseenMembers = requiredMembers.filter((member) => !seenIds.has(member.id))
  const requiredIds = new Set(requiredMembers.map((member) => member.id))
  return {
    requiredCount: requiredMembers.length,
    seenCount: seenMembers.length,
    seenProfileIds: seenMembers.map((member) => member.id),
    unseenProfileIds: unseenMembers.map((member) => member.id),
    unseenNames: unseenMembers.map((member) => member.name),
    currentUserRequired: requiredIds.has(input.currentUserId),
    currentUserSeen: requiredIds.has(input.currentUserId) && seenIds.has(input.currentUserId),
  }
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

function normalizePersonKey(value: unknown) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
