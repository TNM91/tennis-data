import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
const m=vi.hoisted(()=>({create:vi.fn(),named:vi.fn(),access:vi.fn(),rows:vi.fn(),reactions:vi.fn(),setReaction:vi.fn()}))
vi.mock('server-only',()=>({}))
vi.mock('@supabase/supabase-js',()=>({createClient:m.create}))
vi.mock('@/lib/supabase',()=>({supabaseUrl:'https://synthetic.supabase.co',supabaseKey:'synthetic-public'}))
vi.mock('@/lib/named-team-chat-rooms',()=>({namedTeamChatRooms:m.named}))
vi.mock('@/lib/team-chat-updates',()=>({checkTeamChatAccess:m.access,loadTeamChatRows:m.rows}))
vi.mock('@/lib/native-chat-reactions',()=>({loadNativeReactionSummary:m.reactions,setNativeChatReaction:m.setReaction}))
import {GET,POST} from '../../app/api/team-rooms/route'
const parent='77777777-7777-4777-8777-777777777700',id='77777777-7777-4777-8777-777777777701',owner='00000000-0000-4000-8000-000000000001'
const scope={teamName:'Aces',leagueName:'City',flight:'4.0'},headers={Authorization:'Bearer synthetic','Content-Type':'application/json'}
let calls:{table:string;method:string;args:unknown[]}[]=[]
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-service');calls=[]
 const service={from:(table:string)=>{const result=()=>({data:table==='team_profile_links'?[{id:'link',profile_user_id:owner,team_name:'Aces',normalized_team_name:'aces',league_name:'City',flight:'4.0',team_role:'captain',team_roles:['captain']}]:table==='internal_conversations'?{id}:[],error:null}),q:Record<string,unknown>={then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(resolve(result())),maybeSingle:async()=>result()};for(const method of ['select','eq','order','in','is','limit'])q[method]=(...args:unknown[])=>{calls.push({table,method,args});return q};return q}}
 m.create.mockImplementation((_url:string,key:string)=>key==='synthetic-service'?service:{auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:owner}},error:null})}})
 m.named.mockResolvedValue({ok:true,status:200,namedRooms:1,parentId:parent,teamMuted:false,id,name:'Practice',replayed:false})
 m.access.mockResolvedValue({ok:true,lastReadAt:''});m.rows.mockResolvedValue({ok:true,beforeCursor:'',nextCursor:'',rows:[],blockedUserIds:[],lastReadAt:''});m.reactions.mockResolvedValue(new Map());m.setReaction.mockResolvedValue({ok:true,status:200,messageId:'post',reaction:'heart',active:true})
})
afterEach(()=>vi.unstubAllEnvs())
const post=(body:unknown)=>POST(new Request('https://local/api/team-rooms',{method:'POST',headers,body:JSON.stringify(body)}))
describe('named-room route authorization and dispatch',()=>{
 it('requires authentication before reading team links or resolving any named room',async()=>{expect((await GET(new Request('https://local/api/team-rooms?namedRooms=1'))).status).toBe(401);expect(m.named).not.toHaveBeenCalled();expect(calls).toEqual([])})
 it('does not silently choose another league through the legacy team-name fallback',async()=>{
  expect((await GET(new Request('https://local/api/team-rooms?team=Aces&league=Other&flight=4.0&namedRooms=1',{headers}))).status).toBe(403)
  expect((await post({...scope,leagueName:'Other',action:'create_chat_room',clientRoomId:id,roomName:'Practice'})).status).toBe(403);expect(m.named).not.toHaveBeenCalled()
 })
 it('uses the authenticated owner and exact accepted scope when creating a room',async()=>{
  const response=await post({...scope,action:'create_chat_room',clientRoomId:id,roomName:'Practice',owner:'attacker'})
  expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(m.named.mock.calls[0].slice(1)).toEqual([owner,scope,'create',id,'Practice'])
 })
 it('blocks official lineup actions inside a social room before any mutation',async()=>{
  expect((await post({...scope,chatRoomId:id,action:'ack_final_lineup',messageId:'post'})).status).toBe(400);expect(m.named).not.toHaveBeenCalled();expect(m.setReaction).not.toHaveBeenCalled()
 })
 it('resolves the named conversation before reacting and never uses the General ID',async()=>{
  expect((await post({...scope,chatRoomId:id,action:'set_chat_reaction',messageId:'post',reaction:'heart',active:true})).status).toBe(200)
  expect(m.named.mock.calls[0].slice(1)).toEqual([owner,scope,'open',id]);expect(m.access.mock.calls[0].slice(1,3)).toEqual([owner,id]);expect(m.setReaction.mock.calls[0].slice(1,3)).toEqual([owner,id]);expect(calls).toContainEqual({table:'internal_conversations',method:'eq',args:['id',id]})
 })
 it('denies revoked parent membership before reading or changing child messages',async()=>{
  m.named.mockResolvedValueOnce({ok:false,status:403});expect((await post({...scope,chatRoomId:id,action:'set_chat_reaction',messageId:'post',reaction:'heart',active:true})).status).toBe(403);expect(m.setReaction).not.toHaveBeenCalled();expect(m.rows).not.toHaveBeenCalled()
 })
 it('preserves the room identity on read-only live refresh and rejects formal data flags',async()=>{
  const response=await GET(new Request('https://local/api/team-rooms?team=Aces&league=City&flight=4.0&chatRoom='+id+'&chatUpdates=1&read=0',{headers}));expect(response.status).toBe(200);expect((await response.json()).room).toMatchObject({id,chatRoom:{id,parentId:parent,name:'Practice'}});expect(m.rows.mock.calls[0].slice(1,3)).toEqual([owner,id])
  m.named.mockClear();expect((await GET(new Request('https://local/api/team-rooms?team=Aces&league=City&flight=4.0&chatRoom='+id+'&activeChallenge=1',{headers}))).status).toBe(400);expect(m.named).not.toHaveBeenCalled()
 })
})
