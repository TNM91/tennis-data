export type VerifiedVenue = {
  id: string; facility_name: string; name_keys: string[]; city: string; city_key: string
  state_code: string; street_address: string; source_url: string; verified_at: string
}
export type VenuePreference = {
  id: string; context_key: string; facility_name: string; name_key: string; city: string
  state_code: string; street_address: string; source_url: string; directory_id: string | null
  review_status: 'private' | 'pending' | 'approved' | 'rejected'; updated_at: string
}
export const venueSelect = 'id,facility_name,name_keys,city,city_key,state_code,street_address,source_url,verified_at'
export const venuePreferenceSelect = 'id,context_key,facility_name,name_key,city,state_code,street_address,source_url,directory_id,review_status,updated_at'
export const usStateCodes = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR VI GU AS MP'.split(' ')
export function venueText(value: unknown) { return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '' }
export function venueNameKey(value: unknown) { return venueText(value).toLowerCase().replace(/[.]/g, '').replace(/[–—]/g, '-') }
export function venueLocation(venue: Pick<VerifiedVenue, 'facility_name' | 'street_address' | 'city' | 'state_code'>) {
  return `${venue.facility_name} — ${venue.street_address}, ${venue.city}, ${venue.state_code}`
}
export function isStreetLocation(value: string) { return /\b\d+[A-Za-z]?\s+\S+/.test(value) }
export function safeVenueSource(value: unknown) {
  try {
    const url = new URL(venueText(value))
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|\[)/.test(url.hostname)) return ''
    return url.toString().slice(0, 1000)
  } catch { return '' }
}
export function validateVenueAddress(input: Record<string, unknown>) {
  const facility_name = venueText(input.facilityName)
  const city = venueText(input.city)
  const state_code = venueText(input.state).toUpperCase()
  const street_address = venueText(input.streetAddress)
  if (!facility_name || facility_name.length > 160 || !city || city.length > 100 || !usStateCodes.includes(state_code)
      || street_address.length > 160 || !isStreetLocation(street_address)) return null
  return { facility_name, city, city_key: venueNameKey(city), state_code, street_address, source_url: safeVenueSource(input.sourceUrl) }
}
export function matchesVenue(venue: VerifiedVenue, name: string, city?: string, state?: string) {
  return venue.name_keys.includes(venueNameKey(name))
    && (!city || venue.city_key === venueNameKey(city))
    && (!state || venue.state_code === state.toUpperCase())
}
