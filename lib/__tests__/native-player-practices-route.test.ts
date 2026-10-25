import {beforeEach,it,expect,vi} from 'vitest'
const s=vi.hoisted(()=>({allowed:false,service:vi.fn(),load:vi.fn(),reply:vi.fn()}))
vi.mock('@/lib/player-api-auth',()=>({getSignedInPlayerApiAuth:async()=>s.allowed?{ok:true,userId:'owner'}:{ok:false,response:Response.json({ok:false},{status:401})}}))
vi.mock('@/lib/captain-availability-request-server',()=>({getCaptainAvailabilityServiceClient:s.service}))
vi.mock('@/lib/native-player-practices',()=>({loadPlayerPractices:s.load,replyToPlayerPractice:s.reply}))
import {GET,PATCH} from '../../app/api/mobile/practices/route'
beforeEach(()=>{s.allowed=false;vi.clearAllMocks()})
it('requires sign-in before private service access for reads and writes',async()=>{expect((await GET(new Request('https://synthetic.invalid/api/mobile/practices'))).status).toBe(401);expect((await PATCH(new Request('https://synthetic.invalid/api/mobile/practices',{method:'PATCH',body:'{}'}))).status).toBe(401);expect(s.service).not.toHaveBeenCalled()})
it('rejects malformed JSON without obtaining a service client',async()=>{s.allowed=true;expect((await PATCH(new Request('https://synthetic.invalid/api/mobile/practices',{method:'PATCH',body:'{'}))).status).toBe(400);expect(s.service).not.toHaveBeenCalled()})
it('passes exact scope and event recovery through and makes responses private',async()=>{s.allowed=true;s.load.mockResolvedValue({ok:true,status:200});const r=await GET(new Request('https://synthetic.invalid/api/mobile/practices?team=Aces&league=City&flight=4.0&eventId=exact'));expect(r.status).toBe(200);expect(s.load.mock.calls[0].slice(1)).toEqual(['owner',{teamName:'Aces',leagueName:'City',flight:'4.0'},'exact']);expect(r.headers.get('Cache-Control')).toBe('private, no-store')})
