import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {namedTeamChatRooms,namedChatRoomName} from '../named-team-chat-rooms'
import {parseChatRoomList,requestChatRooms} from '../../mobile/src/named-chat-rooms'
import {pushTeamDestination} from '../../mobile/src/native-push'
const parent='77777777-7777-4777-8777-777777777700',id='77777777-7777-4777-8777-777777777701',scope={teamName:'Aces',leagueName:'City',flight:'4.0',chatRoomId:id}
const reply={ok:true,namedRooms:1,parentId:parent,teamMuted:false,canCreate:true,generalUnread:3,rooms:[{id,name:'Practice',unread:1,muted:false}]}
const client=(owner='owner')=>({auth:{getSession:vi.fn().mockResolvedValue({data:{session:{user:{id:owner},access_token:'synthetic'}},error:null})}} as unknown as SupabaseClient)
describe('named team chat rooms',()=>{
 it('checks names and sends only exact owner/scoped RPC parameters',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:reply,error:null}),service={rpc} as unknown as SupabaseClient
  expect(await namedTeamChatRooms(service,'owner',scope,'list')).toMatchObject(reply)
  expect(rpc).toHaveBeenCalledWith('native_team_chat_rooms',{p_owner:'owner',p_team:'Aces',p_league:'City',p_flight:'4.0',p_action:'list',p_id:null,p_name:null})
  for(const name of ['', ' General ', 'GENERAL','A'.repeat(49),'A\nB'])expect(namedChatRoomName(name)).toBe(false)
  expect(namedChatRoomName('Practice')).toBe(true)
  expect(await namedTeamChatRooms(service,'owner',scope,'create','bad','Practice')).toMatchObject({ok:false,status:400});expect(rpc).toHaveBeenCalledTimes(1)
 })
 it('rejects malformed summaries, duplicate rooms and inaccessible outcomes without exposing RPC details',async()=>{
  const rpc=vi.fn(),service={rpc} as unknown as SupabaseClient
  for(const data of [{...reply,rooms:[...reply.rooms,...reply.rooms]},{...reply,rooms:[{...reply.rooms[0],unread:101}]},{...reply,parentId:'bad'},{ok:false,status:403}]){rpc.mockResolvedValueOnce({data});expect((await namedTeamChatRooms(service,'owner',scope,'list')).ok).toBe(false)}
  rpc.mockRejectedValueOnce(Error('private'));expect(await namedTeamChatRooms(service,'owner',scope,'list')).toMatchObject({ok:false,status:503})
 })
 it('pins native transport and does not send a current room ID when creating a sibling',async()=>{
  const transport={get:vi.fn().mockResolvedValue({status:200,data:reply}),post:vi.fn().mockResolvedValue({status:200,data:{ok:true,namedRooms:1,parentId:parent,id,name:'Practice'}})}
  await requestChatRooms(client(),'owner',scope,parent,()=>true,undefined,transport as never)
  const get=transport.get.mock.calls[0][0];expect(new URL(get.url).searchParams.get('namedRooms')).toBe('1');expect(get.disableRedirects).toBe(true);expect(get.connectTimeout).toBe(12000)
  await requestChatRooms(client(),'owner',scope,parent,()=>true,{id,name:'Practice',check:false},transport as never)
  expect(transport.post.mock.calls[0][0].data).toEqual({teamName:'Aces',leagueName:'City',flight:'4.0',action:'create_chat_room',clientRoomId:id,roomName:'Practice'})
  await expect(requestChatRooms(client('other'),'owner',scope,parent,()=>true,undefined,transport as never)).rejects.toThrow('Sign in');expect(transport.get).toHaveBeenCalledTimes(1)
 })
 it('rejects changed owners/visits and frozen room receipts from a different parent',async()=>{
  let active=true;const transport={get:vi.fn(async()=>{active=false;return {status:200,data:reply}}),post:vi.fn().mockResolvedValue({status:200,data:{ok:true,namedRooms:1,parentId:id,id,name:'Practice'}})}
  await expect(requestChatRooms(client(),'owner',scope,parent,()=>active,undefined,transport as never)).rejects.toThrow('no longer open')
  await expect(requestChatRooms(client(),'owner',scope,parent,()=>true,{id,name:'Practice',check:true},transport as never)).rejects.toThrow('not be confirmed')
  expect(()=>parseChatRoomList({...reply,rooms:Array(13).fill(reply.rooms[0])},parent)).toThrow()
 })
 it('retains uncertainty for failed creates and never silently retries them',async()=>{
  const transport={post:vi.fn().mockRejectedValue(Error('offline'))}
  await expect(requestChatRooms(client(),'owner',scope,parent,()=>true,{id,name:'Practice',check:false},transport as never)).rejects.toMatchObject({uncertain:true});expect(transport.post).toHaveBeenCalledTimes(1)
 })
 it('only opens named-room alerts for the same owner and a valid room ID',()=>{
  expect(pushTeamDestination({recipient:'owner',href:'/team-room?team=Aces&league=City&flight=4.0&chatRoom='+id},'owner')).toEqual(scope)
  expect(pushTeamDestination({recipient:'owner',href:'/team-room?team=Aces&league=City&chatRoom=bad'},'owner')).toBeNull()
  expect(pushTeamDestination({recipient:'other',href:'/team-room?team=Aces&league=City&chatRoom='+id},'owner')).toBeNull()
 })
})
