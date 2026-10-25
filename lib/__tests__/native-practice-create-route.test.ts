import {beforeEach,it,expect,vi} from 'vitest'
const state=vi.hoisted(()=>({allowed:false,service:vi.fn(),act:vi.fn()}))
vi.mock('@/lib/captain-api-auth',()=>({getCaptainApiAuth:async()=>state.allowed?{ok:true,userId:'owner'}:{ok:false,response:Response.json({ok:false},{status:401})}}))
vi.mock('@/lib/captain-availability-request-server',()=>({getCaptainAvailabilityServiceClient:state.service}))
vi.mock('@/lib/native-practice-create',()=>({nativePracticeCreate:state.act}))
import {GET,POST} from '../../app/api/mobile/captain/practices/create/route'
beforeEach(()=>{state.allowed=false;vi.clearAllMocks()})
it('authenticates preview and creation before touching the private database',async()=>{expect((await GET(new Request('https://synthetic.invalid'))).status).toBe(401);expect((await POST(new Request('https://synthetic.invalid',{method:'POST',body:'{}'}))).status).toBe(401);expect(state.service).not.toHaveBeenCalled();expect(state.act).not.toHaveBeenCalled()})
it('rejects malformed authenticated create bodies without a database client',async()=>{state.allowed=true;for(const body of ['null','[]','4','{'])expect((await POST(new Request('https://synthetic.invalid',{method:'POST',body}))).status).toBe(400);expect(state.service).not.toHaveBeenCalled()})
