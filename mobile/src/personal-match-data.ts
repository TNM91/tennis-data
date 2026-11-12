import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidCalendarDate } from '../../lib/calendar-date'
import { hittingPlanConfirmed, hittingPlanStart } from '../../lib/hitting-plan'
import type { NativeCalendarCompetition } from '../../lib/native-calendar-contract'
import { isTeamResultScorecardKey, readTeamCourtScore } from '../../lib/team-results-contract'
import { localCalendarDate, type CalendarOccurrence } from './calendar-data'
import { hittingPlanCourt, listedExploreCourt } from './explore-court-catalog'

type MatchFields = {
  match_date: string
  opponent: string
  format: 'singles' | 'doubles'
  outcome: 'Won' | 'Lost'
  score: string
}

export const courtFeedbackKeys = ['surface', 'lighting', 'court_time'] as const
export type CourtFeedback = Record<typeof courtFeedbackKeys[number], number | null>
export type CourtFeedbackVisit = { date: string; ratings: CourtFeedback }
type MatchVenue = { court_venue_key: string | null; court_feedback: CourtFeedback | null }
type MatchCalendarLink = { calendar_match_id: string | null; hitting_calendar_id?: string | null }
export type PersonalMatch = MatchFields & MatchVenue & MatchCalendarLink & { id: string; revision: string; created_at: string }
export type TeamScore = Pick<MatchFields, 'score' | 'outcome'>
export type PersonalMatchDraft = MatchFields & MatchVenue & MatchCalendarLink & { id: string; revision: string; expected: string | null }
export type CalendarScorecardSeed = {
  calendarMatchId: string; date: string; opponent: string; format?: MatchFields['format']; outcome?: MatchFields['outcome']; score?: string; courtVenueKey?: string
}
export class MatchChanged extends Error {}

export function teamScoreDiffers(saved: TeamScore, posted: TeamScore) {
  return saved.outcome !== posted.outcome || readTeamCourtScore(saved.score)?.score !== posted.score
}

const table = 'native_personal_matches'
const columns = 'owner_user_id,id,revision,calendar_match_id,match_date,opponent,format,outcome,score,created_at,court_venue_key,court_feedback,hitting_calendar_id'
const pageSize = 20
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const calendarMatchId = /^(?:league|tournament):[a-zA-Z0-9_-]{1,80}:[a-zA-Z0-9_:-]{1,120}$/
const hittingCalendarId = new RegExp(`^player-calendar-${uuid.source.slice(1,-1)}$`, 'i')
const hittingIdFromSeed = (seed?: CalendarScorecardSeed) => seed?.calendarMatchId.startsWith('hitting:')
  ? seed.calendarMatchId.slice('hitting:'.length) : null
const courtVenueKey = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const validText = (value: string, max: number) => value !== '' && [...value].length <= max && !/\p{Cc}/u.test(value)
const timeout = () => AbortSignal.timeout(12000)

export function calendarScorecardSeed(match: NativeCalendarCompetition | undefined, today = localCalendarDate()): CalendarScorecardSeed | undefined {
  if (!match?.publishedView || match.eventType !== 'match' || !['Confirmed', 'Scheduled', 'Completed'].includes(match.status) ||
      !isValidCalendarDate(match.date) || match.date > today || !calendarMatchId.test(match.id) ||
      !match.id.startsWith(`${match.kind}:${match.competitionId}:`)) return
  return { calendarMatchId: match.id, date: match.date,
    opponent: validText(match.opponent, 100) ? match.opponent : '', format: match.scorecardFormat }
}

export function hittingPlanScorecardSeed(event: CalendarOccurrence | null | undefined, now = new Date()): CalendarScorecardSeed | undefined {
  if (event?.source !== 'personal' || !hittingPlanConfirmed(event)) return
  const venue = hittingPlanCourt(event), start = hittingPlanStart(event)
  if (!venue || !start || start > now || !hittingCalendarId.test(event.id)) return
  return { calendarMatchId: `hitting:${event.id}`, date: event.date, opponent: '', courtVenueKey: venue.id }
}

