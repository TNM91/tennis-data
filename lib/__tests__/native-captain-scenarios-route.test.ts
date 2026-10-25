import {beforeEach,it,expect,vi} from 'vitest'
const s=vi.hoisted(()=>({allowed:false,service:vi.fn(),load:vi.fn()}))
vi.mock('@/lib/captain-api-auth',()=>({getCaptainApiAuth:async()=>s.allowed?{ok:true,userId:'owner'}:{ok:false,response:Response.json({ok:false},{status:401})}}))
vi.mock('@/lib/captain-availability-request-server',()=>({getCaptainAvailabilityServiceClient:s.service}))
vi.mock('@/lib/native-captain-scenarios',()=>({loadNativeCaptainScenarios:s.load}))
import {GET} from '../../app/api/mobile/captain/scenarios/route'
beforeEach(()=>{s.allowed=false;vi.clearAllMocks();s.load.mockResolvedValue({ok:true,status:200})})
it('requires Captain authentication before private service access',async()=>{expect((await GET(new Request('https://synthetic.invalid'))).status).toBe(401);expect(s.service).not.toHaveBeenCalled();expect(s.load).not.toHaveBeenCalled()})
it('passes only the explicit owner/scope/fixture and marks the read private',async()=>{s.allowed=true;const r=await GET(new Request('https://synthetic.invalid?team=Aces&league=City&flight=4.0&match=match'));expect(r.status).toBe(200);expect(r.headers.get('Cache-Control')).toBe('private, no-store');expect(r.headers.get('Referrer-Policy')).toBe('no-referrer');expect(s.load).toHaveBeenCalledWith(undefined,'owner',{teamName:'Aces',leagueName:'City',flight:'4.0'},'match')})
it('contains private failures without exposing server details',async()=>{s.allowed=true;s.load.mockRejectedValue(Error('private secret'));const r=await GET(new Request('https://synthetic.invalid'));expect(r.status).toBe(503);expect(await r.text()).not.toContain('private secret')})
