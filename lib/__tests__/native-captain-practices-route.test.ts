import {beforeEach,describe,it,expect,vi} from 'vitest'
const state=vi.hoisted(()=>({allowed:false,service:vi.fn(),load:vi.fn(),save:vi.fn(),cancel:vi.fn(),edit:vi.fn()}))
vi.mock('@/lib/captain-api-auth',()=>({getCaptainApiAuth:async()=>state.allowed?{ok:true,userId:'owner',supabase:{}}:{ok:false,response:Response.json({ok:false},{status:401})}}))
vi.mock('@/lib/captain-availability-request-server',()=>({getCaptainAvailabilityServiceClient:state.service}))
vi.mock('@/lib/native-captain-practices',()=>({loadNativeCaptainPractices:state.load,setNativePracticeConfirmation:state.save,cancelNativePractice:state.cancel,editNativePractice:state.edit}))
import {GET,PATCH} from '../../app/api/mobile/captain/practices/route'
beforeEach(()=>{state.allowed=false;vi.clearAllMocks()})
describe('native Captain practice route',()=>{
 it('authenticates read and confirmation before service access',async()=>{expect((await GET(new Request('https://synthetic.invalid/api/mobile/captain/practices'))).status).toBe(401);expect((await PATCH(new Request('https://synthetic.invalid/api/mobile/captain/practices',{method:'PATCH',body:'{}'}))).status).toBe(401);expect(state.service).not.toHaveBeenCalled();expect(state.load).not.toHaveBeenCalled();expect(state.save).not.toHaveBeenCalled()})
 it('routes explicit cancellation and exact recovery reads through Captain auth',async()=>{state.allowed=true;state.cancel.mockResolvedValue({ok:true,status:200});state.load.mockResolvedValue({ok:true,status:200});expect((await PATCH(new Request('https://synthetic.invalid/api/mobile/captain/practices',{method:'PATCH',body:JSON.stringify({action:'cancel_occurrence'})}))).status).toBe(200);expect(state.cancel).toHaveBeenCalledOnce();await GET(new Request('https://synthetic.invalid/api/mobile/captain/practices?eventId=exact'));expect(state.load.mock.calls[0][3]).toBe('exact')})
 it('rejects malformed confirmation bodies without obtaining a service client',async()=>{state.allowed=true;for(const value of ['null','[]','4','{'])expect((await PATCH(new Request('https://synthetic.invalid/api/mobile/captain/practices',{method:'PATCH',body:value}))).status).toBe(400);expect(state.service).not.toHaveBeenCalled()})
})
