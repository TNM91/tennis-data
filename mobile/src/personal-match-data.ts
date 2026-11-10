import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidCalendarDate } from '../../lib/calendar-date'
import type { NativeCalendarCompetition } from '../../lib/native-calendar-contract'
import { validateTiqTennisMatchScore } from '../../lib/tiq-scoring'
import { localCalendarDate } from './calendar-data'

type MatchFields = {
  match_date: string
  opponent: string
  format: 'singles' | 'doubles'
  outcome: 'Won' | 'Lost'
  score: string
}

export type PersonalMatch = MatchFields & { id: string; revision: string; created_at: string; calendar_match_id: string | null }
export type PersonalMatchDraft = MatchFields & { id: string; revision: string; expected: string | null; calendar_match_id: string | null }
export type CalendarScorecardSeed = { calendarMatchId: string; date: string; opponent: string; format?: MatchFields['format'] }
export class MatchChanged extends Error {}

const table = 'native_personal_matches'
const columns = 'owner_user_id,id,revision,calendar_match_id,match_date,opponent,format,outcome,score,created_at'
const pageSize = 20
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const calendarMatchId = /^(?:league|tournament):[a-zA-Z0-9_-]{1,80}:[a-zA-Z0-9_:-]{1,120}$/
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

export function suggestPersonalMatchOutcome(score: string): MatchFields['outcome'] | undefined {
  const { valid, parsedSets } = validateTiqTennisMatchScore(score)
  if (!valid) return
  const [wonFirst, wonSecond, wonDecider] = parsedSets.map(set => set.sideAGames > set.sideBGames)
  if (wonDecider !== undefined && wonFirst === wonSecond) return
  return (wonDecider ?? wonSecond) ? 'Won' : 'Lost'
}

export function personalMatchDraft(form: FormData, match: PersonalMatch | null, seed?: CalendarScorecardSeed): PersonalMatchDraft {
  const fields = matchFields(Object.fromEntries(form))
  if (fields.match_date > localCalendarDate()) throw Error('Choose a date for a match you’ve already played.')
  return { ...fields, id: match?.id ?? crypto.randomUUID(), revision: crypto.randomUUID(), expected: match?.revision ?? null,
    calendar_match_id: match?.calendar_match_id ?? seed?.calendarMatchId ?? null }
}

function readMatch(value: unknown, owner: string): PersonalMatch {
  const row = value as Record<string, unknown> | null
  if (!row || row.owner_user_id !== owner || typeof row.id !== 'string' || !uuid.test(row.id) ||
      typeof row.revision !== 'string' || !uuid.test(row.revision) || typeof row.created_at !== 'string' ||
      !(row.calendar_match_id === null || typeof row.calendar_match_id === 'string' && calendarMatchId.test(row.calendar_match_id)) ||
      !timestamp.test(row.created_at) || !Number.isFinite(Date.parse(row.created_at))) throw Error('Match record unavailable.')
  return { ...matchFields(row), id: row.id, revision: row.revision, created_at: row.created_at, calendar_match_id: row.calendar_match_id }
}

async function requireOwner(client: SupabaseClient, owner: string, current: () => boolean) {
  if (!current()) throw Error('My Lab is no longer open.')
  const { data, error } = await client.auth.getSession()
  if (error || !current() || data.session?.user.id !== owner) throw Error('My Lab is no longer open.')
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

async function lookup(client: SupabaseClient, owner: string, field: 'id' | 'calendar_match_id', key: string, current: () => boolean) {
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
  return lookup(client, owner, 'calendar_match_id', seed.calendarMatchId, current)
}

export async function savePersonalMatch(client: SupabaseClient, owner: string, draft: PersonalMatchDraft, current: () => boolean) {
  await requireOwner(client, owner, current)
  const { id, expected, calendar_match_id, ...values } = draft
  const query = expected
    ? client.from(table).update(values).eq('owner_user_id', owner).eq('id', id).eq('revision', expected)
    : client.from(table).insert({ ...values, owner_user_id: owner, id, calendar_match_id })
  const result = await query.select(columns).abortSignal(timeout()).retry(false).maybeSingle()
  await requireOwner(client, owner, current)
  const saved = result.data ? readMatch(result.data, owner) : !expected && calendar_match_id
    ? await lookup(client, owner, 'calendar_match_id', calendar_match_id, current)
    : await lookup(client, owner, 'id', id, current)
  if (saved?.id === id && saved.calendar_match_id === calendar_match_id &&
      Object.entries(values).every(([key, value]) => saved[key as keyof PersonalMatch] === value)) return saved
  if (!expected && calendar_match_id && saved?.calendar_match_id === calendar_match_id) {
    throw new MatchChanged('A scorecard is already saved for this calendar match. Open it again from your calendar.')
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
