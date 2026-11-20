import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {GET,POST} from '../../app/api/mobile/first-party/tiq/plans/route'
import {GET as overview} from '../../app/api/mobile/coach/overview/route'
const mocks=vi.hoisted(()=>({account:vi.fn(),coach:vi.fn(),rpc:vi.fn()}))
vi.mock('../mobile-account-auth',async original=>({...await original<typeof import('../mobile-account-auth')>(),verifiedAccount:mocks.account,accountClient:()=>({rpc:mocks.rpc})}))
vi.mock('../coach-api-auth',()=>({getCoachApiAuth:mocks.coach}))
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const endpoint='https://synthetic.test/api/mobile/first-party/tiq/plans'
const page={ok:true,owner,plans:[],selected:null,baseline:null,reassessment:null,more:false}
const write={kind:'new',id,operation:id,expected:null,baseline:id,block:{version:1,skill:'serve',target:'7/10 second serves in',sessions:3,reviewDate:'2026-11-27'},sourceAssignment:null}
const post=(body:unknown)=>new Request(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
beforeEach(()=>{vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic');mocks.account.mockReset().mockResolvedValue({user:{id:owner}});mocks.coach.mockReset().mockResolvedValue({ok:true,userId:owner});mocks.rpc.mockReset().mockResolvedValue({data:page,error:null})})
afterEach(()=>vi.unstubAllEnvs())
it('keeps verified free-player reads owner-bound and uncached',async()=>{
  const response=await GET(new Request(endpoint));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(await response.json()).toMatchObject({...page,releaseScope:'first-party'})
  expect(mocks.rpc).toHaveBeenCalledWith('native_tiq_growth_read',{p_owner:owner,p_id:null});expect(mocks.coach).not.toHaveBeenCalled()
})
it('rejects injected owners, duplicate ids and unverified writes before touching storage',async()=>{
  for(const query of ['?owner='+other,'?id='+id+'&id='+id,'?id=bad'])expect((await GET(new Request(endpoint+query))).status).toBe(400)
  expect((await POST(post({...write,owner:other}))).status).toBe(400);mocks.account.mockResolvedValue(null);expect((await POST(post(write))).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled()
})
it('preserves operation receipts and explicit conflict responses',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:200,error:null}).mockResolvedValueOnce({data:409,error:null})
  const response=await POST(post(write));expect(await response.json()).toMatchObject({owner,id,operation:id});expect(mocks.rpc).toHaveBeenCalledWith('write_native_tiq_growth',{p_owner:owner,p_write:write});expect((await POST(post(write))).status).toBe(409)
})
it('withholds wrong-owner data and requires current Pro coaching access for roster attention',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:{...page,owner:other},error:null});expect((await GET(new Request(endpoint))).status).toBe(503)
  mocks.coach.mockResolvedValueOnce({ok:false,response:new Response(null,{status:403})});expect((await overview(new Request(endpoint+'?day=2026-11-20'))).status).toBe(403)
  expect((await overview(new Request(endpoint+'?day=2026-11-20&owner='+other))).status).toBe(400)
})
