import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
const m=vi.hoisted(()=>({chatRows:vi.fn(),follow:vi.fn(),replace:vi.fn(),replaceReview:vi.fn(),replaceNotify:vi.fn(),captain:vi.fn(),publish:vi.fn(),load:vi.fn(),create:vi.fn(),push:vi.fn(),nativePush:vi.fn(),recipients:vi.fn()}))
vi.mock('@/lib/team-chat-updates',()=>({loadTeamChatRows:m.chatRows,checkTeamChatAccess:vi.fn()}))
vi.mock('server-only',()=>({}))
vi.mock('@supabase/supabase-js',()=>({createClient:m.create}))
vi.mock('@/lib/supabase',()=>({supabaseUrl:'https://synthetic.supabase.co',supabaseKey:'synthetic-public'}))
vi.mock('@/lib/captain-api-auth',()=>({getCaptainApiAuth:m.captain}))
vi.mock('@/lib/native-replacement-followup',()=>({saveNativeReplacementFollowup:m.follow}))
vi.mock('@/lib/native-captain-replacement',()=>({loadNativeReplacement:m.replaceReview,publishNativeReplacement:m.replace}))
vi.mock('@/lib/native-replacement-notifications',()=>({notifyNativeReplacement:m.replaceNotify}))
vi.mock('@/lib/native-captain-publication',()=>({loadNativePublication:m.load,publishNativeLineup:m.publish,confirmNativeFinalReceipt:vi.fn(),markNativeDraftFinal:vi.fn(),completeNativeFinalAnnouncement:vi.fn()}))
vi.mock('@/lib/team-room-push-server',()=>({sendTeamRoomPush:m.push}))
vi.mock('@/lib/native-chat-push-server',()=>({sendNativeTeamChatPush:m.nativePush}))
vi.mock('@/lib/team-chat-safety',()=>({chatNotificationRecipients:m.recipients,loadChatBlocks:vi.fn(),redactBlockedChatRows:vi.fn(),chatSafetyAction:vi.fn()}))
import {GET,POST} from '../../app/api/team-rooms/route'
const scope={teamName:'Aces',leagueName:'City',flight:'4.0'}
const post=(patch:Record<string,unknown>={})=>new Request('https://local/api/team-rooms',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({...scope,action:'publish_native_lineup',...patch})})
let calls:{table:string;method:string;args:unknown[]}[]=[]
beforeEach(()=>{vi.resetAllMocks();calls=[];vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-service');m.captain.mockResolvedValue({ok:true,userId:'owner'});m.recipients.mockImplementation(async(_s,_o,ids)=>ids);m.push.mockResolvedValue(undefined);m.nativePush.mockResolvedValue(undefined);const service={auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},from:(table:string)=>{const data=table==='team_profile_links'?[{profile_user_id:'owner',team_name:'Aces',league_name:'City',flight:'4.0',team_role:'captain'}]:table==='internal_conversation_participants'?[{profile_id:'teammate',muted:false}]:[];const q:Record<string,unknown>={then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(resolve({data,error:null}))};for(const method of ['select','eq','order','in','insert','update'])q[method]=(...args:unknown[])=>{calls.push({table,method,args});return q};q.maybeSingle=async()=>({data:table==='internal_conversations'?{id:'verified-room'}:null,error:null});return q}};m.create.mockReturnValue(service)})
afterEach(()=>vi.unstubAllEnvs())
describe('native publishing API authorization and side effects',()=>{
 it('requires Captain entitlement before review, proposal publication or native final writes',async()=>{for(const request of [post(),post({action:'send_final_lineup',nativeClient:true})]){m.captain.mockResolvedValueOnce({ok:false,response:Response.json({ok:false},{status:403})});expect((await POST(request)).status).toBe(403)}m.captain.mockResolvedValueOnce({ok:false,response:Response.json({ok:false},{status:403})});expect((await GET(new Request('https://local/api/team-rooms?team=Aces&league=City&flight=4.0&nativeCaptainReview=1',{headers:{Authorization:'Bearer synthetic'}}))).status).toBe(403);expect(m.publish).not.toHaveBeenCalled();expect(m.load).not.toHaveBeenCalled();expect(calls.every(c=>c.table==='team_profile_links')).toBe(true)})
 it('rejects another flight even when the legacy team selector falls back to a linked team',async()=>{expect((await POST(post({flight:'4.5'}))).status).toBe(403);expect(m.publish).not.toHaveBeenCalled()})
 it('rejects a fallback team scope before native match or replacement side effects',async()=>{for(const action of ['respond','acknowledge_lineup','set_arrival_status','ack_final_lineup','respond_lineup_change'])expect((await POST(post({action,nativeClient:true,flight:'4.5'}))).status).toBe(403);expect(calls.every(c=>c.table==='team_profile_links')).toBe(true);expect(m.push).not.toHaveBeenCalled()})
 it('does not repeat defaults, conversation updates or notifications for a committed replay',async()=>{m.publish.mockResolvedValue({ok:true,status:200,replayed:true,messageId:'message',conversationId:'room'});expect((await POST(post())).status).toBe(200);expect(calls.every(c=>c.table==='team_profile_links')).toBe(true);expect(m.push).not.toHaveBeenCalled();expect(m.nativePush).not.toHaveBeenCalled()})
 it('notifies once for the insert winner and suppresses every effect on its replay',async()=>{m.publish.mockResolvedValueOnce({ok:true,status:200,replayed:false,messageId:'message',conversationId:'room',matchDate:'2026-10-30',body:'Proposed lineup'}).mockResolvedValueOnce({ok:true,status:200,replayed:true,messageId:'message',conversationId:'room'});expect((await POST(post())).status).toBe(200);expect((await POST(post())).status).toBe(200);expect(m.push).toHaveBeenCalledTimes(1);expect(m.nativePush).toHaveBeenCalledTimes(1);expect(calls.filter(c=>c.table==='internal_notifications'&&c.method==='insert')).toHaveLength(1)})
})

describe('native captain replacement API',()=>{
 it('requires Captain entitlement and exact scope before replacement reads or writes',async()=>{m.captain.mockResolvedValueOnce({ok:false,response:Response.json({ok:false},{status:403})});expect((await POST(post({action:'publish_native_replacement'}))).status).toBe(403);m.captain.mockResolvedValueOnce({ok:false,response:Response.json({ok:false},{status:403})});expect((await GET(new Request('https://local/api/team-rooms?team=Aces&league=City&flight=4.0&nativeCaptainReplacement=1',{headers:{Authorization:'Bearer synthetic'}}))).status).toBe(403);expect((await POST(post({action:'publish_native_replacement',flight:'4.5'}))).status).toBe(403);expect(m.replace).not.toHaveBeenCalled();expect(m.replaceReview).not.toHaveBeenCalled()})
 it('alerts affected players only for the completed delivery winner, never for a replay',async()=>{const result={ok:true,status:200,messageId:'card',announcementMessageId:'announcement',publicationId:'one',conversationId:'room',notice:{affectedNames:['Alex','Riley','Jordan'],courtLabel:'D1',outgoingPlayerName:'Alex',replacementPlayerName:'Riley'}};m.replace.mockResolvedValueOnce({...result,replayed:false}).mockResolvedValueOnce({...result,replayed:true});m.replaceNotify.mockResolvedValue({notifiedCount:3});expect((await POST(post({action:'publish_native_replacement'}))).status).toBe(200);expect((await POST(post({action:'publish_native_replacement'}))).status).toBe(200);expect(m.replaceNotify).toHaveBeenCalledTimes(1);expect(m.replaceNotify.mock.calls[0][1]).toMatchObject({affectedNames:['Alex','Riley','Jordan'],scope,owner:'owner'});expect(calls.filter(c=>c.table==='internal_conversations'&&c.method==='update')).toHaveLength(1)})
})

describe('native replacement final guard',()=>{
 it('cannot bypass an outstanding replacement reply by sending another final',async()=>{m.load.mockResolvedValue({ok:true,status:200,card:{id:'card',metadata:{cardType:'projected_lineup',lineupChangeNotice:{publishedLineupChange:true,response:''}}}});expect((await POST(post({action:'send_final_lineup',nativeClient:true,messageId:'card'}))).status).toBe(409);expect(calls.every(c=>c.table==='team_profile_links')).toBe(true);expect(m.push).not.toHaveBeenCalled()})
})

describe('native replacement follow-up API',()=>{
 it('checks Captain entitlement and exact accepted flight before any follow-up action',async()=>{m.captain.mockResolvedValueOnce({ok:false,response:Response.json({ok:false},{status:403})});expect((await POST(post({action:'native_replacement_followup'}))).status).toBe(403);expect((await POST(post({action:'native_replacement_followup',flight:'4.5'}))).status).toBe(403);expect(m.follow).not.toHaveBeenCalled();expect(m.replaceNotify).not.toHaveBeenCalled()})
 it('targets only the replacement for a reminder winner, suppresses replays and never alerts when saving a deadline',async()=>{const result={ok:true,status:200,messageId:'card',operationId:'op',kind:'reminder',deadlineAt:'',conversationId:'room',replacementPlayerName:'Riley',courtLabel:'D1'};m.follow.mockResolvedValueOnce({...result,replayed:false}).mockResolvedValueOnce({...result,replayed:true}).mockResolvedValueOnce({...result,kind:'deadline',replayed:false,deadlineAt:'2026-10-29T18:00:00.000Z'});m.replaceNotify.mockResolvedValue({notifiedCount:1});for(let i=0;i<3;i++)expect((await POST(post({action:'native_replacement_followup'}))).status).toBe(200);expect(m.replaceNotify).toHaveBeenCalledTimes(1);expect(m.replaceNotify.mock.calls[0][1]).toMatchObject({kind:'reminder',affectedNames:['Riley'],scope,owner:'owner'});expect(calls.every(c=>c.table==='team_profile_links')).toBe(true)})
})

describe('read-only native conversation history API',()=>{
 const before='2026-10-24T08:00:00.123456Z|1959be10-0000-4000-8000-000000000075'
 const read=(patch:Record<string,string>={})=>{const url=new URL('https://local/api/team-rooms');for(const [key,value] of Object.entries({team:'Aces',league:'City',flight:'4.0',chatUpdates:'1',before,...patch}))url.searchParams.set(key,value);return new Request(url,{headers:{Authorization:'Bearer synthetic'}})}
 it('rejects each mismatched scope field before reading the conversation or messages',async()=>{
  for(const patch of [{team:'Other'},{league:'Other'},{flight:'4.5'}] as Record<string,string>[])expect((await GET(read(patch))).status).toBe(403)
  expect(m.chatRows).not.toHaveBeenCalled();expect(calls.every(c=>c.table==='team_profile_links')).toBe(true)
 })
 it('forwards the exact cursor to the scoped read without room, participant, or read-position writes',async()=>{
  m.chatRows.mockResolvedValue({ok:true,rows:[],beforeCursor:before,nextCursor:'',lastReadAt:'',blockedUserIds:[]})
  const response=await GET(read()),data=await response.json()
  expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(data).toMatchObject({chatUpdate:true,beforeCursor:before,nextCursor:'',room:{id:'verified-room',messages:[]}})
  expect(m.chatRows).toHaveBeenCalledWith(expect.anything(),'owner','verified-room',true,before)
  expect(calls.some(c=>['insert','update'].includes(c.method))).toBe(false)
  expect(calls.some(c=>c.table==='internal_conversation_participants')).toBe(false)
 })
})
