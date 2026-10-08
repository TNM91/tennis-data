import { beforeEach, describe, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({records:[] as unknown[],reads:0,fail:false,refreshFail:false,payload:null as Record<string,unknown>|null,cached:[] as unknown[]}))
vi.mock('../tiq-tournament-registry',()=>({
 loadTiqTournamentEventRecords:async()=>{state.reads++;return {data:state.records,error:state.refreshFail && state.reads>1 ? new Error('offline'):null}},
 readTiqTournamentRegistry:()=>[],writeTiqTournamentRegistry:(records:unknown[])=>{state.cached=records},
}))
vi.mock('../supabase',()=>({supabase:{from:()=>{
 const query={update:(payload:Record<string,unknown>)=>{state.payload=payload;return query},eq:()=>query,select:()=>query,maybeSingle:async()=>{
  if(state.fail)return {data:null,error:new Error('denied')}
  state.records=state.records.map(row=>({...row as object,isPublic:state.payload?.is_public}))
  return {data:{id:'event'},error:null}
 }};return query
}}}))
import { setEventPublication } from '../tournament-event-publication-client'
import type { TiqTournamentRecord } from '../tiq-tournament-registry'
const event:TiqTournamentRecord={id:'event',isEvent:true,name:'Pumpkin',format:'group_playoffs',entrantType:'teams',status:'draft',startsOn:'2026-10-17',locationLabel:'Woodsmill',directorNotes:'',entrants:[],results:{},schedule:{},contacts:{},entrantPlayerIds:{},isPublic:false,createdAt:'',updatedAt:'one',registrationEmail:'director@example.com',eventDetails:{startsAt:'17:30',timeZone:'America/Chicago',venueName:'Woodsmill',venueAddress:'910 Old Woodsmill Road',feePerPlayer:40,registrationClosesOn:'2026-10-14',directorName:'Michael Lesko',formatSummary:'Group play followed by playoffs'}}
const division:TiqTournamentRecord={...event,id:'40',isEvent:false,eventId:'event',name:'4.0 Doubles'}
beforeEach(()=>{state.records=[event,division];state.reads=0;state.fail=false;state.refreshFail=false;state.payload=null;state.cached=[]})
describe('explicit event publication',()=>{
 it('requires sign-in and a current, complete saved review before writing',async()=>{
  await expect(setEventPublication(event,[division],true,null)).rejects.toThrow('Sign in')
  state.records=[{...event,name:'Changed'},division]
  await expect(setEventPublication(event,[division],true,'owner')).rejects.toThrow('Event details changed')
  expect(state.payload).toBeNull()
  state.records=[event]
  await expect(setEventPublication(event,[],true,'owner')).rejects.toThrow('Complete the event checklist')
  expect(state.payload).toBeNull()
 })
 it('updates the parent only and reloads the shared visibility without opening empty division draws',async()=>{
  await setEventPublication(event,[division],true,'owner')
  expect(state.payload).toMatchObject({is_public:true,status:'open',updated_by_user_id:'owner'})
  expect(state.cached).toHaveLength(2)
  expect(state.cached[1]).toMatchObject({isPublic:true,status:'draft'})
 })
 it('does not cache success after a rejected update and explains a post-save refresh failure honestly',async()=>{
  state.fail=true
  await expect(setEventPublication(event,[division],true,'owner')).rejects.toThrow('could not be saved')
  expect(state.cached).toEqual([])
  state.fail=false;state.refreshFail=true;state.reads=0
  await expect(setEventPublication(event,[division],true,'owner')).rejects.toThrow('Visibility was updated')
  expect(state.cached).toEqual([])
 })
 it('allows an explicit return to private visibility even with missing announcement fields',async()=>{
  const published={...event,isPublic:true,eventDetails:{}}
  state.records=[published,division]
  await setEventPublication(published,[division],false,'owner')
  expect(state.payload?.is_public).toBe(false)
 })
})
