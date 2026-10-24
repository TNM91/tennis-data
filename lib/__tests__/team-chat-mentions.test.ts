import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {distinctMentionMembers,hasMentionText,readChatMentions,validateChatMentions} from '../team-chat-mentions'
import {insertTeamMessage} from '../team-room-message-send'
import {TeamChatDraft,ChatActionError,postTeamChat} from '../../mobile/src/team-chat-send'
import {parseTeamData} from '../../mobile/src/team-room-data'
import {chatMatches} from '../../mobile/src/chat-filters'
import {unreadChatIds,firstUnreadChat} from '../../mobile/src/chat-catchup'
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',tag={profileId:id,label:'Alex Sample'},body='Ready, @Alex Sample?'
const members=[{id,name:tag.label},{id:other,name:tag.label}]
const raw={ok:true,teams:[{teamName:'Aces',leagueName:'City',flight:'4.0'}],room:{id:'room',teamName:'Aces',leagueName:'City',flight:'4.0',members:[],messages:[{id:'post',body,mentions:[tag],createdAt:'2026-10-24T12:00:00.123456Z',senderName:'Sam',isMine:false}]}}
describe('explicit teammate mentions',()=>{
 it('withholds ambiguous visible names from the picker while retaining distinct current teammates',()=>{expect(distinctMentionMembers(members)).toEqual([]);expect(distinctMentionMembers([{id,name:'Alex Sample'},{id:other,name:'alex sample'},{id:owner,name:'Jordan'}])).toEqual([{id:owner,name:'Jordan'}])})
 it('requires a selected accepted identity and matching current display name and text',()=>{
  expect(validateChatMentions([tag],body,owner,members)).toEqual([tag])
  for(const [tags,text,allowed] of [[[tag],body,[]],[[{...tag,label:'Fake'}],body,members],[[tag],'email@Alex Sample',members],[[tag],body.replace('Sample','Sampler'),members],[[{...tag,profileId:owner}],body,members]] as [unknown,string,typeof members][])expect(validateChatMentions(tags,text,owner,allowed)).toBeNull()
  expect(validateChatMentions(undefined,body,owner,members)).toEqual([])
  expect(validateChatMentions([{...tag,profileId:other}],body,owner,members)).toEqual([{...tag,profileId:other}])
 })
 it('rejects malformed, duplicate, oversized and control-character tags',()=>{
  for(const value of [null,{},'all',[tag,tag],Array(6).fill(tag),[{...tag,profileId:'everyone'}],[{...tag,label:'a'.repeat(121)}],[{...tag,label:'Alex\nSample'}]])expect(validateChatMentions(value,body,owner,members)).toBeNull()
  expect(hasMentionText('(@Alex Sample), ready?',tag.label)).toBe(true)
  expect(hasMentionText('https://x.test/@Alex Sample',tag.label)).toBe(false)
 })
 it('drops deleted and missing body tokens without inferring mentions from plain text',()=>{
  expect(readChatMentions([tag],'No tag')).toEqual([])
  expect(readChatMentions(undefined,body)).toEqual([])
  expect(parseTeamData(raw).room!.messages[0].mentions).toEqual([tag])
  expect(parseTeamData({...raw,room:{...raw.room,messages:[{...raw.room.messages[0],deletedAt:'now'}]}}).room!.messages[0].mentions).toEqual([])
 })
 it('filters mentions by identity even for identical names, and excludes removed posts',()=>{
  const message=parseTeamData(raw).room!.messages[0]
  expect(chatMatches(message,'mentions','',id)).toBe(true)
  expect(chatMatches(message,'mentions','',other)).toBe(false)
  expect(chatMatches({...message,deletedAt:'now'},'mentions','',id)).toBe(false)
  expect(chatMatches(message,'mentions','no match',id)).toBe(false)
 })
 it('freezes the same mention identities and primary key for uncertain retries',async()=>{
  const send=vi.fn().mockRejectedValueOnce(new ChatActionError('Unknown',true)).mockResolvedValue({ok:true}),draft=new TeamChatDraft(send,()=>other)
  draft.text=body;draft.mentions=[tag];expect(await draft.submit()).toBe(false)
  const first=structuredClone(send.mock.calls[0][0]);draft.mentions=[{...tag,profileId:other}]
  expect(await draft.submit()).toBe(true);expect(send.mock.calls[1][0]).toEqual(first)
  expect(first.mentions).toEqual([tag]);expect(draft.mentions).toEqual([])
 })
 it('does not carry removed tokens into a new send',async()=>{
  const send=vi.fn().mockResolvedValue({ok:true}),draft=new TeamChatDraft(send,()=>other)
  draft.text='Ready';draft.mentions=[tag];await draft.submit();expect(send.mock.calls[0][0].mentions).toEqual([])
 })
 it('rejects an upload acknowledgement that lost or changed the chosen identity',async()=>{
  const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic'}}})}} as unknown as SupabaseClient
  const action={action:'send' as const,clientMessageId:other,body,replyToMessageId:'',mentions:[tag]},send=vi.fn().mockResolvedValue({status:200,data:{ok:true,message:{id:other,isMine:true,body}}})
  await expect(postTeamChat(client,owner,()=>true,raw.teams[0],action,send)).rejects.toMatchObject({uncertain:true})
  send.mockResolvedValue({status:200,data:{ok:true,message:{id:other,isMine:true,body,mentions:[tag]}}});await expect(postTeamChat(client,owner,()=>true,raw.teams[0],action,send)).resolves.toMatchObject({ok:true})
 })
 it('stores mention metadata once and refuses a different mention identity on replay',async()=>{
  const row={id:other,sender_user_id:owner,body,message_kind:'message',reply_to_message_id:null,metadata:{nativeMentions:[tag]}}
  const q={insert:vi.fn(),select:vi.fn(),eq:vi.fn(),single:vi.fn().mockResolvedValue({error:{code:'23505'}}),maybeSingle:vi.fn().mockResolvedValue({data:row})};q.insert.mockReturnValue(q);q.select.mockReturnValue(q);q.eq.mockReturnValue(q)
  const service={from:()=>q} as unknown as SupabaseClient,input={conversationId:'room',senderUserId:owner,body,announcement:false,replyToMessageId:null,clientMessageId:other,mentions:[tag]}
  expect(await insertTeamMessage(service,input)).toMatchObject({ok:true,replayed:true});expect(q.insert.mock.calls[0][0].metadata).toEqual({nativeMentions:[tag]})
  expect(await insertTeamMessage(service,{...input,mentions:[{...tag,profileId:other}]})).toMatchObject({status:409})
 })
})
describe('bounded unread position',()=>{
 it('counts only incoming visible posts after the exact microsecond checkpoint',()=>{
  const message=parseTeamData(raw).room!.messages[0],messages=[{...message,id:'equal',createdAt:'2026-10-24T12:00:00.123455Z'},message,{...message,id:'own',isMine:true},{...message,id:'removed',deletedAt:'now'},{...message,id:'invalid',createdAt:'invalid'}]
  const unread=unreadChatIds(messages,'2026-10-24T12:00:00.123455Z');expect([...unread]).toEqual(['post']);expect(firstUnreadChat(messages,unread)).toBe('post')
  expect(firstUnreadChat(messages,new Set())).toBe('');expect(unreadChatIds(messages,message.createdAt).size).toBe(0)
 })
})
