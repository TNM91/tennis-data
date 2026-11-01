import {afterEach,expect,it,vi} from 'vitest'
import {createCoachMessageChangeTracker,publishCoachMessageCounts,watchCoachMessageCounts} from '../../mobile/src/coach-message-catchup'
import {parseChatUnread,type ChatUnread} from '../../mobile/src/chat-unread'
const first='44444444-4444-4444-8444-444444444444',second='55555555-5555-4555-8555-555555555555'
const value=(owner='owner'):ChatUnread=>({owner,total:0,teams:[],coach:{available:true,total:1,connections:[{id:'student',unread:1,latest:first}]}})
afterEach(()=>{publishCoachMessageCounts(null)})
it('notifies current-owner views from the same count response and stops after disposal',()=>{
 publishCoachMessageCounts(value());const own=vi.fn(),foreign=vi.fn(),stop=watchCoachMessageCounts('owner',own),stopForeign=watchCoachMessageCounts('foreign',foreign)
 expect(own).toHaveBeenLastCalledWith(value());expect(foreign).toHaveBeenLastCalledWith(null)
 publishCoachMessageCounts(null);expect(own).toHaveBeenLastCalledWith(null)
 stop();const calls=own.mock.calls.length;publishCoachMessageCounts(value('foreign'));expect(own).toHaveBeenCalledTimes(calls);expect(foreign).toHaveBeenLastCalledWith(value('foreign'));stopForeign()
})
it('detects new activity with a capped or unchanged count and does not clear it after another device reads',()=>{
 const t=createCoachMessageChangeTracker();t.update('student',{unread:100,latest:first});expect(t.waiting()).toBe(false)
 t.update('student',{unread:100,latest:second});expect(t.waiting()).toBe(true)
 t.update('student',{unread:0,latest:second});expect(t.waiting()).toBe(true)
 t.loaded(t.ticket());expect(t.waiting()).toBe(false)
 t.update('student',{unread:0,latest:first});expect(t.waiting()).toBe(true)
})
it('does not swallow activity arriving while a refresh is in flight',()=>{
 const t=createCoachMessageChangeTracker();t.update('student',{unread:0,latest:first});t.update('student',{unread:1,latest:second});const ticket=t.ticket()
 t.update('student',{unread:2,latest:first});t.loaded(ticket);expect(t.waiting()).toBe(true)
 t.loaded(t.ticket());expect(t.waiting()).toBe(false)
})
it('preserves known activity through an outage and resets when the selected conversation changes',()=>{
 const t=createCoachMessageChangeTracker();t.update('one',{unread:0,latest:null});t.update('one',{unread:1,latest:first});const old=t.ticket()
 t.update('one',undefined);expect(t.waiting()).toBe(true)
 t.update('two',{unread:1,latest:second});expect(t.waiting()).toBe(false);t.update('two',{unread:2,latest:first});t.loaded(old);expect(t.waiting()).toBe(true)
})
it('accepts older count-only servers without claiming their existing unread history is newly arrived',()=>{
 const t=createCoachMessageChangeTracker();t.update('student',{unread:3});expect(t.waiting()).toBe(false)
 t.update('student',{unread:4});expect(t.waiting()).toBe(true);t.update('student',{unread:0});expect(t.waiting()).toBe(false)
})
it('validates optional message metadata while preserving old responses and existing badge totals',()=>{
 const source={ok:true,...value()};expect(parseChatUnread(source,'owner').coach).toEqual(value().coach)
 for(const latest of [null,undefined])expect(parseChatUnread({...source,coach:{available:true,total:1,connections:[{id:'student',unread:1,latest}]}},'owner').coach?.total).toBe(1)
 for(const latest of ['../other',12,{},'https://example.test'])expect(()=>parseChatUnread({...source,coach:{available:true,total:1,connections:[{id:'student',unread:1,latest}]}},'owner')).toThrow()
})
