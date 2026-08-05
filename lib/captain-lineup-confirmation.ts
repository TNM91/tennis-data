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
  kind: 'court' | 'task' | 'complete'
  eyebrow: string
  title: string
  detail: string
  cta: string
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
