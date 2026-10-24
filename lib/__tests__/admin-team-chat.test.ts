import {beforeEach,describe,it,expect,vi} from 'vitest'
const auth=vi.hoisted(()=>({get:vi.fn()}))
vi.mock('../admin-api-auth',()=>({getAdminApiAuth:auth.get}))
import {GET,POST} from '../../app/api/admin/team-chat/route'
const id='1959be10-4557-4a03-87bd-584ba14ff519'
function database(){
 const calls:{table:string;method:string;args:unknown[]}[]=[]
 const service={from:(table:string)=>{
  const q:Record<string,unknown>={then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(resolve({data:[],error:null}))}
  for(const method of ['select','eq','order','limit','update'])q[method]=(...args:unknown[])=>{calls.push({table,method,args});return q}
  q.maybeSingle=vi.fn().mockResolvedValue({data:{id,message_id:'reported-post',conversation_id:'verified-room',reported_user_id:'reported-member'},error:null})
  return q
 }}
 return {service,calls}
}
beforeEach(()=>auth.get.mockReset())
describe('admin team-chat report review',()=>{
 it('denies both reads and writes before touching private report data',async()=>{
  auth.get.mockResolvedValue({ok:false,response:Response.json({ok:false},{status:403})})
  expect((await GET(new Request('https://app.invalid/api/admin/team-chat'))).status).toBe(403)
  expect((await POST(new Request('https://app.invalid/api/admin/team-chat',{method:'POST',body:'{}'}))).status).toBe(403)
 })
 it('bounds the open queue and prevents caching private message snapshots',async()=>{
  const db=database();auth.get.mockResolvedValue({ok:true,userId:'admin',service:db.service})
  const response=await GET(new Request('https://app.invalid/api/admin/team-chat'))
  expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toContain('no-store')
  expect(db.calls).toContainEqual({table:'team_chat_reports',method:'limit',args:[50]})
  expect(db.calls).toContainEqual({table:'team_chat_reports',method:'eq',args:['status','open']})
 })
 it('derives the removed post scope from the stored report and records the reviewer',async()=>{
  const db=database();auth.get.mockResolvedValue({ok:true,userId:'admin',service:db.service})
  const response=await POST(new Request('https://app.invalid/api/admin/team-chat',{method:'POST',body:JSON.stringify({id,action:'remove',message_id:'untrusted',conversation_id:'untrusted'})}))
  expect(response.status).toBe(200)
  for(const [column,value] of [['id','reported-post'],['conversation_id','verified-room'],['sender_user_id','reported-member']])expect(db.calls).toContainEqual({table:'internal_messages',method:'eq',args:[column,value]})
  expect(db.calls.find(call=>call.table==='team_chat_reports'&&call.method==='update')?.args[0]).toMatchObject({status:'resolved',reviewed_by:'admin'})
  expect(JSON.stringify(db.calls)).not.toContain('untrusted')
 })
 it('resolves without removing a post when the moderator chooses that action',async()=>{
  const db=database();auth.get.mockResolvedValue({ok:true,userId:'admin',service:db.service})
  expect((await POST(new Request('https://app.invalid/api/admin/team-chat',{method:'POST',body:JSON.stringify({id,action:'resolve'})}))).status).toBe(200)
  expect(db.calls.some(call=>call.table==='internal_messages')).toBe(false)
 })
})
