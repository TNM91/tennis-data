import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
import { safeVenueSource, validateVenueAddress, venueNameKey, venuePreferenceSelect, venueSelect, venueText, type VerifiedVenue } from '@/lib/venue-directory'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response
  const params = new URL(request.url).searchParams
  const name = venueText(params.get('name'))
  const context = venueText(params.get('context'))
  if (!name || name.length > 160 || !context || context.length > 2000) return Response.json({message:'Choose a venue and season.'},{status:400})
  let directory = auth.supabase.from('calendar_venue_directory').select(venueSelect).contains('name_keys',[venueNameKey(name)])
  if (params.get('city')) directory = directory.eq('city_key',venueNameKey(params.get('city')))
  if (params.get('state')) directory = directory.eq('state_code',venueText(params.get('state')).toUpperCase())
  const [venues, preference] = await Promise.all([
    directory.order('city').limit(25),
    auth.supabase.from('calendar_venue_preferences').select(venuePreferenceSelect).eq('owner_user_id',auth.userId).eq('context_key',context).eq('name_key',venueNameKey(name)).maybeSingle(),
  ])
  if (venues.error || preference.error) return Response.json({message:'Locations could not be loaded. Your schedule is unchanged.'},{status:503})
  return Response.json({ok:true,venues:venues.data,preference:preference.data},{headers:{'Cache-Control':'private, no-store'}})
}

export async function POST(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response
  const body = await request.json().catch(()=>null)
  if (!body || typeof body !== 'object') return Response.json({message:'Enter the venue address.'},{status:400})
  const name = venueText(body.facilityName), context = venueText(body.context)
  if (!name || name.length>160 || !context || context.length>2000) return Response.json({message:'Choose a venue and season.'},{status:400})
  let directory: VerifiedVenue | null = null
  if (body.directoryId) {
    const found = await auth.supabase.from('calendar_venue_directory').select(venueSelect).eq('id',body.directoryId).maybeSingle()
    if (found.error || !found.data || !found.data.name_keys.includes(venueNameKey(name))) return Response.json({message:'That verified venue could not be matched. Search again.'},{status:400})
    directory = found.data as VerifiedVenue
  }
  const address = directory ? {facility_name:name,city:directory.city,state_code:directory.state_code,street_address:directory.street_address,source_url:directory.source_url}
    : validateVenueAddress(body)
  if (!address) return Response.json({message:'Enter a street address, city, and two-letter state.'},{status:400})
  const result = await auth.supabase.from('calendar_venue_preferences').upsert({
    owner_user_id:auth.userId,context_key:context,facility_name:name,name_key:venueNameKey(name),
    city:address.city,state_code:address.state_code,street_address:address.street_address,
    source_url:directory?.source_url || safeVenueSource(body.sourceUrl),directory_id:directory?.id || null,
    review_status:!directory && body.shareForReview===true ? 'pending':'private',reviewed_by:null,reviewed_at:null,updated_at:new Date().toISOString(),
  },{onConflict:'owner_user_id,context_key,name_key'}).select(venuePreferenceSelect).single()
  if (result.error) return Response.json({message:'Address was not saved. Please retry.'},{status:500})
  return Response.json({ok:true,preference:result.data,directory,message:'Location saved for this season. Save to TiQ to update calendar events.'})
}
