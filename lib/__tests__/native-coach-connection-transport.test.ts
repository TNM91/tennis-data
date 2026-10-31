import {it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {CoachSend} from '../../mobile/src/coach-workspace-data'
import {coachConnectionRequest} from '../../mobile/src/coach-connection-data'
const owner='player',intent={action:'preview' as const,token:'invite-token'}
const account=()=>({auth:{getSession:vi.fn(async()=>({data:{session:{user:{id:owner},access_token:'synthetic'}},error:null}))}} as unknown as SupabaseClient)
const reply={status:200,headers:{},url:'https://www.tenaceiq.com/api/mobile/coach/connection',data:{ok:true,owner,name:'Alex',level:'4.0',message:'Welcome',expiresAt:null,state:'ready',revision:'a'.repeat(64)}}
it('keeps invitation tokens in a bounded authenticated body, never a URL',async()=>{
 const send=vi.fn<CoachSend>().mockResolvedValue(reply)
 await coachConnectionRequest(account(),owner,()=>true,intent,send)
 expect(send).toHaveBeenCalledExactlyOnceWith('POST',expect.objectContaining({url:reply.url,data:intent,disableRedirects:true,readTimeout:30000,headers:expect.objectContaining({Authorization:'Bearer synthetic','Cache-Control':'no-store'})}))
})
it('never retries uncertain acceptance and rejects late or foreign account responses',async()=>{
 const send=vi.fn<CoachSend>().mockRejectedValueOnce(Error('Lost'))
 await expect(coachConnectionRequest(account(),owner,()=>true,{action:'accept',token:intent.token,revision:'a'.repeat(64)},send)).rejects.toThrow('Lost');expect(send).toHaveBeenCalledTimes(1)
 let active=true;send.mockImplementation(async()=>{active=false;return reply})
 await expect(coachConnectionRequest(account(),owner,()=>active,intent,send)).rejects.toThrow()
 send.mockResolvedValue({...reply,data:{...reply.data,owner:'other'}});await expect(coachConnectionRequest(account(),owner,()=>true,intent,send)).rejects.toThrow()
})
