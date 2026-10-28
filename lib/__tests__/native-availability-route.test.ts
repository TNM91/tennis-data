import {beforeEach,it,expect,vi} from 'vitest'
const m=vi.hoisted(()=>({auth:vi.fn(),load:vi.fn(),service:{}}))
vi.mock('../captain-api-auth',()=>({getCaptainApiAuth:m.auth}))
vi.mock('../captain-availability-request-server',()=>({getCaptainAvailabilityServiceClient:()=>m.service}))
vi.mock('../native-availability-requests',()=>({loadNativeAvailabilityReview:m.load}))
import {GET} from '../../app/api/mobile/captain/availability/route'
const url='https://www.tenaceiq.com/api/mobile/captain/availability?team=Aces&league=City&flight=4.0&fixture=11111111-1111-4111-8111-111111111111'
beforeEach(()=>{m.auth.mockReset().mockResolvedValue({ok:true,userId:'owner'});m.load.mockReset().mockResolvedValue({ok:true,review:{ok:true,owner:'owner'}})})
it('requires Captain account authentication before service reads',async()=>{m.auth.mockResolvedValue({ok:false,response:Response.json({ok:false},{status:403})});expect((await GET(new Request(url))).status).toBe(403);expect(m.load).not.toHaveBeenCalled()})
it('passes only explicit fixture/team scope and keeps the review private and uncached',async()=>{const r=await GET(new Request(url));expect(r.status).toBe(200);expect(r.headers.get('Cache-Control')).toBe('private, no-store');expect(r.headers.get('Referrer-Policy')).toBe('no-referrer');expect(m.load).toHaveBeenCalledWith(m.service,'owner',{teamName:'Aces',leagueName:'City',flight:'4.0'},'11111111-1111-4111-8111-111111111111')})
it('rejects named-room review and hides backend failure details',async()=>{expect((await GET(new Request(url+'&chatRoom=private'))).status).toBe(400);expect(m.load).not.toHaveBeenCalled();m.load.mockRejectedValue(Error('PRIVATE DATABASE FAILURE'));const r=await GET(new Request(url));expect(r.status).toBe(503);expect(await r.text()).not.toContain('PRIVATE')})
