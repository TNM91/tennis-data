import { isValidCalendarDate } from './calendar-date'

export const tournamentDraftFormats = { single_elimination: 'Single elimination', round_robin: 'Round robin' } as const

export type TournamentDraft = {
  name: string
  date: string
  venue: string
  division: string
  discipline: 'singles' | 'doubles'
  format: keyof typeof tournamentDraftFormats
}

export type SavedTournamentDraft = { draft: TournamentDraft; revision: string }

export function readTournamentDraft(input: unknown): TournamentDraft | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return
  const { name, date, venue, division, discipline, format } = input as Partial<TournamentDraft>
  if (typeof name !== 'string' || !name.trim() || name.length > 100 ||
      typeof date !== 'string' || !isValidCalendarDate(date) ||
      typeof venue !== 'string' || !venue.trim() || venue.length > 120 ||
      typeof division !== 'string' || !division.trim() || division.length > 80 ||
      (discipline !== 'singles' && discipline !== 'doubles') ||
      (format !== 'single_elimination' && format !== 'round_robin')) return
  return { name: name.trim(), date, venue: venue.trim(), division: division.trim(), discipline, format }
}

export function readSavedTournamentDraft(input: unknown): SavedTournamentDraft {
  const row = input as Partial<SavedTournamentDraft> | null
  const draft = readTournamentDraft(row?.draft)
  if (!draft || !tournamentDraftRevision(row?.revision)) throw Error('Invalid saved tournament draft')
  return { draft, revision: row.revision }
}

export function tournamentDraftRevision(input: unknown): input is string {
  return typeof input === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input)
}

export function nativeTournamentPublicationId(input: unknown, kind: 'event' | 'division'): input is string {
  const prefix = 'tiq-native-' + kind + '-'
  return typeof input === 'string' && input.startsWith(prefix) && tournamentDraftRevision(input.slice(prefix.length))
}