function matchFields(input: Record<string, unknown>): MatchFields {
  const date = text(input.match_date)
  const opponent = text(input.opponent)
  const score = text(input.score)
  if (!isValidCalendarDate(date) || date < '0001-01-01') throw Error('Enter a valid match date.')
  if (!validText(opponent, 100)) throw Error('Enter an opponent name of up to 100 characters.')
  if (input.format !== 'singles' && input.format !== 'doubles') throw Error('Choose singles or doubles.')
  if (input.outcome !== 'Won' && input.outcome !== 'Lost') throw Error('Choose whether you won or lost.')
  if (!validText(score, 64)) throw Error('Enter a score of up to 64 characters.')
  return { match_date: date, opponent, format: input.format, outcome: input.outcome, score }
}

export function personalMatchDraft(form: FormData, match: PersonalMatch | null, seed?: CalendarScorecardSeed): PersonalMatchDraft {
  const fields = matchFields(Object.fromEntries(form))
  if (fields.match_date > localCalendarDate()) throw Error('Choose a date for a match you’ve already played.')
  const venue = text(form.get('court_venue_key'))
  if (venue && venue !== match?.court_venue_key && !listedExploreCourt(venue)) throw Error('Choose a listed venue for this scorecard.')
  const hittingId = match?.hitting_calendar_id ?? hittingIdFromSeed(seed)
  return { ...fields, id: match?.id ?? crypto.randomUUID(), revision: crypto.randomUUID(), expected: match?.revision ?? null,
    calendar_match_id: match?.calendar_match_id ?? (hittingId ? null : seed?.calendarMatchId ?? null),
    ...(hittingId ? {hitting_calendar_id:hittingId} : {}), court_venue_key: venue || null,
    court_feedback: venue && venue === match?.court_venue_key ? match.court_feedback : null }
}

function readCourtFeedback(value: unknown, venue: string | null): CourtFeedback | null {
  if (value === null || value === undefined) return null
  if (!venue || typeof value !== 'object' || Array.isArray(value)) throw Error('Court ratings unavailable.')
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== courtFeedbackKeys.length || !courtFeedbackKeys.every(key => {
    const rating = row[key]
    return rating === null || typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 5
  }) ||
    courtFeedbackKeys.every(key => row[key] === null)) throw Error('Court ratings unavailable.')
  return {surface:row.surface as number | null,lighting:row.lighting as number | null,court_time:row.court_time as number | null}
}

export function personalMatchFeedbackDraft(match: PersonalMatch, feedback: CourtFeedback | null): PersonalMatchDraft {
  if (!listedExploreCourt(match.court_venue_key)) throw Error('Choose a listed venue before rating the court.')
  return { ...matchFields(match), id: match.id, expected: match.revision, revision: crypto.randomUUID(),
    calendar_match_id: match.calendar_match_id, court_venue_key: match.court_venue_key,
    ...(match.hitting_calendar_id ? {hitting_calendar_id:match.hitting_calendar_id} : {}),
    court_feedback: readCourtFeedback(feedback, match.court_venue_key) }
}

function readMatch(value: unknown, owner: string): PersonalMatch {
  const row = value as Record<string, unknown> | null
  const venue = row?.court_venue_key ?? null
  const hittingId = row?.hitting_calendar_id ?? null
  if (!row || row.owner_user_id !== owner || typeof row.id !== 'string' || !uuid.test(row.id) ||
      typeof row.revision !== 'string' || !uuid.test(row.revision) || typeof row.created_at !== 'string' ||
      !(row.calendar_match_id === null || typeof row.calendar_match_id === 'string' && calendarMatchId.test(row.calendar_match_id)) ||
      !(hittingId === null || row.calendar_match_id === null && typeof hittingId === 'string' && hittingCalendarId.test(hittingId)) ||
      !(venue === null || typeof venue === 'string' && venue.length <= 80 && courtVenueKey.test(venue) && !venue.startsWith('private-')) ||
      !timestamp.test(row.created_at) || !Number.isFinite(Date.parse(row.created_at))) throw Error('Match record unavailable.')
  return { ...matchFields(row), id: row.id, revision: row.revision, created_at: row.created_at, calendar_match_id: row.calendar_match_id,
    ...(hittingId ? {hitting_calendar_id:hittingId} : {}),
    court_venue_key: venue, court_feedback: readCourtFeedback(row.court_feedback, venue) }
}

