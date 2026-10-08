import { describe, expect, it } from 'vitest'
import { buildEventPublicationReview, eventPublicationVersion } from '../tournament-event-publication'
import type { TiqTournamentRecord } from '../tiq-tournament-registry'
const event:TiqTournamentRecord={id:'event',isEvent:true,name:'Pumpkin',format:'group_playoffs',entrantType:'teams',status:'draft',startsOn:'2026-10-17',locationLabel:'Woodsmill',directorNotes:'',entrants:[],results:{},schedule:{},contacts:{},entrantPlayerIds:{},isPublic:false,createdAt:'',updatedAt:'one',registrationEmail:'director@example.com',eventDetails:{startsAt:'17:30',timeZone:'America/Chicago',venueName:'Woodsmill',venueAddress:'910 Old Woodsmill Road',feePerPlayer:40,registrationClosesOn:'2026-10-14',directorName:'Michael Lesko',formatSummary:'Group play followed by playoffs'}}
const division:TiqTournamentRecord={...event,id:'40',isEvent:false,eventId:'event',name:'4.0 Doubles'}
describe('event publication review',()=>{
 it('allows signups to open before the field and court plan are set',()=>{expect(buildEventPublicationReview(event,[division]).ready).toBe(true);expect(event.isPublic).toBe(false)})
 it('blocks missing divisions, invalid contact, missing venue/timezone, and a late deadline',()=>{
  expect(buildEventPublicationReview(event,[]).ready).toBe(false)
  expect(buildEventPublicationReview({...event,registrationEmail:'bad'},[division]).ready).toBe(false)
  expect(buildEventPublicationReview({...event,eventDetails:{...event.eventDetails,timeZone:''}},[division]).ready).toBe(false)
  expect(buildEventPublicationReview({...event,eventDetails:{...event.eventDetails,venueAddress:''}},[division]).ready).toBe(false)
  expect(buildEventPublicationReview({...event,eventDetails:{...event.eventDetails,registrationClosesOn:'2026-10-18'}},[division]).ready).toBe(false)
  expect(buildEventPublicationReview(event,[division,{...division,id:'45'}]).ready).toBe(false)
 })
 it('supports explicit free entry and rejects invalid dates and completed events',()=>{
  expect(buildEventPublicationReview({...event,eventDetails:{...event.eventDetails,feePerPlayer:0}},[division]).ready).toBe(true)
  expect(buildEventPublicationReview({...event,startsOn:'2026-02-30'},[division]).ready).toBe(false)
  expect(buildEventPublicationReview({...event,status:'completed'},[division]).ready).toBe(false)
 })
 it('invalidates review when public details or divisions change, without depending on private contact data or key order',()=>{
  const version=eventPublicationVersion(event,[division])
  expect(eventPublicationVersion({...event,name:'Changed'},[division])).not.toBe(version)
  expect(eventPublicationVersion(event,[{...division,name:'Changed'}])).not.toBe(version)
  expect(eventPublicationVersion(event,[division,{...division,id:'45'}])).not.toBe(version)
  expect(eventPublicationVersion({...event,contacts:{private:{name:'private',phone:'secret',smsOptIn:false,consentNote:'private',updatedAt:''}}},[division])).toBe(version)
  expect(eventPublicationVersion({...event,eventDetails:{...event.eventDetails,venueName:'Woodsmill'}},[division])).toBe(version)
 })
})
