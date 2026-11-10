import type {SupabaseClient} from '@supabase/supabase-js'
import {getSignedInPlayerApiAuth} from '@/lib/player-api-auth'
import {MY_TOURNAMENT_ENTRY_LIMIT,readMyTournamentEntries,tournamentEntryId} from '@/lib/native-tournament-entry-contract'

export const runtime = 'nodejs'
export const maxDuration = 30

const headers = {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'}
const json = (data: unknown, status: number) => Response.json(data, {status, headers})

type TournamentName = {id: string; event_id: string | null; is_event: boolean; name: string}

async function publishedNames(client: SupabaseClient, ids: string[], signal: AbortSignal) {
 const names = new Map<string, TournamentName>()
 if(!ids.length)return names
 const result = await client.from('tiq_tournaments').select('id,event_id,is_event,name')
  .in('id', ids).eq('is_public', true).neq('status', 'draft').abortSignal(signal)
 if(result.error || !result.data)throw Error('Tournament names unavailable.')
 for(const row of result.data)names.set(row.id, row)
 return names
}

export async function GET(request: Request) {
 const auth = await getSignedInPlayerApiAuth(request)
 if(!auth.ok){
  for(const [name, value] of Object.entries(headers))auth.response.headers.set(name, value)
  return auth.response
 }
 const params = new URL(request.url).searchParams
 let division = ''
 try {
  if([...params.keys()].some(key => key !== 'division') || params.getAll('division').length > 1)throw Error()
  if(params.has('division'))division = tournamentEntryId(params.get('division'))
 } catch {
  return json({ok: false, message: 'Open your tournament entries again.'}, 400)
 }

 try {
  const signal = AbortSignal.timeout(12000)
  const limit = division ? 1 : MY_TOURNAMENT_ENTRY_LIMIT
  const query = auth.supabase.from('tiq_tournament_entries')
   .select('id,tournament_id,status,submitted_by_user_id')
   .eq('submitted_by_user_id', auth.userId)
  const {data, error} = await (division ? query.eq('tournament_id', division) : query)
   .order('updated_at', {ascending: false}).order('id').limit(limit + 1).abortSignal(signal)
  if(error || !data || data.some(row => row.submitted_by_user_id !== auth.userId || (division && row.tournament_id !== division))){
   throw Error('Tournament entries unavailable.')
  }
  if(division && data.length > 1)return json({ok: false, message: 'Ask the organizer to review your existing entries.'}, 409)

  const recent = data.slice(0, limit)
  const divisions = await publishedNames(auth.supabase, [...new Set(recent.map(row => row.tournament_id))], signal)
  const parentIds = [...new Set(Array.from(divisions.values()).flatMap(row => row.event_id ? [row.event_id] : []))]
  const events = await publishedNames(auth.supabase, parentIds, signal)

  const entries = recent.map(row => {
   const division = divisions.get(row.tournament_id)
   const parent = division?.event_id ?? ''
   const event = events.get(parent)
   const base = {id: row.id, status: row.status}
   if(!division || division.is_event || (parent && (!event?.is_event || event.event_id))){
    return {...base, eventName: '', divisionName: '', selection: null}
   }
   return {
    ...base,
    eventName: event?.name ?? division.name,
    divisionName: event ? division.name : '',
    selection: {parent, division: division.id},
   }
  })
  const envelope = {ok: true, owner: auth.userId, entries, more: data.length > limit}
  return json({ok: true, owner: auth.userId, ...readMyTournamentEntries(envelope, auth.userId)}, 200)
 } catch {
  return json({ok: false, message: 'Couldn’t load your tournament entries. Try refreshing.'}, 503)
 }
}
