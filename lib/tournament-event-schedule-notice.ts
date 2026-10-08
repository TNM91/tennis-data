import { formatTournamentEventDate, formatTournamentEventTime } from './tournament-event-presentation'
import type { TiqTournamentMatchSchedule } from './tiq-tournament-registry'

export type EventScheduleChange = {
  previous: { date: string; time: string; court: string }
  sideA: string
  sideB: string
  changedAt: string
}

export function normalizeEventScheduleChange(value: unknown): EventScheduleChange | undefined {
  if (!value || typeof value !== 'object') return
  const change = value as Partial<EventScheduleChange>
  if (!change.previous || typeof change.previous !== 'object' || typeof change.sideA !== 'string'
    || typeof change.sideB !== 'string' || typeof change.changedAt !== 'string'
    || !Number.isFinite(Date.parse(change.changedAt))) return
  const { date, time, court } = change.previous
  if (typeof date !== 'string' || typeof time !== 'string' || typeof court !== 'string') return
  return { previous: { date, time, court }, sideA: change.sideA.trim(), sideB: change.sideB.trim(), changedAt: change.changedAt }
}

export function recordEventScheduleChange(previous: TiqTournamentMatchSchedule | undefined,
  next: { date: string; time: string; court: string; updatedAt: string }, sideA: string, sideB: string): EventScheduleChange | undefined {
  if (!previous) return
  if (previous.date === next.date && previous.time === next.time && previous.court === next.court) return previous.change
  return { previous: { date: previous.date, time: previous.time, court: previous.court }, sideA, sideB, changedAt: next.updatedAt }
}

export function formatEventScheduleSlot(slot: { date: string; time: string; court: string }, zone = '') {
  if (!slot.date && !slot.time && !slot.court) return 'Assignment pending'
  return [slot.date ? formatTournamentEventDate(slot.date, true) : 'Date pending', slot.time ? formatTournamentEventTime(slot.time) : 'Time pending', zone, slot.court || 'Court pending'].filter(Boolean).join(' · ')
}

export function buildEventScheduleNoticeMessage(name: string, label: string, schedule: TiqTournamentMatchSchedule, zone = '') {
  if (!schedule.change) return ''
  return `${name} — schedule update\n${label}: ${schedule.change.sideA} vs ${schedule.change.sideB}\nPreviously: ${formatEventScheduleSlot(schedule.change.previous, zone)}\nNow: ${formatEventScheduleSlot(schedule, zone)}\nPlease check your event pass or the event desk before heading to court.`
}
