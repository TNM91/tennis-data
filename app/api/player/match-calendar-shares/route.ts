import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
import { createCalendarFeedToken, hashCalendarFeedToken } from '@/lib/calendar-feed-tokens'
import { isShareId, loadSharedMatches, matchShareSelect, shareItemIds, shareTimeZones } from '@/lib/match-calendar-shares'

export const runtime = 'nodejs'
const reply = (body: unknown, status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}})
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''

export async function GET(request: Request) {
  const auth=await getSignedInPlayerApiAuth(request); if(!auth.ok)return auth.response
  const {data,error}=await auth.supabase.from('match_calendar_shares').select(matchShareSelect).eq('owner_user_id',auth.userId).eq('status','active').order('created_at',{ascending:false}).limit(100)
  return error ? reply({ok:false,message:'Shared calendars could not be loaded. Retry.'},503) : reply({ok:true,shares:data || []})
}

async function save(request: Request, updating: boolean) {
  const auth=await getSignedInPlayerApiAuth(request); if(!auth.ok)return auth.response
  let body: Record<string,unknown>
  try { body=await request.json(); if(!body || typeof body!=='object')throw Error() } catch {return reply({ok:false,message:'Invalid sharing request.'},400)}
  const ids=shareItemIds(body.itemIds)
  const label=text(body.label),team=text(body.teamName),season=text(body.seasonKey)
  const timeZone=text(body.timeZone) || 'America/Chicago'
  if(!shareTimeZones.includes(timeZone))return reply({ok:false,message:'Choose a supported match time zone.'},400)
  if(!ids || (!updating && (!label || label.length>80 || !team || team.length>200 || !season || season.length>1000)) || (updating && !isShareId(body.id))) return reply({ok:false,message:'Choose saved matches, a team season and a short link label.'},400)
  try {
    const rows=await loadSharedMatches(auth.supabase,auth.userId,ids)
    if(rows.length!==ids.length) return reply({ok:false,message:'Only your saved match events can be shared. Save the selected matches to TiQ first.'},400)
    if(updating) {
      const {data,error}=await auth.supabase.from('match_calendar_shares').update({item_ids:ids,...(body.timeZone ? {time_zone:timeZone} : {}),updated_at:new Date().toISOString()}).eq('id',body.id).eq('owner_user_id',auth.userId).eq('status','active').select(matchShareSelect).maybeSingle()
      if(error)throw error
      return data ? reply({ok:true,share:data}) : reply({ok:false,message:'This shared calendar is no longer active.'},404)
    }
    const existing=await auth.supabase.from('match_calendar_shares').select('id').eq('owner_user_id',auth.userId).eq('status','active').limit(100)
    if(existing.error)throw existing.error
    if((existing.data || []).length>=100) return reply({ok:false,message:'Stop sharing an unused calendar before creating another link.'},400)
    const token=createCalendarFeedToken()
    const {data,error}=await auth.supabase.from('match_calendar_shares').insert({owner_user_id:auth.userId,token_hash:hashCalendarFeedToken(token),label,team_name:team,season_key:season,time_zone:timeZone,item_ids:ids}).select(matchShareSelect).single()
    if(error || !data)throw error || Error('Missing share')
    // Fragment keeps the bearer secret out of landing-page requests/referrers.
    const url=new URL(`/calendar/share/${data.id}`,request.url);url.hash=token
    return reply({ok:true,share:data,shareUrl:url.toString()})
  } catch { return reply({ok:false,message:'The sharing link could not be saved. Your TiQ calendar has not been removed. Please retry.'},503) }
}
export const POST = (request: Request) => save(request,false)
export const PATCH = (request: Request) => save(request,true)

export async function DELETE(request: Request) {
  const auth=await getSignedInPlayerApiAuth(request);if(!auth.ok)return auth.response
  const id=new URL(request.url).searchParams.get('id')
  if(!isShareId(id))return reply({ok:false,message:'Choose a shared calendar.'},400)
  const {data,error}=await auth.supabase.from('match_calendar_shares').update({status:'revoked',updated_at:new Date().toISOString()}).eq('id',id).eq('owner_user_id',auth.userId).eq('status','active').select('id').maybeSingle()
  if(error)return reply({ok:false,message:'Could not stop sharing. Retry.'},503)
  return data ? reply({ok:true}) : reply({ok:false,message:'This shared calendar is no longer active.'},404)
}
