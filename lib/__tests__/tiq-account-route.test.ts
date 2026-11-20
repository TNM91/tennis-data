import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {GET,POST} from '../../app/api/mobile/first-party/tiq/route'
const mocks=vi.hoisted(()=>({account:vi.fn(),coach:vi.fn(),rpc:vi.fn()}))
vi.mock('../mobile-account-auth',async original=>({...await original<typeof import('../mobile-account-auth')>(),verifiedAccount:mocks.account,accountClient:()=>({rpc:mocks.rpc})}))
vi.mock('../coach-api-auth',()=>({getCoachApiAuth:mocks.coach}))
const owner='11111111-1111-4111-8111-111111111111',coach='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333'
const endpoint='https://example.test/api/mobile/first-party/tiq'
const answers={serve:2,return:2,rally:2,movement:2,net:2,points:2}
const write={kind:'save',id,date:'2026-11-19',answers,version:1,expectedHead:null}
const page={ok:true,owner,student:null,head:null,items:[],next:null,coaches:[],moreCoaches:false,shares:[]}
const post=(body:unknown)=>new Request(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic')
  mocks.account.mockReset().mockResolvedValue({user:{id:owner}})
  mocks.coach.mockReset().mockResolvedValue({ok:true,userId:coach})
  mocks.rpc.mockReset().mockResolvedValue({data:page,error:null})
})
afterEach(()=>vi.unstubAllEnvs())
it('allows verified free players to read only their own private history without cache reuse',async()=>{
  const response=await GET(new Request(endpoint))
  expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toMatchObject({...page,releaseScope:'first-party'})
  expect(mocks.rpc).toHaveBeenCalledWith('native_tiq_assessment_history',{p_owner:owner,p_cursor:null,p_student:null})
  expect(mocks.coach).not.toHaveBeenCalled()
})
it('rejects injected owners, duplicate queries and malformed cursors before private reads',async()=>{
  for(const query of ['?owner='+coach,'?student=one&student=two','?cursor=%7B%7D','?cursor='+encodeURIComponent('x'.repeat(401))]) expect((await GET(new Request(endpoint+query))).status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('requires current coach access and returns only the selected authorized student scope',async()=>{
  mocks.coach.mockResolvedValueOnce({ok:false,response:new Response(null,{status:403})})
  expect((await GET(new Request(endpoint+'?student=student-one'))).status).toBe(403)
  mocks.rpc.mockResolvedValueOnce({data:{...page,owner:coach,student:'student-one'},error:null})
  expect((await GET(new Request(endpoint+'?student=student-one'))).status).toBe(200)
  expect(mocks.rpc).toHaveBeenLastCalledWith('native_tiq_assessment_history',{p_owner:coach,p_student:'student-one',p_cursor:null})
})
it('binds writes to verified identity and preserves explicit retry identifiers and conflict statuses',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:200,error:null}).mockResolvedValueOnce({data:409,error:null})
  expect((await POST(post(write))).status).toBe(200)
  expect(mocks.rpc).toHaveBeenCalledWith('write_native_tiq_assessment',{p_owner:owner,p_write:write})
  expect((await POST(post(write))).status).toBe(409)
})
it('rejects malformed writes and unsigned callers without modifying data',async()=>{
  expect((await POST(post({...write,owner:coach}))).status).toBe(400)
  expect((await POST(post({...write,answers:{...answers,serve:99}}))).status).toBe(400)
  mocks.account.mockResolvedValueOnce(null)
  expect((await POST(post(write))).status).toBe(401)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('withholds mis-scoped or failed backend data without exposing provider errors',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:{...page,owner:coach},error:null}).mockResolvedValueOnce({data:null,error:{message:'private provider details'}})
  expect((await GET(new Request(endpoint))).status).toBe(503)
  const response=await GET(new Request(endpoint));expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('provider details')
})
