import {beforeEach,describe,it,expect,vi} from 'vitest'
const {auth,service,load,save}=vi.hoisted(()=>({auth:vi.fn(),service:vi.fn(),load:vi.fn(),save:vi.fn()}))
vi.mock('@/lib/captain-api-auth',()=>({getCaptainApiAuth:auth}))
vi.mock('@/lib/captain-availability-request-server',()=>({getCaptainAvailabilityServiceClient:service}))
vi.mock('@/lib/native-captain-lineup',()=>({loadNativeLineup:load,saveNativeLineup:save}))
import {GET,PUT} from '../../app/api/mobile/captain/lineup/route'
beforeEach(()=>{vi.resetAllMocks();service.mockReturnValue('service');auth.mockResolvedValue({ok:true,userId:'owner'})})
describe('native lineup API',()=>{
 it('enforces account entitlement before parsing writes or constructing privileged clients',async()=>{for(const handler of [GET,PUT]){auth.mockResolvedValueOnce({ok:false,response:Response.json({ok:false},{status:403})});expect((await handler(new Request('https://local/api/mobile/captain/lineup'))).status).toBe(403)}expect(service).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled()})
 it('uses verified owner and exact scope, returns private no-store and bounds writes',async()=>{save.mockResolvedValue({ok:true,status:200,updatedAt:'now'});const response=await PUT(new Request('https://local/api/mobile/captain/lineup?team=Aces&league=City&flight=4.0',{method:'PUT',body:JSON.stringify({userId:'attacker',matchId:'m'})}));expect(save).toHaveBeenCalledWith('service','owner',{teamName:'Aces',leagueName:'City',flight:'4.0'},expect.objectContaining({matchId:'m'}));expect(response.headers.get('cache-control')).toBe('private, no-store');expect((await PUT(new Request('https://local/',{method:'PUT',body:'x'.repeat(40001)}))).status).toBe(413)})
 it('redacts unexpected service failures',async()=>{load.mockRejectedValue(Error('private database detail'));const response=await GET(new Request('https://local/'));expect(response.status).toBe(503);expect(await response.text()).not.toContain('database detail')})
})
