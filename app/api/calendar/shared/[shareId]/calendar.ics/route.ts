import { createClient } from '@supabase/supabase-js'
import { hashCalendarFeedToken } from '@/lib/calendar-feed-tokens'
import { isShareId, loadSharedMatches, shareItemIds } from '@/lib/match-calendar-shares'
import { supabaseUrl } from '@/lib/supabase'
import { buildTennisCalendarFeed } from '@/lib/tiq-league-schedule-calendar'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive'}
export async function GET(request: Request,{params}:{params:Promise<{shareId:string}>}) {
  const {shareId}=await params
  const token=new URL(request.url).searchParams.get('token') || ''
  if(!isShareId(shareId) || !/^[A-Za-z0-9_-]{43}$/.test(token))return new Response('Shared calendar unavailable.',{status:404,headers})
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if(!key)return new Response('Calendar temporarily unavailable.',{status:503,headers})
  const db=createClient(supabaseUrl,key,{auth:{persistSession:false,autoRefreshToken:false}})
  try {
    const {data:share,error}=await db.from('match_calendar_shares').select('id,owner_user_id,team_name,time_zone,item_ids').eq('id',shareId).eq('token_hash',hashCalendarFeedToken(token)).eq('status','active').maybeSingle()
    if(error)throw error
    if(!share)return new Response('This calendar link is unavailable or sharing has stopped.',{status:404,headers})
    const ids=shareItemIds(share.item_ids);if(!ids)throw Error('Invalid share selection')
    const rows=await loadSharedMatches(db,share.owner_user_id,ids)
    const events=rows.map(row=>({id:`player-calendar-${row.id}`,title:row.title,date:row.scheduled_date,time:row.scheduled_time || '',location:row.location || '',durationMinutes:120,description:'Shared team match from TenAceIQ. Read-only; adding this calendar does not confirm availability.'}))
    if(request.headers.get('accept')==='application/json')return Response.json({ok:true,teamName:share.team_name,timeZone:share.time_zone,count:events.length,matches:events.map(({title,date,time,location})=>({title,date,time,location}))},{headers})
    return new Response(buildTennisCalendarFeed(events,{calendarName:`TenAceIQ · ${share.team_name}`,timeZone:share.time_zone}),{headers:{...headers,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="tenaceiq-shared-matches.ics"'}})
  } catch {return new Response('Calendar temporarily unavailable. Please retry.',{status:503,headers})}
}
