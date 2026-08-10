export const COMPETITION_REMINDER_COOLDOWN_HOURS = 24
export const COMPETITION_REMINDER_COOLDOWN_MS = COMPETITION_REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000

export type CompetitionReminderTarget = {
  playerUserId: string
  playerName: string
}

export type CompetitionReminderHistoryRow = {
  eventId: string
  playerUserId: string
  eventSnapshot: { date: string; time: string; location: string }
  sentAt: string
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

export function sameCompetitionScheduleSnapshot(
  snapshot: CompetitionReminderHistoryRow['eventSnapshot'],
  current: CompetitionReminderHistoryRow['eventSnapshot'],
) {
  return cleanText(snapshot.date) === cleanText(current.date)
    && cleanText(snapshot.time) === cleanText(current.time)
    && cleanText(snapshot.location) === cleanText(current.location)
}

export function splitCompetitionReminderTargetsByCooldown(input: {
  eventId: string
  targets: CompetitionReminderTarget[]
  history: CompetitionReminderHistoryRow[]
  currentSnapshot: CompetitionReminderHistoryRow['eventSnapshot']
  now?: string
}) {
  const nowMs = Date.parse(input.now || new Date().toISOString())
  const historyByPlayer = new Map<string, CompetitionReminderHistoryRow[]>()
  for (const row of input.history) {
    if (row.eventId !== input.eventId || !sameCompetitionScheduleSnapshot(row.eventSnapshot, input.currentSnapshot)) continue
    const rows = historyByPlayer.get(row.playerUserId) ?? []
    rows.push(row)
    historyByPlayer.set(row.playerUserId, rows)
  }

  const eligible: CompetitionReminderTarget[] = []
  const coolingDown: CompetitionReminderTarget[] = []
  let nextReminderAt = ''
  let lastReminderAt = ''

  for (const target of input.targets) {
    const latest = (historyByPlayer.get(target.playerUserId) ?? [])
      .sort((left, right) => Date.parse(right.sentAt) - Date.parse(left.sentAt))[0]
    const latestMs = Date.parse(latest?.sentAt || '')
    const cooldownUntilMs = latestMs + COMPETITION_REMINDER_COOLDOWN_MS
    if (Number.isFinite(latestMs) && cooldownUntilMs > nowMs) {
      coolingDown.push(target)
      const cooldownUntil = new Date(cooldownUntilMs).toISOString()
      if (!nextReminderAt || cooldownUntil < nextReminderAt) nextReminderAt = cooldownUntil
      if (!lastReminderAt || latest.sentAt > lastReminderAt) lastReminderAt = latest.sentAt
    } else {
      eligible.push(target)
    }
  }

  return { eligible, coolingDown, nextReminderAt, lastReminderAt }
}