async function requireOwner(client: SupabaseClient, owner: string, current: () => boolean) {
  if (!current()) throw Error('My Lab is no longer open.')
  const { data, error } = await client.auth.getSession()
  if (error || !current() || data.session?.user.id !== owner) throw Error('My Lab is no longer open.')
}

export async function loadLatestCourtFeedback(client: SupabaseClient, owner: string, venueKey: string,
  current: () => boolean): Promise<CourtFeedbackVisit | null> {
  if (!listedExploreCourt(venueKey)) throw Error('Court unavailable.')
  await requireOwner(client, owner, current)
  const { data, error } = await client.from(table).select('owner_user_id,court_venue_key,match_date,court_feedback')
    .eq('owner_user_id', owner).eq('court_venue_key', venueKey).not('court_feedback', 'is', null)
    .order('match_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false })
    .limit(1).abortSignal(timeout()).retry(false).maybeSingle()
  await requireOwner(client, owner, current)
  if (error) throw Error('Couldn’t load your court ratings.')
  if (!data) return null
  if (data.owner_user_id !== owner || data.court_venue_key !== venueKey ||
      typeof data.match_date !== 'string' || !isValidCalendarDate(data.match_date)) throw Error('Court ratings unavailable.')
  const ratings = readCourtFeedback(data.court_feedback, venueKey)
  if (!ratings) throw Error('Court ratings unavailable.')
  return {date:data.match_date,ratings}
}

export async function loadPersonalMatches(client: SupabaseClient, owner: string, current: () => boolean, after?: PersonalMatch) {
  await requireOwner(client, owner, current)
  let query = client.from(table).select(columns).eq('owner_user_id', owner)
  if (after) {
    const date = `match_date.eq.${after.match_date}`
    query = query.or(`match_date.lt.${after.match_date},and(${date},created_at.lt.${after.created_at}),` +
      `and(${date},created_at.eq.${after.created_at},id.lt.${after.id})`)
  }
  const { data, error } = await query.order('match_date', { ascending: false }).order('created_at', { ascending: false })
    .order('id', { ascending: false }).limit(pageSize + 1).abortSignal(timeout()).retry(false)
  await requireOwner(client, owner, current)
  if (error || !Array.isArray(data) || data.length > pageSize + 1) throw Error('Couldn’t load your match history.')
  return { matches: data.slice(0, pageSize).map(row => readMatch(row, owner)), more: data.length > pageSize }
}

async function lookup(client: SupabaseClient, owner: string, field: 'id' | 'calendar_match_id' | 'hitting_calendar_id', key: string, current: () => boolean) {
  await requireOwner(client, owner, current)
  const { data, error } = await client.from(table).select(columns).eq('owner_user_id', owner).eq(field, key)
    .abortSignal(timeout()).retry(false).maybeSingle()
  await requireOwner(client, owner, current)
  if (error) throw Error('Couldn’t confirm this scorecard. Try again.')
  const match = data ? readMatch(data, owner) : null
  if (match && match[field] !== key) throw Error('The returned scorecard does not match this entry.')
  return match
}

export function loadCalendarScorecard(client: SupabaseClient, owner: string, seed: CalendarScorecardSeed, current: () => boolean) {
  const hittingId = hittingIdFromSeed(seed)
  return hittingId ? lookup(client, owner, 'hitting_calendar_id', hittingId, current) : lookup(client, owner, 'calendar_match_id', seed.calendarMatchId, current)
}

export async function loadSavedTeamScores(client: SupabaseClient, owner: string, keys: string[], current: () => boolean) {
  const requested = new Set(keys)
  const scores = new Map<string, TeamScore | null>(keys.map(key => [key, null]))
  if (!requested.size) return scores
  if ([...requested].some(key => !isTeamResultScorecardKey(key))) throw Error('Invalid team scorecard key.')
  await requireOwner(client, owner, current)
  const { data, error } = await client.from(table).select('owner_user_id,calendar_match_id,score,outcome')
    .eq('owner_user_id', owner).in('calendar_match_id', [...requested]).abortSignal(timeout()).retry(false)
  await requireOwner(client, owner, current)
  if (error || !Array.isArray(data) || data.length > requested.size) throw Error('Couldn’t check your saved team scores.')
  for (const row of data) {
    const key = row?.calendar_match_id
    if (row?.owner_user_id !== owner || !requested.delete(key) || typeof row.score !== 'string' ||
        !validText(row.score, 64) || (row.outcome !== 'Won' && row.outcome !== 'Lost')) {
      throw Error('Invalid saved team score.')
    }
    scores.set(key, { score: row.score, outcome: row.outcome })
  }
  return scores
}

export async function savePersonalMatch(client: SupabaseClient, owner: string, draft: PersonalMatchDraft, current: () => boolean) {
  await requireOwner(client, owner, current)
  const { id, expected, calendar_match_id, hitting_calendar_id, ...values } = draft
  const query = expected
    ? client.from(table).update(values).eq('owner_user_id', owner).eq('id', id).eq('revision', expected)
    : client.from(table).insert({ ...values, owner_user_id: owner, id, calendar_match_id, ...(hitting_calendar_id ? {hitting_calendar_id} : {}) })
  const result = await query.select(columns).abortSignal(timeout()).retry(false).maybeSingle()
  await requireOwner(client, owner, current)
  const saved = result.data ? readMatch(result.data, owner) : !expected && hitting_calendar_id
    ? await lookup(client, owner, 'hitting_calendar_id', hitting_calendar_id, current) : !expected && calendar_match_id
    ? await lookup(client, owner, 'calendar_match_id', calendar_match_id, current)
    : await lookup(client, owner, 'id', id, current)
  const { court_feedback, ...scorecardValues } = values
  if (saved?.id === id && saved.calendar_match_id === calendar_match_id && saved.hitting_calendar_id === hitting_calendar_id &&
      Object.entries(scorecardValues).every(([key, value]) => saved[key as keyof PersonalMatch] === value) &&
      courtFeedbackKeys.every(key => (saved.court_feedback?.[key] ?? null) === (court_feedback?.[key] ?? null))) return saved
  if (!expected && calendar_match_id && saved?.calendar_match_id === calendar_match_id) {
    if (isTeamResultScorecardKey(calendar_match_id)) throw new MatchChanged('You already saved this team scorecard. Open it again from Team results.')
    throw new MatchChanged('A scorecard is already saved for this calendar match. Open it again from your calendar.')
  }
  if (!expected && hitting_calendar_id && saved?.hitting_calendar_id === hitting_calendar_id) {
    throw new MatchChanged('A scorecard is already saved for this hit. Open it again from Calendar.')
  }
  if ((saved?.revision ?? null) !== expected) throw new MatchChanged('This scorecard changed on another device. Reopen it to see the latest result.')
  throw Error('Couldn’t confirm the save. Retry this scorecard.')
}

export async function removePersonalMatch(client: SupabaseClient, owner: string, match: PersonalMatch, current: () => boolean) {
  await requireOwner(client, owner, current)
  const { data } = await client.from(table).delete().eq('owner_user_id', owner).eq('id', match.id).eq('revision', match.revision)
    .select('id').abortSignal(timeout()).retry(false).maybeSingle()
  await requireOwner(client, owner, current)
  if (data?.id === match.id) return
  const existing = await lookup(client, owner, 'id', match.id, current)
  if (!existing) return
  if (existing.revision !== match.revision) throw new MatchChanged('This scorecard changed on another device. Reopen it before removing it.')
  throw Error('Couldn’t confirm removal. Try again.')
}
