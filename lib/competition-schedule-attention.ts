import {
  splitCompetitionReminderTargetsByCooldown,
  type CompetitionReminderHistoryRow,
  type CompetitionReminderTarget,
} from './competition-schedule-reminder-cooldown'

export type OrganizerScheduleAttentionState = 'unavailable' | 'changed' | 'waiting'

export type OrganizerScheduleEvent = {
  eventId: string
  competitionKind: 'league' | 'tournament'
  competitionId: string
  competitionName: string
  matchLabel: string
  date: string
  time: string
  location: string
  href: string
  players: Array<{ userId: string; playerName: string }>
}

export type OrganizerScheduleResponseRow = {
  eventId: string
  playerUserId: string
  response: 'available' | 'unavailable'
  eventSnapshot: { date: string; time: string; location: string }
}

export type OrganizerScheduleAttentionItem = OrganizerScheduleEvent & {
  availableCount: number
  unavailableCount: number
  changedCount: number
  waitingCount: number
  remindedCount: number
  lastReminderAt: string
  reminderCooldownUntil: string
  state: OrganizerScheduleAttentionState
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function sameSnapshot(
  response: OrganizerScheduleResponseRow,
  event: Pick<OrganizerScheduleEvent, 'date' | 'time' | 'location'>,
) {
  return cleanText(response.eventSnapshot.date) === cleanText(event.date)
    && cleanText(response.eventSnapshot.time) === cleanText(event.time)
    && cleanText(response.eventSnapshot.location) === cleanText(event.location)
}

export function buildOrganizerScheduleAttentionItems(input: {
  events: OrganizerScheduleEvent[]
  responses: OrganizerScheduleResponseRow[]
  reminderHistory?: CompetitionReminderHistoryRow[]
  today?: string
  now?: string
}): OrganizerScheduleAttentionItem[] {
  const today = cleanText(input.today) || new Date().toISOString().slice(0, 10)
  const responseByEventAndPlayer = new Map(
    input.responses.map((response) => [`${response.eventId}:${response.playerUserId}`, response]),
  )

  return input.events
    .filter((event) => cleanText(event.date) >= today && event.players.length > 0)
    .flatMap((event) => {
      let availableCount = 0
      let unavailableCount = 0
      let changedCount = 0
      let waitingCount = 0
      const reminderTargets: CompetitionReminderTarget[] = []

      for (const player of event.players) {
        const response = responseByEventAndPlayer.get(`${event.eventId}:${player.userId}`)
        if (!response) {
          waitingCount += 1
          reminderTargets.push({ playerUserId: player.userId, playerName: player.playerName })
        } else if (!sameSnapshot(response, event)) {
          changedCount += 1
          reminderTargets.push({ playerUserId: player.userId, playerName: player.playerName })
        } else if (response.response === 'unavailable') {
          unavailableCount += 1
        } else {
          availableCount += 1
        }
      }

      if (!unavailableCount && !changedCount && !waitingCount) return []
      const state: OrganizerScheduleAttentionState = unavailableCount
        ? 'unavailable'
        : changedCount
          ? 'changed'
          : 'waiting'
      const cooldown = splitCompetitionReminderTargetsByCooldown({
        eventId: event.eventId,
        targets: reminderTargets,
        history: input.reminderHistory ?? [],
        currentSnapshot: { date: event.date, time: event.time, location: event.location },
        now: input.now,
      })

      return [{
        ...event,
        availableCount,
        unavailableCount,
        changedCount,
        waitingCount,
        remindedCount: cooldown.coolingDown.length,
        lastReminderAt: cooldown.lastReminderAt,
        reminderCooldownUntil: cooldown.nextReminderAt,
        state,
      }]
    })
    .sort((left, right) => {
      const priority = { unavailable: 0, changed: 1, waiting: 2 }
      return priority[left.state] - priority[right.state]
        || `${left.date} ${left.time || '23:59'}`.localeCompare(`${right.date} ${right.time || '23:59'}`)
    })
}
