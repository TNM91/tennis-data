import {describe,it,expect} from 'vitest'
import {chatTimeline} from '../../mobile/src/chat-timeline'
import type {TeamMessage} from '../../mobile/src/team-room-data'

const message=(id:string,minutes=0,extra:Partial<TeamMessage>={}):TeamMessage=>({id,senderUserId:'sender-a',senderName:'Alex Rivera',body:'Ready for practice',kind:'message',createdAt:new Date(2026,10,1,12,minutes).toISOString(),deletedAt:'',isMine:false,replyToMessageId:'',hasAttachment:false,card:null,...extra})
describe('team conversation reading order',()=>{
 it('groups adjacent messages by identity within five minutes while preserving every message',()=>{
  const rows=chatTimeline([message('a'),message('b',5),message('c',11)])
  expect(rows.map(row=>row.id)).toEqual(['a','b','c'])
  expect(rows.map(row=>row.continuation)).toEqual([false,true,false])
  expect(rows.map(row=>row.startsDay)).toEqual([true,false,false])
  expect(rows[0].fullTime).toContain('2026')
 })
 it('does not group namesakes, unknown identities, changed attribution or reversed timestamps',()=>{
  for(const extra of [{senderUserId:'sender-b'},{senderUserId:''},{senderName:'Another Alex'},{isMine:true},{createdAt:message('older',-1).createdAt}]){
   expect(chatTimeline([message('a'),message('b',1,extra)])[1].continuation).toBe(false)
  }
 })
 it('keeps replies, announcements, removed posts, media and team plans distinct',()=>{
  const plan='https://www.tenaceiq.com/team-room?poll=55555555-5555-4555-8555-555555555555'
  for(const extra of [{replyToMessageId:'original'},{kind:'announcement'},{deletedAt:'removed'},{hasAttachment:true},{hasPhoto:true},{body:plan}]){
   expect(chatTimeline([message('a'),message('b',1,extra),message('c',2)]).map(row=>row.continuation)).toEqual([false,false,false])
  }
 })
 it('uses local calendar days and never groups across midnight, even within five minutes',()=>{
  const rows=chatTimeline([message('a',0,{createdAt:new Date(2026,10,1,23,59).toISOString()}),message('b',0,{createdAt:new Date(2026,10,2,0,1).toISOString()})])
  expect(rows.map(row=>row.day)).toEqual(['2026-11-01','2026-11-02'])
  expect(rows.map(row=>row.startsDay)).toEqual([true,true])
  expect(rows[1].continuation).toBe(false)
 })
 it('labels only visible days and does not join runs across filtered messages',()=>{
  const messages=[message('a'),message('hidden',1),message('b',2),message('tomorrow',0,{createdAt:new Date(2026,10,2,12).toISOString()})]
  expect(chatTimeline(messages,new Set(['a','b'])).map(row=>[row.id,row.startsDay,row.continuation])).toEqual([['a',true,false],['b',false,false]])
  expect(chatTimeline(messages,new Set(['b']))[0]).toMatchObject({id:'b',startsDay:true,continuation:false})
  expect(chatTimeline(messages,new Set())).toEqual([])
 })
 it('keeps invalid timestamps explicit and never invents chronology',()=>{
  const rows=chatTimeline([message('a',0,{createdAt:''}),message('b',0,{createdAt:'invalid'}),message('c')])
  expect(rows[0]).toMatchObject({day:'',dayLabel:'Date unavailable',timeLabel:'Time unavailable',continuation:false})
  expect(rows[1].continuation).toBe(false)
  expect(rows[2].startsDay).toBe(true)
 })
 it('starts a fresh sender group at the first unread message without changing order',()=>{
  const rows=chatTimeline([message('read'),message('unread',1),message('next',2)],new Set(['read','unread','next']),new Set(['unread']))
  expect(rows.map(row=>row.continuation)).toEqual([false,false,true])
 })
})
