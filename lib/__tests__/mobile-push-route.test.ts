import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
const state=vi.hoisted(()=>({user:'verified-owner' as string|null,available:false,rpc:vi.fn()}))
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:state.user?{id:state.user}:null},error:null})},rpc:state.rpc})}))
vi.mock('../native-chat-push-server',()=>({nativePushConfigured:()=>state.available}))
import {GET,POST} from '../../app/api/mobile/push/route'
const headers={Authorization:'Bearer test-bearer','Content-Type':'application/json'},device={installationId:'e9adacbd-f9ba-4da1-b99d-601cf5abc8bc',secret:'a'.repeat(64),token:'b'.repeat(64),enabled:true,userId:'untrusted-owner'}
beforeEach(()=>{state.user='verified-owner';state.available=false;state.rpc.mockReset().mockResolvedValue({data:true,error:null});vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','fixture-service-key')})
afterEach(()=>vi.unstubAllEnvs())
describe('native push bearer API',()=>{
 it('requires a verified session for reads and writes',async()=>{
  expect((await GET(new Request('https://local/api/mobile/push'))).status).toBe(401)
  state.user=null;expect((await POST(new Request('https://local/api/mobile/push',{method:'POST',headers,body:JSON.stringify(device)}))).status).toBe(401)
  expect(state.rpc).not.toHaveBeenCalled()
 })
 it('does not register when disabled, while keeping revocation available',async()=>{
  const get=await GET(new Request('https://local/api/mobile/push',{headers}));expect(await get.json()).toEqual({ok:true,available:false});expect(get.headers.get('cache-control')).toBe('private, no-store')
  expect((await POST(new Request('https://local/api/mobile/push',{method:'POST',headers,body:JSON.stringify(device)}))).status).toBe(503)
  expect(state.rpc).not.toHaveBeenCalled()
  expect((await POST(new Request('https://local/api/mobile/push',{method:'POST',headers,body:JSON.stringify({...device,enabled:false})}))).status).toBe(200)
  expect(state.rpc.mock.calls[0][1]).toMatchObject({p_profile:'verified-owner',p_enabled:false})
 })
 it('rejects oversized, malformed and invalid device requests without touching storage',async()=>{
  state.available=true
  for(const body of ['{','x'.repeat(2049),JSON.stringify({...device,secret:'invalid'})])expect((await POST(new Request('https://local/api/mobile/push',{method:'POST',headers,body}))).status).toBeGreaterThanOrEqual(400)
  expect(state.rpc).not.toHaveBeenCalled()
 })
})
