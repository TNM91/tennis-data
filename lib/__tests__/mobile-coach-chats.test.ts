import {expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {CoachSend} from '../../mobile/src/coach-workspace-data'
import {loadCoachChatConnections,readCoachChatConnections} from '../../mobile/src/coach-chats-data'

const owner='11111111-1111-4111-8111-111111111111'
const payload=()=>({ok:true,owner,connections:[{id:'student-one',name:'Alex Rivera',role:'coach'}],more:false})
const client=(who=owner)=>({auth:{getSession:async()=>({data:{session:{user:{id:who},access_token:'synthetic-token'}},error:null})}} as SupabaseClient)
it('reads only bounded, distinct, owned connections and projects the public fields',()=>{
 expect(readCoachChatConnections({...payload(),connections:[{...payload().connections[0],email:'private'}]},owner)).toEqual({connections:payload().connections,more:false})
 for(const value of [{...payload(),owner:'foreign'},{...payload(),connections:Array(101).fill(payload().connections[0])},{...payload(),connections:[payload().connections[0],payload().connections[0]]},{...payload(),more:'yes'},{...payload(),connections:[{id:'../other',name:'Alex',role:'coach'}]},{...payload(),connections:[{id:'one',name:'Alex',role:'admin'}]},{...payload(),connections:[{id:'one',name:'',role:'player'}]}])expect(()=>readCoachChatConnections(value,owner)).toThrow()
})
it('keeps empty, bounded partial results and unavailable results distinct',()=>{
 expect(readCoachChatConnections({...payload(),connections:[]},owner).connections).toEqual([])
 expect(readCoachChatConnections({...payload(),more:true},owner).more).toBe(true)
 expect(()=>readCoachChatConnections({ok:false,owner,connections:[],more:false},owner)).toThrow()
})
it('uses one fixed private GET without redirects, writes or message prefetch',async()=>{
 const send=vi.fn<CoachSend>(async()=>({status:200,data:payload(),headers:{},url:''}))
 expect((await loadCoachChatConnections(client(),owner,()=>true,send)).connections).toHaveLength(1)
 expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0]).toMatchObject(['GET',{url:'https://www.tenaceiq.com/api/mobile/coach/messages',disableRedirects:true,readTimeout:30000,headers:{Authorization:'Bearer synthetic-token','Cache-Control':'no-store'}}])
 expect(send.mock.calls[0][1]).not.toHaveProperty('data')
})
it('blocks access before a request when the account changed',async()=>{
 const send=vi.fn<CoachSend>();await expect(loadCoachChatConnections(client('other'),owner,()=>true,send)).rejects.toThrow();expect(send).not.toHaveBeenCalled()
})
it('discards a late response after the owner or parent view changed',async()=>{
 let active=true
 const send:CoachSend=async()=>{active=false;return {status:200,data:payload(),headers:{},url:''}}
 await expect(loadCoachChatConnections(client(),owner,()=>active,send)).rejects.toThrow()
})
it('surfaces a failed service or mismatched owner without treating it as no connections',async()=>{
 for(const [status,data] of [[503,payload()],[200,{...payload(),owner:'other'}]] as const){
  await expect(loadCoachChatConnections(client(),owner,()=>true,async()=>({status,data,headers:{},url:''}))).rejects.toThrow()
 }
})
