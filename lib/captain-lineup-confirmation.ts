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

export type CaptainLineupConfirmationNextStep = {
  kind: 'court' | 'locked' | 'task' | 'complete'
  eyebrow: string
  title: string
  detail: string
  cta: string
}

export type CaptainLockedLineupRow = {
  label: string
  players: string[]
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

export function isCaptainLineupLocked(input: {
  confirmedCount: number
  totalCount: number
  lineup: CaptainLockedLineupRow[]
}) {
  return input.totalCount > 0
    && input.confirmedCount >= input.totalCount
    && input.lineup.length >= input.totalCount
}

export function buildCaptainLockedLineupId(input: {
  messageId: string
  lineup: CaptainLockedLineupRow[]
}) {
  const lineupSignature = input.lineup.map((row) => [
    normalizeKey(row.label),
    ...row.players.map(normalizeKey).filter(Boolean),
  ].join(':')).join('|')
  return ['lineup-locked', input.messageId.trim(), stableHash(lineupSignature)].filter(Boolean).join(':')
}

export function buildCaptainLockedLineupAnnouncement(input: {
  lineup: CaptainLockedLineupRow[]
  matchDate?: string | null
  opponent?: string | null
  arrivalTime?: string | null
  facility?: string | null
}) {
  const opponent = cleanOptional(input.opponent)
  const matchContext = [
    cleanOptional(input.matchDate),
    opponent ? `vs ${opponent}` : '',
  ].filter(Boolean).join(' ')
  const lineupRows = input.lineup.flatMap((row) => {
    const players = row.players.map((name) => name.trim()).filter(Boolean)
    return players.length ? [`${row.label.trim() || 'Court'}: ${players.join(' / ')}`] : []
  })
  const arrivalTime = cleanOptional(input.arrivalTime, ['Add arrival'])
  const facility = cleanOptional(input.facility, ['Add location'])
  const logistics = arrivalTime && facility
    ? `Arrive by ${arrivalTime} at ${facility}.`
    : arrivalTime
      ? `Arrive by ${arrivalTime}. Location: TBD.`
      : facility ? `Match time: TBD. Location: ${facility}.` : 'Match time and location: TBD.'
  return [
    `Lineup locked${matchContext ? ` — ${matchContext}` : ''}`,
    ...lineupRows,
    logistics,
  ].filter(Boolean).join('\n')
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

export function buildCaptainLineupConfirmationNextStep(input: {
  nextCourt?: { label: string; status: 'waiting' | 'needs_captain' } | null
  nextTask?: { label: string; detail: string; cta: string } | null
  confirmedCount: number
  totalCount: number
}): CaptainLineupConfirmationNextStep {
  if (input.nextCourt) {
    return {
      kind: 'court',
      eyebrow: 'Next court',
      title: input.nextCourt.label,
      detail: input.nextCourt.status === 'needs_captain'
        ? `${input.nextCourt.label} needs your decision.`
        : `${input.nextCourt.label} is waiting on a player reply.`,
      cta: 'Open next court',
    }
  }

  if (input.totalCount > 0 && input.confirmedCount >= input.totalCount) {
    return {
      kind: 'locked',
      eyebrow: 'Lineup locked',
      title: `All ${input.totalCount} courts confirmed`,
      detail: 'Send the full lineup and match details to the team.',
      cta: 'Send final lineup',
    }
  }

  if (input.nextTask) {
    return {
      kind: 'task',
      eyebrow: input.totalCount > 0 && input.confirmedCount >= input.totalCount ? 'Courts ready' : 'Next match task',
      title: input.nextTask.label,
      detail: input.nextTask.detail,
      cta: input.nextTask.cta,
    }
  }

  return {
    kind: 'complete',
    eyebrow: 'Lineup ready',
    title: input.totalCount > 0 ? `All ${input.totalCount} courts confirmed` : 'Court is set',
    detail: 'Open Team Chat if the team needs an update.',
    cta: 'Open Team Chat',
  }
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function cleanOptional(value?: string | null, placeholders: string[] = []) {
  const clean = value?.trim() || ''
  return placeholders.includes(clean) ? '' : clean
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
