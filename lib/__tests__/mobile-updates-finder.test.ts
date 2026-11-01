import {describe,it,expect} from 'vitest'
import {createUpdatesFinder} from '../../mobile/src/updates-finder'
import type {InternalNotification} from '../internal-notification-record'

const row=(id:string,title:string,body=''):InternalNotification=>({id,title,body,recipientProfileId:'private-owner',actorUserId:'private-actor',notificationType:'schedule',href:'/private-link',conversationId:'private-thread',scheduleEventId:'private-event',readAt:'',createdAt:'2026-11-01T12:00:00Z'})
describe('loaded Updates finder',()=>{
 it('finds literal titles and previews while retaining source order and record identity',()=>{
  const rows=[row('one','Café Courts [A]','Bring your return notes.'),row('two','Return lesson'),row('three','Season ready')],before=JSON.stringify(rows),finder=createUpdatesFinder(rows)
  expect(finder.find('return')).toEqual([rows[0],rows[1]]);expect(finder.find('return')[0]).toBe(rows[0]);expect(finder.find(' ')).toBe(rows);expect(JSON.stringify(rows)).toBe(before)
 })
 it('normalizes accents, width, case and repeated spaces without treating punctuation as code',()=>{
  const finder=createUpdatesFinder([row('one','Café Courts [A]','Bring  return notes')])
  for(const query of [' CAFE   courts ','ＣＡＦＥ　ＣＯＵＲＴＳ','[A]','RETURN  notes'])expect(finder.find(query)).toHaveLength(1)
  expect(finder.find('.*')).toEqual([]);expect(finder.find('<img')).toEqual([])
 })
 it('excludes hidden identifiers, targets, dates and type labels from search',()=>{
  const finder=createUpdatesFinder([row('private-id','Your lesson is ready')])
  for(const query of ['private-id','private-owner','private-actor','private-link','private-thread','private-event','2026-11-01','schedule'])expect(finder.find(query)).toEqual([])
  expect(finder.find('ready lesson')).toEqual([])
 })
 it('searches every loaded record, including older pages, and bounds the query',()=>{
  const rows=Array.from({length:100},(_,i)=>row(String(i),'Update '+i)),finder=createUpdatesFinder(rows)
  expect(finder.find('Update 99')).toEqual([rows[99]]);expect(finder.find('Update 100')).toEqual([])
  expect(createUpdatesFinder([row('long','x'.repeat(160))]).find('x'.repeat(160)+'never sent')).toHaveLength(1)
  expect(createUpdatesFinder([]).find('anything')).toEqual([])
 })
})
