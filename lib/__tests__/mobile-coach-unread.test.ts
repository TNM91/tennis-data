import {expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {parseChatUnread,combinedChatUnread,paintChatsBadge} from '../../mobile/src/chat-unread'
import {markCoachChatRead} from '../../mobile/src/coach-chats-data'
import type {CoachSend} from '../../mobile/src/coach-workspace-data'
const owner='11111111-1111-4111-8111-111111111111',student='student-one',message='44444444-4444-4444-8444-444444444444'
const teams=[{teamName:'Aces',leagueName:'City',flight:'4.0',unread:7}],coach={available:true,total:3,connections:[{id:student,unread:2},{id:'student-two',unread:1}]}
const payload={ok:true,owner,total:7,teams}
const client=(who=()=>owner)=>({auth:{getSession:async()=>({data:{session:{user:{id:who()},access_token:'synthetic-token'}},error:null})}} as SupabaseClient)
const reply=()=>({status:200,data:{ok:true,owner,student,through:message},headers:{},url:''})

it('preserves the installed-build team contract while combining optional coach counts in the new client',()=>{
 expect(parseChatUnread(payload,owner)).toEqual({owner,total:7,teams})
 const parsed=parseChatUnread({...payload,coach},owner);expect(parsed.total).toBe(7);expect(combinedChatUnread(parsed)).toBe(10)
 expect(combinedChatUnread(parseChatUnread({...payload,coach:{...coach,total:100,connections:[{id:student,unread:100}]}},owner))).toBe(100)
 expect(combinedChatUnread(null)).toBeNull()
})
it('rejects malformed, duplicate or inconsistent private counts and keeps unavailable distinct from zero',()=>{
 for(const changed of [{...coach,total:8},{...coach,connections:[coach.connections[0],coach.connections[0]]},{...coach,connections:[{id:'../foreign',unread:3}]},{...coach,connections:[{id:student,unread:101}]},{...coach,available:false},{...coach,connections:Array(101).fill({id:student,unread:0})}])expect(()=>parseChatUnread({...payload,coach:changed},owner)).toThrow()
 const unavailable={available:false,total:0,connections:[]};expect(parseChatUnread({...payload,coach:unavailable},owner).coach).toEqual(unavailable)
 expect(parseChatUnread({...payload,coach:{...unavailable,available:true}},owner).coach?.available).toBe(true)
})
it('announces a partial badge without claiming that unknown coach counts are zero',()=>{
 const badge={hidden:false,textContent:''},setAttribute=vi.fn(),button={setAttribute,querySelector:()=>badge} as unknown as HTMLElement
 paintChatsBadge(button,7,true);expect(setAttribute).toHaveBeenLastCalledWith('aria-label','Chats, at least 7 unread messages. Some counts unavailable.');expect(badge.textContent).toBe('7')
 paintChatsBadge(button,0,true);expect(setAttribute).toHaveBeenLastCalledWith('aria-label','Chats, unread counts unavailable.');expect(badge.hidden).toBe(true)
 paintChatsBadge(button,100);expect(setAttribute).toHaveBeenLastCalledWith('aria-label','Chats, 99+ unread messages')
})
it('acknowledges one selected rendered message with no caller-supplied checkpoint or account override',async()=>{
 const send=vi.fn<CoachSend>(async()=>reply());await markCoachChatRead(client(),owner,()=>true,student,message,send)
 expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0]).toMatchObject(['PATCH',{url:'https://www.tenaceiq.com/api/mobile/coach/messages?student=student-one',data:{message},disableRedirects:true,readTimeout:15000,headers:{Authorization:'Bearer synthetic-token'}}])
 expect(Object.keys(send.mock.calls[0][1].data as object)).toEqual(['message'])
})
it('rejects stale ownership before sending and discards an acknowledgement after an account change',async()=>{
 let who='other';const send=vi.fn<CoachSend>(async()=>reply());await expect(markCoachChatRead(client(()=>who),owner,()=>true,student,message,send)).rejects.toThrow();expect(send).not.toHaveBeenCalled()
 who=owner;send.mockImplementation(async()=>{who='other';return reply()});await expect(markCoachChatRead(client(()=>who),owner,()=>true,student,message,send)).rejects.toThrow()
})
it('does not clear counts for failed or mismatched read confirmations and never retries automatically',async()=>{
 for(const response of [{...reply(),status:503},{...reply(),data:{...reply().data,owner:'foreign'}},{...reply(),data:{...reply().data,student:'other'}},{...reply(),data:{...reply().data,through:'other'}}]){const send=vi.fn<CoachSend>(async()=>response);await expect(markCoachChatRead(client(),owner,()=>true,student,message,send)).rejects.toThrow();expect(send).toHaveBeenCalledTimes(1)}
 const send=vi.fn<CoachSend>();await expect(markCoachChatRead(client(),owner,()=>true,student,'not-a-message',send)).rejects.toThrow();expect(send).not.toHaveBeenCalled()
})
