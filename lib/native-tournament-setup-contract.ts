import { isValidCalendarDate } from './calendar-date'
import {
  nativeTournamentPublicationId, readSavedTournamentDraft, tournamentDraftFormats, tournamentDraftRevision,
  type SavedTournamentDraft, type TournamentDraft,
} from './native-tournament-draft-contract'
import { normalizeTournamentEventDetails } from './tournament-event-presentation'

export const maxTournamentDivisions = 20
export const tournamentTimeZones = {
  'America/New_York': 'Eastern',
  'America/Chicago': 'Central',
  'America/Denver': 'Mountain',
  'America/Phoenix': 'Arizona',
  'America/Los_Angeles': 'Pacific',
  'America/Anchorage': 'Alaska',
  'America/Adak': 'Aleutian',
  'Pacific/Honolulu': 'Hawaii',
  'America/Puerto_Rico': 'Atlantic',
} as const

export type TournamentDivisionSetup = Pick<TournamentDraft, 'discipline' | 'format'> & { id: string; name: string }
export type TournamentSettings = {
  registrationClosesOn: string
  timeZone: string
  divisions: TournamentDivisionSetup[]
}
export type NativeTournamentSetup = SavedTournamentDraft & {
  settings: TournamentSettings | null
  settingsRevision: string | null
  publicId?: string
}
export type TournamentSettingsWrite = {
  event: string
  expected: string | null
  revision: string
  settings: TournamentSettings
}

export function initialTournamentSettings(setup: SavedTournamentDraft): TournamentSettings {
  const { draft, revision } = setup
  return {
    registrationClosesOn: draft.date,
    timeZone: '',
    divisions: [{ id: revision, name: draft.division, discipline: draft.discipline, format: draft.format }],
  }
}

export function readTournamentSettings(input: unknown): TournamentSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Check the tournament settings.')
  const { registrationClosesOn, timeZone, divisions } = input as Partial<TournamentSettings>
  const eventDetails = normalizeTournamentEventDetails({ registrationClosesOn, timeZone })
  if (!registrationClosesOn || !isValidCalendarDate(registrationClosesOn)) throw Error('Choose a valid registration deadline.')
  if (!eventDetails.timeZone) throw Error('Choose the tournament time zone.')
  if (!Array.isArray(divisions) || !divisions.length || divisions.length > maxTournamentDivisions) {
    throw Error(`Keep between 1 and ${maxTournamentDivisions} divisions.`)
  }
  const normalized = divisions.map(division => {
    if (!division || !tournamentDraftRevision(division.id) || typeof division.name !== 'string' ||
        !division.name.trim() || division.name.length > 80 ||
        (division.discipline !== 'singles' && division.discipline !== 'doubles') ||
        !Object.hasOwn(tournamentDraftFormats, division.format)) {
      throw Error('Give each division a name and choose its entry type and draw format.')
    }
    return { id: division.id, name: division.name.trim().replace(/\s+/g, ' '), discipline: division.discipline, format: division.format }
  })
  if (new Set(normalized.map(division => division.name.toLowerCase())).size !== normalized.length ||
      new Set(normalized.map(division => division.id)).size !== normalized.length) {
    throw Error('Use a different name for each division.')
  }
  return { registrationClosesOn, timeZone: eventDetails.timeZone, divisions: normalized }
}

export function readNativeTournamentSetup(input: unknown): NativeTournamentSetup {
  const event = readSavedTournamentDraft(input)
  const { settings, settingsRevision, publicId } = input as Partial<NativeTournamentSetup>
  if (publicId !== undefined && !nativeTournamentPublicationId(publicId, 'event')) throw Error('Invalid public tournament')
  if (settings === null && settingsRevision === null) return { ...event, settings, settingsRevision }
  if (!tournamentDraftRevision(settingsRevision)) throw Error('Invalid tournament settings revision')
  const valid = readTournamentSettings(settings)
  if (valid.registrationClosesOn > event.draft.date) throw Error('Registration must close by the tournament date.')
  return { ...event, settings: valid, settingsRevision, ...(publicId ? { publicId } : {}) }
}
