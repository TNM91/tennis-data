import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
vi.mock('server-only',()=>({}))
import {nativeChatUnread} from '../native-chat-unread'
import {GET} from '../../app/api/mobile/chats/unread/route'
import {parseChatUnread,loadChatUnread,createChatUnreadCounter} from '../../mobile/src/chat-unread'
import {verifiedAccount,accountClient} from '../mobile-account-auth'
vi.mock('../mobile-account-auth',()=>({verifiedAccount:vi.fn(),accountClient:vi.fn()}))
const owner='11111111-1111-4111-8111-111111111111',scope={teamName:'Baseline Aces',leagueName:'City League',flight:'4.0'}
const summary={owner,total:7,teams:[{...scope,unread:7}]}
function service(rows:unknown[]= [{team_name:scope.teamName,league_name:scope.leagueName,flight:scope.flight}]){
 const q:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:rows,error:null}).then(resolve)}
 for(const method of ['select','eq','is','limit'])q[method]=vi.fn(()=>q)
 const rpc=vi.fn().mockResolvedValue({data:{ok:true,status:200,namedRooms:1,parentId:'22222222-2222-4222-8222-222222222222',teamMuted:true,canCreate:false,generalUnread:2,rooms:[{id:'33333333-3333-4333-8333-333333333333',name:'Practice',unread:5,muted:true}]},error:null})
 return {from:vi.fn(()=>q),rpc,q} as unknown as SupabaseClient & {rpc:ReturnType<typeof vi.fn>;q:Record<string,ReturnType<typeof vi.fn>>}
}
describe('owner-scoped chat badges',()=>{
 it('reuses current room access, deduplicates team links, includes named rooms and preserves muted unread counts',async()=>{
  const row={team_name:scope.teamName,league_name:scope.leagueName,flight:scope.flight},s=service([row,row])
  expect(await nativeChatUnread(s,owner)).toEqual(summary)
  expect(s.q.eq).toHaveBeenCalledWith('profile_user_id',owner);expect(s.q.eq).toHaveBeenCalledWith('status','accepted');expect(s.q.is).toHaveBeenCalledWith('archived_at',null)
  expect(s.rpc).toHaveBeenCalledExactlyOnceWith('native_team_chat_rooms',{p_owner:owner,p_team:scope.teamName,p_league:scope.leagueName,p_flight:scope.flight,p_action:'list',p_id:null,p_name:null})
 })
 it('skips inaccessible/uninitialized rooms and fails closed for aggregate outages or unbounded lists',async()=>{
  const s=service();s.rpc.mockResolvedValue({data:{ok:false,status:403}});expect((await nativeChatUnread(s,owner)).total).toBe(0)
  s.rpc.mockResolvedValue({error:{}});await expect(nativeChatUnread(s,owner)).rejects.toThrow()
  await expect(nativeChatUnread(service(Array(51).fill({})),owner)).rejects.toThrow()
 })
 it('returns no counts before verified authentication and rejects owner overrides with private no-store responses',async()=>{
  vi.mocked(verifiedAccount).mockResolvedValue(null)
  const denied=await GET(new Request('https://www.tenaceiq.com/api/mobile/chats/unread'));expect(denied.status).toBe(401);expect(denied.headers.get('cache-control')).toBe('private, no-store');expect(accountClient).not.toHaveBeenCalled()
  vi.mocked(verifiedAccount).mockResolvedValue({user:{id:owner}} as never)
  expect((await GET(new Request('https://www.tenaceiq.com/api/mobile/chats/unread?owner=other'))).status).toBe(400)
 })
 it('validates ownership, totals and duplicate scopes; caps large counts at 99+',()=>{
  expect(parseChatUnread({ok:true,...summary},owner)).toEqual(summary)
  for(const value of [{...summary,owner:'other'},{...summary,total:8},{...summary,teams:[...summary.teams,...summary.teams]},{...summary,total:-1},{...summary,total:101}])expect(()=>parseChatUnread({ok:true,...value},owner)).toThrow()
  expect(parseChatUnread({ok:true,owner,total:100,teams:[{...scope,unread:100}]},owner).total).toBe(100)
 })
 it('pins bearer ownership and rejects redirects, failed responses and account switches in flight',async()=>{
  let currentOwner=owner
  const client={auth:{getSession:vi.fn(async()=>({data:{session:{user:{id:currentOwner},access_token:'synthetic'}},error:null}))}} as unknown as SupabaseClient
  const send=vi.fn<(options:unknown)=>Promise<{status:number;data:unknown}>>().mockResolvedValue({status:200,data:{ok:true,...summary}})
  expect(await loadChatUnread(client,owner,()=>true,send as never)).toEqual(summary)
  expect(send.mock.calls[0][0]).toMatchObject({disableRedirects:true,connectTimeout:12000,readTimeout:12000,headers:{Authorization:'Bearer synthetic'}})
  send.mockImplementation(async()=>{currentOwner='other';return {status:200,data:{ok:true,...summary}}})
  await expect(loadChatUnread(client,owner,()=>true,send as never)).rejects.toThrow()
 })
 it('drops old-account responses and coalesces refresh bursts without clearing unread on a failed read',async()=>{
  const deliveries:((value:typeof summary)=>void)[]=[],load=vi.fn(()=>new Promise<typeof summary>(resolve=>deliveries.push(resolve))),dispose=vi.fn(),watch=vi.fn(()=>({dispose,isForeground:()=>true,retry:()=>{}})),changed=vi.fn()
  const counter=createChatUnreadCounter({} as SupabaseClient,changed,load,watch)
  counter.setOwner(owner);counter.setOwner(owner);expect(load).toHaveBeenCalledTimes(1);expect(watch).toHaveBeenCalledTimes(1)
  void counter.refresh();void counter.refresh();deliveries[0](summary);await vi.waitFor(()=>expect(load).toHaveBeenCalledTimes(2))
  counter.setOwner('other');expect(counter.snapshot()).toBeNull();deliveries[1](summary);deliveries[2]({...summary,owner:'other'});await vi.waitFor(()=>expect(counter.snapshot()?.owner).toBe('other'))
  expect(changed.mock.calls.slice(changed.mock.calls.findLastIndex(call=>call[0]===null)+1).every(call=>call[0].owner==='other')).toBe(true)
  counter.clear();expect(counter.snapshot()).toBeNull();expect(dispose).toHaveBeenCalledTimes(2)
 })
})
