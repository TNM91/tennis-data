import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {matchesVenue,safeVenueSource,validateVenueAddress,venueNameKey,type VerifiedVenue} from '../venue-directory'
import {applyCalendarVenueLocations} from '../venue-calendar-storage'

const venue:VerifiedVenue={id:'venue-1',facility_name:'Example Tennis Club',name_keys:['example tennis club'],city:'St. Louis',city_key:'st louis',state_code:'MO',street_address:'100 Main St',source_url:'https://example.org/contact',verified_at:'2026-09-07'}
describe('safe reusable venue directory',()=>{
 it('requires exact name, city and state when supplied; never fuzzy matches',()=>{
  expect(matchesVenue(venue,'Example Tennis Club','ST. LOUIS','MO')).toBe(true)
  expect(matchesVenue(venue,'Example Tennis Club','Springfield','MO')).toBe(false)
  expect(matchesVenue(venue,'Example Tennis Club','St. Louis','IL')).toBe(false)
  expect(matchesVenue(venue,'Example Club','St. Louis','MO')).toBe(false)
  expect(venueNameKey(' St. Louis ')).toBe('st louis')
 })
 it('validates street/city/state and never accepts active source URLs',()=>{
  expect(validateVenueAddress({facilityName:'Example',city:'St. Louis',state:'mo',streetAddress:'100 Main St'})).toMatchObject({state_code:'MO',city_key:'st louis'})
  expect(validateVenueAddress({facilityName:'Example',city:'St. Louis',state:'XX',streetAddress:'100 Main St'})).toBeNull()
  expect(validateVenueAddress({facilityName:'Example',city:'St. Louis',state:'MO',streetAddress:'TBD'})).toBeNull()
  for(const url of ['javascript:alert(1)','http://example.org','https://user:secret@example.org','https://127.0.0.1/test','https://localhost'])expect(safeVenueSource(url)).toBe('')
 })
 it('uses current verified addresses without altering event identity',async()=>{
  const db={from:vi.fn(()=>({select:()=>({in:async()=>({data:[venue],error:null})})}))} as unknown as SupabaseClient
  const [item]=await applyCalendarVenueLocations(db,'owner',[{id:'stable-event',location:'Old address',venue_directory_id:'venue-1'}])
  expect(item).toMatchObject({id:'stable-event',location:'Example Tennis Club — 100 Main St, St. Louis, MO'})
 })
 it('scopes private confirmations to the feed owner even with service credentials',async()=>{
  const eq=vi.fn(()=>({in:async()=>({data:[],error:null})}))
  const db={from:()=>({select:()=>({eq})})} as unknown as SupabaseClient
  await expect(applyCalendarVenueLocations(db,'owner',[{location:'Club',venue_preference_id:'other-account-id'}])).rejects.toThrow('could not be checked')
  expect(eq).toHaveBeenCalledWith('owner_user_id','owner')
 })
 it('promotes an approved preference to the current shared address on the next feed read',async()=>{
  const preference={id:'pref',directory_id:'venue-1',facility_name:'Example Tennis Club',street_address:'Older street',city:'St. Louis',state_code:'MO'}
  const db={from:(table:string)=>table==='calendar_venue_preferences'?{select:()=>({eq:()=>({in:async()=>({data:[preference],error:null})})})}:{select:()=>({in:async()=>({data:[venue],error:null})})}} as unknown as SupabaseClient
  expect(await applyCalendarVenueLocations(db,'owner',[{location:'Original',venue_preference_id:'pref'}])).toEqual([{location:'Example Tennis Club — 100 Main St, St. Louis, MO',venue_preference_id:'pref'}])
 })
})
