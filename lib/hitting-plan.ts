import { eventCalendarStart } from './calendar-date'

export const hittingPlanTimeZone = 'America/Chicago'
export type HittingPlan = { clubId: string; confirmedFor?: string }

export function readHittingPlan(value: unknown): HittingPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Review the hitting plan.')
  const { clubId, confirmedFor, ...rest } = value as Record<string, unknown>
  if (Object.keys(rest).length || typeof clubId !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(clubId) ||
      confirmedFor !== undefined && (typeof confirmedFor !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(confirmedFor))) {
    throw Error('Review the hitting plan.')
  }
  return confirmedFor ? { clubId, confirmedFor } : { clubId }
}

export function isHittingPlanEntry(entry: { kind: string; recurrenceRule: string; time: string; venueDirectoryId?: string; venuePreferenceId?: string }) {
  return entry.kind === 'match' && !entry.recurrenceRule && Boolean(entry.time) && !entry.venueDirectoryId && !entry.venuePreferenceId
}

export function hittingPlanConfirmed(entry: { date: string; time: string; hittingPlan?: HittingPlan }) {
  return entry.hittingPlan?.confirmedFor === `${entry.date}T${entry.time}`
}

export function hittingPlanStart(entry: { date: string; time: string }) {
  return eventCalendarStart(entry.date, entry.time, hittingPlanTimeZone)
}
