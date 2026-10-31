import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {readCalendarPractices,type CalendarTeamPractice} from '../native-calendar-practices-contract'
import {calendarPracticesRequest,loadCalendarSources} from '../../mobile/src/calendar-practices-data'
import {calendarOccurrences,calendarExport,exportableCalendarOccurrences} from '../../mobile/src/calendar-data'
import type {NativeCalendar} from '../native-calendar-contract'
const owner='11111111-1111-4111-8111-111111111111',range={from:'2026-10-26',to:'2026-11-01'}
const practice:CalendarTeamPractice={id:'44444444-4444-4444-8444-444444444444',title:'Return + first ball',date:'2026-10-31',time:'18:00',endTime:'20:15',location:'Court 2',status:'confirmed',response:'waitlist',captainConfirmed:false,scope:{teamName:'Aces',leagueName:'City',flight:'4.0'}}
const response=(practices:unknown[]=[practice])=>({ok:true,owner,range,practices})
const calendar=():NativeCalendar=>({owner,range,personal:[],competitions:[],coach:[],warnings:[]})
function session(){let who=owner;const client={auth:{getSession:vi.fn(async()=>({data:{session:{user:{id:who},access_token:'synthetic-token'}},error:null}))}} as unknown as SupabaseClient;return {client,switchOwner(){who='another-owner'}}}
describe('team practice calendar transport and export',()=>{
 it('validates owner, date window, event uniqueness, exact scopes, times and response consistency',()=>{
  expect(readCalendarPractices(response(),owner,range)).toEqual([practice])
  for(const value of [{...response(),owner:'other'},{...response(),range:{...range,to:'2026-11-02'}},response([practice,practice]),response([{...practice,date:'2026-11-02'}]),response([{...practice,endTime:'17:00'}]),response([{...practice,time:'6 PM'}]),response([{...practice,response:'approved'}]),response([{...practice,captainConfirmed:true}]),response([{...practice,scope:{...practice.scope,leagueName:''}}])])expect(()=>readCalendarPractices(value,owner,range)).toThrow()
  expect(readCalendarPractices(response([{...practice,time:'6:00',endTime:'7:00'}]),owner,range)[0]).toMatchObject({time:'06:00',endTime:'07:00'})
 })
 it('pins bearer ownership to a fixed HTTPS GET with no redirects and rejects late account changes',async()=>{
  const s=session(),send=vi.fn().mockResolvedValue({status:200,data:response()});expect(await calendarPracticesRequest(s.client,owner,()=>true,range,send)).toEqual([practice])
  expect(send.mock.calls[0][0]).toMatchObject({url:'https://www.tenaceiq.com/api/mobile/calendar/practices?from=2026-10-26&to=2026-11-01',headers:{Authorization:'Bearer synthetic-token','Cache-Control':'no-store'},disableRedirects:true,readTimeout:30000,webFetchExtra:{cache:'no-store'}})
  send.mockImplementation(async()=>{s.switchOwner();return {status:200,data:response()}});await expect(calendarPracticesRequest(s.client,owner,()=>true,range,send)).rejects.toThrow()
 })
 it('retains the existing calendar on team-source failure, labels it unavailable, and does not retry automatically',async()=>{
  const s=session(),base=vi.fn().mockResolvedValue({ok:true,...calendar()}),team=vi.fn().mockRejectedValue(Error('Synthetic unavailable'))
  expect(await loadCalendarSources(s.client,owner,()=>true,range,base,team)).toMatchObject({owner,practices:[],practicesUnavailable:true,warnings:['Team practice dates couldn’t load. Refresh to check them.']});expect(base).toHaveBeenCalledTimes(1);expect(team).toHaveBeenCalledTimes(1)
  base.mockRejectedValue(Error());team.mockResolvedValue([practice] as never);await expect(loadCalendarSources(s.client,owner,()=>true,range,base,team)).rejects.toThrow()
 })
 it('keeps personal and team sources separate and discards completed reads when the view changes',async()=>{
  const s=session(),base=vi.fn().mockResolvedValue({ok:true,...calendar()}),team=vi.fn().mockResolvedValue([practice]);const loaded=await loadCalendarSources(s.client,owner,()=>true,range,base,team)
  expect(loaded.personal).toEqual([]);expect(loaded.practices).toEqual([practice]);expect(loaded.practicesUnavailable).toBe(false)
  await expect(loadCalendarSources(s.client,owner,()=>false,range,base,team)).rejects.toThrow()
 })
 it('shows actual waitlist/confirmation/cancellation status without inferring attendance or creating personal duplicates',()=>{
  const c=calendar();c.practices=[practice];const entry=calendarOccurrences(c)[0]
  expect(entry).toMatchObject({key:'team-practice:'+practice.id,source:'team',endTime:'20:15',readiness:'Waitlist',detail:'Aces · City · 4.0 · Scheduled'})
  c.practices=[{...practice,response:'in',captainConfirmed:true}];expect(calendarOccurrences(c)[0].readiness).toBe('In · Captain-confirmed')
  c.practices=[{...practice,status:'cancelled'}];expect(calendarOccurrences(c)[0].readiness).toBe('Cancelled');expect(c.personal).toEqual([])
 })
 it('exports the recorded practice duration, excludes cancelled practices and includes no RSVP tokens or links',()=>{
  const c=calendar();c.practices=[practice,{...practice,id:'55555555-5555-4555-8555-555555555555',title:'Cancelled practice',status:'cancelled'}]
  const entries=calendarOccurrences(c),ics=calendarExport(entries,'America/Chicago');expect(entries).toHaveLength(2);expect(exportableCalendarOccurrences(entries)).toHaveLength(1);expect(ics).toContain('20261031T180000');expect(ics).toContain('20261031T201500');expect(ics).toContain('Waitlist');expect(ics).not.toContain('Cancelled practice');expect(ics).not.toContain('URL:');expect(ics).not.toContain('token')
  c.practices=[{...practice,time:'23:40',endTime:''}];expect(calendarExport(calendarOccurrences(c),'America/Chicago')).toContain('20261031T235900')
  c.practices=[{...practice,time:'23:59',endTime:''}];expect(exportableCalendarOccurrences(calendarOccurrences(c))).toEqual([]);expect(calendarExport(calendarOccurrences(c),'America/Chicago')).not.toContain('BEGIN:VEVENT')
 })
})
