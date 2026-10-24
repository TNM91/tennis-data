import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {ChatActionError,postTeamChat,TeamChatDraft} from '../../mobile/src/team-chat-send'
const scope={teamName:'Aces',leagueName:'City',flight:'4.0'}
const action={action:'send' as const,clientMessageId:'1959be10-4557-4a03-87bd-584ba14ff519',body:'Ready for doubles',replyToMessageId:''}
const client={auth:{getSession:vi.fn().mockResolvedValue({data:{session:{user:{id:'owner'},access_token:'synthetic-token'}},error:null})}} as unknown as SupabaseClient
const success={status:200,data:{ok:true,message:{id:action.clientMessageId,isMine:true,body:action.body}}}
describe('native team composer send lifecycle',()=>{
 it('retries the identical payload/key after an uncertain failure without allowing simultaneous sends',async()=>{
  let fail=true
  const send=vi.fn(async()=>{if(fail){fail=false;throw new ChatActionError('Uncertain',true)}})
  const id=vi.fn(()=>action.clientMessageId),draft=new TeamChatDraft(send,id)
  draft.text='  Ready for doubles  ';draft.reply={id:'first-message',name:'Captain',body:'See you there'}
  expect(await draft.submit()).toBe(false)
  expect(draft.text).toContain('Ready');expect(draft.pending?.replyToMessageId).toBe('first-message')
  const pending=draft.pending
  expect(await draft.submit()).toBe(true)
  expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);expect(id).toHaveBeenCalledTimes(1)
  expect(pending?.body).toBe('Ready for doubles');expect(draft.text).toBe('');expect(draft.reply).toBeNull();expect(draft.pending).toBeNull()
 })
 it('keeps a rejected draft editable and ignores empty and simultaneous submits',async()=>{
  const rejection=new TeamChatDraft(async()=>{throw new ChatActionError('Not allowed',false)},()=>action.clientMessageId)
  expect(await rejection.submit()).toBe(false)
  rejection.text=action.body;expect(await rejection.submit()).toBe(false);expect(rejection.pending).toBeNull();expect(rejection.text).toBe(action.body)
  let finish!:()=>void
  const send=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve})),draft=new TeamChatDraft(send,()=>action.clientMessageId)
  draft.text=action.body;const first=draft.submit();expect(await draft.submit()).toBe(false);expect(send).toHaveBeenCalledTimes(1);finish();await first
 })
 it('clears drafts on disposal and discards late results',async()=>{
  let finish!:()=>void
  const draft=new TeamChatDraft(()=>new Promise<void>(resolve=>{finish=resolve}),()=>action.clientMessageId)
  draft.text='private';const task=draft.submit();draft.dispose();finish();expect(await task).toBe(false);expect(draft.text).toBe('');expect(draft.pending).toBeNull();expect(draft.notice).toBe('')
 })
 it('pins POST transport, verifies the current owner, and confirms the exact send',async()=>{
  const send=vi.fn().mockResolvedValue(success)
  await postTeamChat(client,'owner',()=>true,scope,action,send)
  expect(send.mock.calls[0][0]).toMatchObject({url:'https://www.tenaceiq.com/api/team-rooms',data:{...scope,...action},headers:{Authorization:'Bearer synthetic-token'},disableRedirects:true,readTimeout:12000,connectTimeout:12000})
  send.mockClear();await expect(postTeamChat(client,'other',()=>true,scope,action,send)).rejects.toThrow('Sign in');expect(send).not.toHaveBeenCalled()
  await expect(postTeamChat(client,'owner',()=>false,scope,action,send)).rejects.toThrow('Sign in');expect(send).not.toHaveBeenCalled()
 })
 it('treats timeouts, redirects and malformed/mismatched success as uncertain',async()=>{
  for(const response of [{status:503},{status:302},{status:200,data:{ok:true,message:{...success.data.message,id:'other'}}},{status:200,data:{ok:true,message:{...success.data.message,isMine:false}}},{status:200,data:{ok:true,message:{...success.data.message,body:'different'}}}]) {
   const send=vi.fn().mockResolvedValue(response)
   await expect(postTeamChat(client,'owner',()=>true,scope,action,send)).rejects.toMatchObject({uncertain:true})
  }
  await expect(postTeamChat(client,'owner',()=>true,scope,action,vi.fn().mockRejectedValue(Error('network')))).rejects.toMatchObject({uncertain:true})
  await expect(postTeamChat(client,'owner',()=>true,scope,action,vi.fn().mockResolvedValue({status:403}))).rejects.toMatchObject({uncertain:false})
 })
})
