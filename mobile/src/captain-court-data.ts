import { CapacitorHttp } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { courtAccountId, courtDate, courtNumber, type CourtDesk, type CourtMember, type CaptainCourt,
  type CourtSubmission, type PostedCourtScorecard } from '../../lib/native-court-result-contract'

const endpoint = 'https://www.tenaceiq.com/api/mobile/first-party/court-results'
const format = (value: unknown) => value === 'singles' || value === 'doubles'
const safeText = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max && !/\p{Cc}/u.test(value)
const accountList = (value: unknown) => Array.isArray(value) && value.length <= 2 && value.every(courtAccountId)
const member = (value: CourtMember) => value && courtAccountId(value.id) && safeText(value.name, 100)
const court = (value: CaptainCourt) => value && courtNumber(value.court) && courtAccountId(value.revision) && format(value.format) &&
  accountList(value.a) && accountList(value.b) && (value.winner === 'A' || value.winner === 'B') && safeText(value.score, 64)

export class CourtRequestError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

async function request(client: SupabaseClient, owner: string, current: () => boolean, context?: { league: string; fixture: string }, input?: CourtSubmission) {
  const session = async () => {
    const { data, error } = await client.auth.getSession()
    if (!current() || error || data.session?.user.id !== owner || !data.session.access_token) throw Error('Sign in to see court scores.')
    return data.session
  }
  const signedIn = await session()
  const url = endpoint + (context ? '?' + new URLSearchParams(context) : '')
  const options = { url, headers: { Authorization: 'Bearer ' + signedIn.access_token, 'Cache-Control': 'no-store',
    ...(input ? { 'Content-Type': 'application/json' } : {}) }, disableRedirects: true, responseType: 'json' as const,
  webFetchExtra: { cache: 'no-store' as const }, connectTimeout: 10000, readTimeout: 30000 }
  const response = input ? await CapacitorHttp.post({ ...options, data: input }) : await CapacitorHttp.get(options)
  await session()
  const data = response.data
  if (response.status !== 200 || data?.ok !== true) throw new CourtRequestError(response.status,
    data?.releaseScope === 'first-party' && safeText(data.message, 250) ? data.message : 'Court scores are unavailable. Try again.')
  if (data.releaseScope !== 'first-party' || data.owner !== owner) throw Error('Court score account changed.')
  return data
}

export async function readCourtDesk(client: SupabaseClient, owner: string, current: () => boolean, context: { league: string; fixture: string }) {
  const { desk } = await request(client, owner, current, context) as { desk: CourtDesk }
  if (!desk || desk.league !== context.league || desk.fixture !== context.fixture || !courtDate(desk.date) ||
      !safeText(desk.teamA, 160) || !safeText(desk.teamB, 160) || typeof desk.captain !== 'boolean' || !['A', 'B'].includes(desk.side) ||
      !Array.isArray(desk.membersA) || desk.membersA.length > 100 || !desk.membersA.every(member) ||
      !Array.isArray(desk.membersB) || desk.membersB.length > 100 || !desk.membersB.every(member) ||
      !Array.isArray(desk.courts) || desk.courts.length > 30 || !desk.courts.every(court)) throw Error('The fixture changed. Open it again.')
  return desk
}

export async function postCourt(client: SupabaseClient, owner: string, current: () => boolean, context: { league: string; fixture: string }, input: CourtSubmission) {
  const response = await request(client, owner, current, context, input)
  const posted = response.court as CaptainCourt
  if (response.fixture !== context.fixture || response.league !== context.league || !court(posted) ||
      posted.revision !== input.revision || posted.court !== input.court || posted.score !== input.score ||
      posted.format !== input.format || posted.winner !== input.winner || posted.a.join(',') !== input.a.join(',') ||
      posted.b.join(',') !== input.b.join(',')) throw Error('The posted court could not be confirmed.')
  return posted
}

export async function loadCaptainScorecards(client: SupabaseClient, owner: string, current: () => boolean) {
  const { scorecards } = await request(client, owner, current) as { scorecards: PostedCourtScorecard[] }
  if (!Array.isArray(scorecards) || scorecards.length > 30 || new Set(scorecards.map(card => card?.id)).size !== scorecards.length ||
      scorecards.some(card => !card || !/^league:[A-Za-z0-9_-]{1,80}:[a-f0-9-]{36}:court:\d{1,2}$/.test(card.id) ||
        card.calendar_match_id !== card.id || !courtDate(card.match_date) || !format(card.format) || !courtNumber(card.court) ||
        !safeText(card.opponent, 160) || !safeText(card.scoreOrder, 323) || !safeText(card.score, 64) || !['Won', 'Lost'].includes(card.outcome))) {
    throw Error('The captain scorecards could not be confirmed.')
  }
  return scorecards
}
