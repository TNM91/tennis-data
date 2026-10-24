import {beforeEach,describe,it,expect,vi} from 'vitest'
const {auth,service,load}=vi.hoisted(()=>({auth:vi.fn(),service:vi.fn(),load:vi.fn()}))
vi.mock('@/lib/captain-api-auth',()=>({getCaptainApiAuth:auth}))
vi.mock('@/lib/captain-availability-request-server',()=>({getCaptainAvailabilityServiceClient:service}))
vi.mock('@/lib/native-captain-workspace',()=>({loadNativeCaptainWorkspace:load}))
import {GET} from '../../app/api/mobile/captain/route'
beforeEach(()=>{auth.mockReset();service.mockReset().mockReturnValue('service');load.mockReset()})
describe('native Captain API entitlement boundary',()=>{
 it('returns account denial before constructing a service client or reading team data',async()=>{
  for(const status of [401,403]){auth.mockResolvedValueOnce({ok:false,response:Response.json({ok:false},{status})});expect((await GET(new Request('https://local/api/mobile/captain?team=Aces'))).status).toBe(status)}
  expect(service).not.toHaveBeenCalled();expect(load).not.toHaveBeenCalled()
 })
 it('uses the verified owner and exact query scope with private no-store responses',async()=>{
  auth.mockResolvedValue({ok:true,userId:'verified-owner'});load.mockResolvedValue({ok:true,status:200,roster:[]})
  const response=await GET(new Request('https://local/api/mobile/captain?team=Aces&league=City&flight=4.0&userId=attacker'))
  expect(load).toHaveBeenCalledWith('service','verified-owner',{teamName:'Aces',leagueName:'City',flight:'4.0'});expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store')
 })
 it('keeps underlying errors out of the response',async()=>{
  auth.mockResolvedValue({ok:true,userId:'owner'});load.mockRejectedValue(Error('private service detail'))
  const response=await GET(new Request('https://local/api/mobile/captain'));expect(response.status).toBe(503);expect(await response.text()).not.toContain('private service detail')
 })
})
