import {beforeEach,it,expect,vi} from 'vitest'
const s=vi.hoisted(()=>({allowed:false,service:vi.fn(),load:vi.fn(),announce:vi.fn(),post:vi.fn(),postPrivate:vi.fn()}))
vi.mock('@/lib/captain-api-auth',()=>({getCaptainApiAuth:async()=>s.allowed?{ok:true,userId:'owner'}:{ok:false,response:Response.json({ok:false},{status:401})}}))
vi.mock('@/lib/captain-availability-request-server',()=>({getCaptainAvailabilityServiceClient:s.service}))
vi.mock('@/lib/native-practice-sharing',()=>({loadNativePracticeSharing:s.load,announceNativePractice:s.announce}))
vi.mock('@/app/api/team-rooms/route',()=>({POST:s.post}))
vi.mock('@/lib/first-party-team-chat',()=>({writeFirstPartyChat:s.postPrivate}))
import {GET,POST} from '../../app/api/mobile/captain/practices/share/route'
beforeEach(()=>{s.allowed=false;vi.clearAllMocks()})
it('requires Captain authentication before share, lookup or announcement service access',async()=>{expect((await GET(new Request('https://synthetic.invalid/api/mobile/captain/practices/share'))).status).toBe(401);expect((await POST(new Request('https://synthetic.invalid/api/mobile/captain/practices/share',{method:'POST',body:'{}'}))).status).toBe(401);expect(s.service).not.toHaveBeenCalled();expect(s.post).not.toHaveBeenCalled()})
it('rejects malformed authenticated request bodies before service access',async()=>{s.allowed=true;for(const body of ['{','null','[]'])expect((await POST(new Request('https://synthetic.invalid/api/mobile/captain/practices/share',{method:'POST',body}))).status).toBe(400);expect(s.service).not.toHaveBeenCalled()})
it('excludes internal room IDs from explicit sharing and marks replies private',async()=>{s.allowed=true;s.load.mockResolvedValue({ok:true,status:200,owner:'owner',scope:{},practice:{status:'confirmed'},rsvpPath:'/pr/approved',roomId:'private-room'});const r=await GET(new Request('https://synthetic.invalid/api/mobile/captain/practices/share?eventId=event'));expect(r.headers.get('Cache-Control')).toBe('private, no-store');expect(r.headers.get('Referrer-Policy')).toBe('no-referrer');expect(JSON.stringify(await r.json())).not.toContain('private-room')})
it('reuses the existing authorized announcement path with no arbitrary fields from the client',async()=>{s.allowed=true;s.post.mockResolvedValue(Response.json({ok:true}));s.announce.mockImplementation(async(_service,_owner,_scope,_body,deliver)=>{await deliver({body:'Reviewed announcement',clientMessageId:'fixed-id'});return {ok:true,status:200}});const r=await POST(new Request('https://synthetic.invalid/api/mobile/captain/practices/share?team=Aces&league=City&flight=4.0',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify({action:'announce',untrusted:'ignored'})}));expect(r.status).toBe(200);const forwarded=s.post.mock.calls[0][0] as Request;expect(new URL(forwarded.url).pathname).toBe('/api/team-rooms');expect(await forwarded.json()).toEqual({teamName:'Aces',leagueName:'City',flight:'4.0',action:'send',announcement:true,replyToMessageId:'',body:'Reviewed announcement',clientMessageId:'fixed-id'})})
it('routes a private practice only through the first-party team conversation',async()=>{
 s.allowed=true
 s.service.mockReturnValue('service')
 s.postPrivate.mockResolvedValue({ok:true,status:200})
 const roomId='33333333-3333-4333-8333-333333333333'
 s.announce.mockImplementation(async(_service,_owner,_scope,_body,deliver)=>{
  await deliver({body:'Private practice',clientMessageId:'fixed-id'},roomId)
  return {ok:true,status:200}
 })
 const leagueName='Private team '+roomId
 const query=new URLSearchParams({team:'Aces',league:leagueName,flight:'4.0'})
 const result=await POST(new Request('https://synthetic.invalid/api/mobile/captain/practices/share?'+query,{
  method:'POST',headers:{Authorization:'Bearer synthetic'},body:'{"action":"announce"}',
 }))
 expect(result.status).toBe(200)
 expect(s.post).not.toHaveBeenCalled()
 expect(s.postPrivate).toHaveBeenCalledWith('service','owner',roomId,{action:'send',
  replyToMessageId:'',body:'Private practice',clientMessageId:'fixed-id'})
})
