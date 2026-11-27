import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({owner:'verified-owner' as string|null,available:false,rpc:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:state.owner?{id:state.owner,email:'synthetic@example.test',email_confirmed_at:'2026-11-27'}:null},error:null})},rpc:state.rpc})}))
vi.mock('../android-push-server',()=>({androidPushConfiguration:()=>state.available?{}:null}))
import {GET,POST} from '../../app/api/mobile/first-party/android-alerts/route'
import {coachActivityHeader,coachActivityVersion} from '../coach-activity'
const headers={Authorization:'Bearer synthetic-bearer','Content-Type':'application/json',[coachActivityHeader]:coachActivityVersion}
const device={installationId:'11111111-1111-4111-8111-111111111111',secret:'a'.repeat(64),token:'CaseSensitive_Token:1234567890',enabled:true,profile:'forged-owner'}
const post=(body:unknown)=>new Request('https://local/api/mobile/first-party/android-alerts',{method:'POST',headers,body:typeof body==='string'?body:JSON.stringify(body)})
beforeEach(()=>{state.owner='verified-owner';state.available=false;state.rpc.mockReset().mockReturnValue({retry:async()=>({data:true,error:null})});vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-service-key')})
afterEach(()=>vi.unstubAllEnvs())
it('requires a remotely verified email account and returns private uncached capability checks',async()=>{
  expect((await GET(new Request('https://local/'))).status).toBe(401)
  const response=await GET(new Request('https://local/',{headers}))
  expect(await response.json()).toEqual({ok:true,available:false});expect(response.headers.get('cache-control')).toBe('private, no-store')
  state.owner=null;expect((await POST(post(device))).status).toBe(401);expect(state.rpc).not.toHaveBeenCalled()
})
it('keeps revocation available while inactive and binds only the bearer owner with a hashed installation secret',async()=>{
  expect((await POST(post(device))).status).toBe(503);expect(state.rpc).not.toHaveBeenCalled()
  expect((await POST(post({...device,enabled:false}))).status).toBe(200)
  state.available=true;expect((await POST(post(device))).status).toBe(200)
  expect(state.rpc.mock.calls.at(-1)).toEqual(['bind_native_android_activity_push',expect.objectContaining({
    p_profile:'verified-owner',p_token:device.token,p_enabled:true,p_coach_activity:true,p_secret_hash:expect.stringMatching(/^[a-f0-9]{64}$/),
  })]);expect(state.rpc.mock.calls.at(-1)?.[1].p_secret_hash).not.toBe(device.secret)
})
it('rejects malformed, oversized and unsupported registration tokens before storage',async()=>{
  state.available=true
  for(const body of ['{','x'.repeat(8193),{...device,token:device.token+'\n'},{...device,secret:'invalid'}])expect((await POST(post(body))).status).toBe(400)
  expect(state.rpc).not.toHaveBeenCalled()
})
