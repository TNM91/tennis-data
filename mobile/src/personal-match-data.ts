import type { SupabaseClient } from '@supabase/supabase-js'
import { isValidCalendarDate } from '../../lib/calendar-date'
import { localCalendarDate } from './calendar-data'

type MatchFields = {
  match_date: string
  opponent: string
  format: 'singles' | 'doubles'
  outcome: 'Won' | 'Lost'
  score: string
}

export type PersonalMatch = MatchFields & { id: string; revision: string; created_at: string }
export type PersonalMatchDraft = MatchFields & { id: string; revision: string; expected: string | null }
export class MatchChanged extends Error {}

const table = 'native_personal_matches'
const columns = 'owner_user_id,id,revision,match_date,opponent,format,outcome,score,created_at'
const pageSize = 20
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const validText = (value: string, max: number) => value !== '' && [...value].length <= max && !/\p{Cc}/u.test(value)
const timeout = () => AbortSignal.timeout(12000)

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

export function personalMatchDraft(form: FormData, match: PersonalMatch | null): PersonalMatchDraft {
  const fields = matchFields(Object.fromEntries(form))
  if (fields.match_date > localCalendarDate()) throw Error('Choose a date for a match you’ve already played.')
  return { ...fields, id: match?.id ?? crypto.randomUUID(), revision: crypto.randomUUID(), expected: match?.revision ?? null }
}

function readMatch(value: unknown, owner: string): PersonalMatch {
  const row = value as Record<string, unknown> | null
  if (!row || row.owner_user_id !== owner || typeof row.id !== 'string' || !uuid.test(row.id) ||
      typeof row.revision !== 'string' || !uuid.test(row.revision) || typeof row.created_at !== 'string' ||
      !timestamp.test(row.created_at) || !Number.isFinite(Date.parse(row.created_at))) throw Error('Match record unavailable.')
  return { ...matchFields(row), id: row.id, revision: row.revision, created_at: row.created_at }
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

async function lookup(client: SupabaseClient, owner: string, id: string, current: () => boolean) {
  await requireOwner(client, owner, current)
  const { data, error } = await client.from(table).select(columns).eq('owner_user_id', owner).eq('id', id)
    .abortSignal(timeout()).retry(false).maybeSingle()
  await requireOwner(client, owner, current)
  if (error) throw Error('Couldn’t confirm this scorecard. Try again.')
  return data ? readMatch(data, owner) : null
}

export async function savePersonalMatch(client: SupabaseClient, owner: string, draft: PersonalMatchDraft, current: () => boolean) {
  await requireOwner(client, owner, current)
  const { id, expected, ...values } = draft
  const query = expected
    ? client.from(table).update(values).eq('owner_user_id', owner).eq('id', id).eq('revision', expected)
    : client.from(table).insert({ ...values, owner_user_id: owner, id })
  const result = await query.select(columns).abortSignal(timeout()).retry(false).maybeSingle()
  await requireOwner(client, owner, current)
  const saved = result.data ? readMatch(result.data, owner) : await lookup(client, owner, id, current)
  if (saved?.id === id && Object.entries(values).every(([key, value]) => saved[key as keyof PersonalMatch] === value)) return saved
  if ((saved?.revision ?? null) !== expected) throw new MatchChanged('This scorecard changed on another device. Reopen it to see the latest result.')
  throw Error('Couldn’t confirm the save. Retry this scorecard.')
}

export async function removePersonalMatch(client: SupabaseClient, owner: string, match: PersonalMatch, current: () => boolean) {
  await requireOwner(client, owner, current)
  const { data } = await client.from(table).delete().eq('owner_user_id', owner).eq('id', match.id).eq('revision', match.revision)
    .select('id').abortSignal(timeout()).retry(false).maybeSingle()
  await requireOwner(client, owner, current)
  if (data?.id === match.id) return
  const existing = await lookup(client, owner, match.id, current)
  if (!existing) return
  if (existing.revision !== match.revision) throw new MatchChanged('This scorecard changed on another device. Reopen it before removing it.')
  throw Error('Couldn’t confirm removal. Try again.')
}
