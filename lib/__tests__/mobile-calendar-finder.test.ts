import {describe,it,expect} from 'vitest'
import {createCalendarFinder} from '../../mobile/src/calendar-finder'
import type {NativeCalendar} from '../native-calendar-contract'

const calendar=():NativeCalendar=>({owner:'owner',range:{from:'2026-11-02',to:'2026-11-08'},warnings:[],
 personal:[{id:'personal-1',title:'Serve + first ball [A]',date:'2026-11-02',time:'18:00',location:'Café Courts',kind:'practice',recurrenceRule:'FREQ=WEEKLY',availabilityStatus:'',venueDirectoryId:'',venuePreferenceId:'',createdAt:'2026-11-01T10:00:00Z',updatedAt:'2026-11-01T10:00:00Z'}],
 competitions:[{id:'league-1',kind:'league',eventType:'match',competitionId:'season-1',competitionName:'City League',title:'Round four',date:'2026-11-03',time:'19:30',location:'Northside Tennis Center',opponent:'Riverside Rally',detail:'Private response notes',href:'',status:'Confirmed',responseStatus:'',responseUpdatedAt:'',responseIsStale:false}],
 coach:[{id:'coach-1',title:'Return lesson',date:'2026-11-04',time:'08:30',location:'Court 2',detail:'Private coaching notes',kind:'lesson'}],
 practices:[{id:'practice-1',title:'Doubles patterns',date:'2026-11-05',time:'18:00',endTime:'19:00',location:'Southside',status:'confirmed',response:'in',captainConfirmed:false,scope:{teamName:'The Other Guys',leagueName:'Winter League',flight:'4.5'}}]})

describe('native calendar agenda finder',()=>{
 it('finds event titles, venues, competition opponents and exact loaded team labels across sources',()=>{
  const f=createCalendarFinder(calendar())
  for(const [query,id] of [['Serve + first','personal-1'],['Northside','league-1'],['Riverside Rally','league-1'],['City League','league-1'],['Coach','coach-1'],['The Other Guys','practice-1'],['Winter League','practice-1'],['4.5','practice-1']])expect(f.find(query).map(e=>e.id)).toEqual([id])
 })
 it('normalizes case, accents, width and repeated spaces while treating punctuation literally',()=>{
  const f=createCalendarFinder(calendar())
  expect(f.find('  CAFE   courts ').map(e=>e.id)).toEqual(['personal-1'])
  expect(f.find('ＲＩＶＥＲＳＩＤＥ　ＲＡＬＬＹ').map(e=>e.id)).toEqual(['league-1'])
  expect(f.find('[A]').map(e=>e.id)).toEqual(['personal-1']);expect(f.find('.*')).toEqual([])
 })
 it('searches only loaded labels, omitting notes, dates, availability replies and unrelated records',()=>{
  const f=createCalendarFinder(calendar())
  for(const query of ['Private response','Private coaching','2026-11-02','No reply yet','owner','season-1','missing'])expect(f.find(query)).toEqual([])
 })
 it('keeps recorded order and occurrence keys without mutating source records',()=>{
  const source=calendar(),before=JSON.stringify(source),f=createCalendarFinder(source)
  expect(f.find('  ')).toBe(f.entries);expect(f.find('league').map(e=>e.id)).toEqual(['league-1','practice-1'])
  expect(f.find('practice').map(e=>e.key)).toEqual(['personal:personal-1:2026-11-02','team-practice:practice-1'])
  expect(JSON.stringify(source)).toBe(before)
 })
 it('searches every loaded repeating occurrence rather than the first visible page',()=>{
  const source=calendar();source.range={from:'2026-11-01',to:'2026-11-30'};source.personal[0].recurrenceRule='FREQ=DAILY'
  const f=createCalendarFinder(source);expect(f.find('Serve + first')).toHaveLength(29);expect(f.find('Serve + first').at(-1)?.date).toBe('2026-11-30')
 })
})
