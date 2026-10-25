import {beforeEach,it,expect,vi} from 'vitest'
const s=vi.hoisted(()=>({auth:vi.fn(),service:vi.fn(),load:vi.fn()}))
vi.mock('../captain-api-auth',()=>({getCaptainApiAuth:s.auth}))
vi.mock('../captain-availability-request-server',()=>({getCaptainAvailabilityServiceClient:s.service}))
vi.mock('../native-opponent-scenarios',()=>({loadNativeOpponentScenarios:s.load}))
import {GET} from '../../app/api/mobile/captain/opponent-scenarios/route'
beforeEach(()=>{vi.clearAllMocks();s.auth.mockResolvedValue({ok:true,userId:'owner'});s.service.mockReturnValue('service');s.load.mockResolvedValue({ok:true,status:200})})
it('denies authentication before service access',async()=>{s.auth.mockResolvedValue({ok:false,response:new Response(null,{status:401})});expect((await GET(new Request('https://example.com'))).status).toBe(401);expect(s.service).not.toHaveBeenCalled()})
it('passes only explicit scope and match and prevents caching',async()=>{const r=await GET(new Request('https://example.com?team=A&league=L&flight=F&match=M'));expect(s.load).toHaveBeenCalledWith('service','owner',{teamName:'A',leagueName:'L',flight:'F'},'M');expect(r.headers.get('cache-control')).toBe('private, no-store')})
it('contains private errors',async()=>{s.load.mockRejectedValue(Error('secret'));const r=await GET(new Request('https://example.com'));expect(r.status).toBe(503);expect(await r.text()).not.toContain('secret')})
