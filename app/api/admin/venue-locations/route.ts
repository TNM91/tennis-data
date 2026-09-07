import { getAdminApiAuth } from '@/lib/admin-api-auth'
import { safeVenueSource, venuePreferenceSelect } from '@/lib/venue-directory'
export const runtime = 'nodejs'
export async function GET(request: Request) {
  const auth = await getAdminApiAuth(request)
  if (!auth.ok) return auth.response
  const result = await auth.service.from('calendar_venue_preferences').select(venuePreferenceSelect).eq('review_status','pending').order('updated_at').limit(100)
  if (result.error) return Response.json({message:'Venue reviews could not be loaded.'},{status:500})
  return Response.json({ok:true,items:result.data},{headers:{'Cache-Control':'private, no-store'}})
}
export async function POST(request: Request) {
  const auth = await getAdminApiAuth(request)
  if (!auth.ok) return auth.response
  const body = await request.json().catch(()=>null)
  const source = safeVenueSource(body?.sourceUrl)
  if (!body?.id || !body?.updatedAt || typeof body.approve!=='boolean' || (body.approve && (!source || body.verified!==true))) return Response.json({message:'Check the address against a public official source before approving.'},{status:400})
  const result = await auth.service.rpc('review_calendar_venue',{p_id:body.id,p_updated_at:body.updatedAt,p_actor:auth.userId,p_approve:body.approve,p_source_url:source})
  if (result.error) return Response.json({message:'This venue could not be reviewed. Refresh; it may have changed.'},{status:409})
  return Response.json({ok:true,directoryId:result.data})
}
