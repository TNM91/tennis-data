import { isValidCalendarDate } from './calendar-date'
import { nativeCompetitionTimeZones } from './native-competition-time-zones'
import { calculateTiqLeagueEndsOn } from './tiq-league-limits'
import { FIRST_PARTY_COMPETITION_FEES } from './first-party-competition-prices'

export const leagueDraftMaxWeeks = FIRST_PARTY_COMPETITION_FEES.league.maxWeeks
export const leagueDraftFormats = { team: 'Team league', individual: 'Individual league' } as const

export type LeagueDraft = {
  name: string
  location: string
  format: keyof typeof leagueDraftFormats
  startsOn: string
  weeks: number
  timeZone: string
}

export type SavedLeagueDraft = { draft: LeagueDraft; revision: string }
export type LeagueDraftWrite = SavedLeagueDraft & { expected: string | null }

export function isLeagueDraftRevision(input: unknown): input is string {
  return typeof input === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input)
}

export function readLeagueDraft(input: unknown): LeagueDraft {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Check your season details.')
  const { name, location, format, startsOn, weeks, timeZone } = input as Partial<LeagueDraft>
  if (typeof name !== 'string' || !name.trim() || name.length > 100 || name.includes('\0')) {
    throw Error('Enter a league name up to 100 characters.')
  }
  if (typeof location !== 'string' || location.length > 120 || location.includes('\0')) {
    throw Error('Enter a location up to 120 characters.')
  }
  if (format !== 'team' && format !== 'individual') throw Error('Choose a league format.')
  if (typeof startsOn !== 'string' || startsOn.startsWith('0000-') || !isValidCalendarDate(startsOn)) {
    throw Error('Choose a valid start date.')
  }
  if (typeof weeks !== 'number' || !Number.isInteger(weeks) || weeks < 1 || weeks > leagueDraftMaxWeeks) {
    throw Error(`Choose a season length from 1 to ${leagueDraftMaxWeeks} weeks.`)
  }
  if (!isValidCalendarDate(calculateTiqLeagueEndsOn(startsOn, weeks))) {
    throw Error('Choose an earlier start date.')
  }
  if (typeof timeZone !== 'string' || !Object.hasOwn(nativeCompetitionTimeZones, timeZone)) {
    throw Error('Choose your league time zone.')
  }
  return { name: name.trim(), location: location.trim(), format, startsOn, weeks, timeZone }
}

export function readSavedLeagueDraft(input: unknown): SavedLeagueDraft {
  const saved = input as Partial<SavedLeagueDraft> | null
  if (!isLeagueDraftRevision(saved?.revision)) throw Error('Invalid league draft revision.')
  return { draft: readLeagueDraft(saved.draft), revision: saved.revision }
}
