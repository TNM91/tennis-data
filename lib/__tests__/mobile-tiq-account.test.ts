import {afterEach,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {deviceTiqId, loadTiqAccount, writeTiqAccount, rememberPendingTiq, readPendingTiq, clearPendingTiq} from '../../mobile/src/tiq-account-data'
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222'
const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic'}},error:null})}} as unknown as SupabaseClient
const answers={serve:2,return:2,rally:2,movement:2,net:2,points:2} as const
const write={kind:'save',id,date:'2026-11-19',answers,version:1,expectedHead:null} as const
const page={ok:true,owner,student:null,head:null,items:[],next:null,coaches:[],moreCoaches:false,shares:[],releaseScope:'first-party'}
const http=(data:unknown)=>({status:200,data,headers:{},url:'https://example.test'})
afterEach(()=>vi.unstubAllGlobals())
it('uses a bounded authenticated first-party read and discards a late reply after an account change',async()=>{
  let active=true
  const send=vi.fn(async()=>http(page))
  expect((await loadTiqAccount(client,owner,()=>active,{},send)).items).toEqual([])
  expect(send.mock.calls[0]).toBeDefined()
  await expect(loadTiqAccount(client,owner,()=>active,{},async()=>{active=false;return http(page)})).rejects.toThrow()
})
it('rejects another owner or build scope and reuses the exact save operation on retry',async()=>{
  await expect(loadTiqAccount(client,owner,()=>true,{},async()=>http({...page,owner:id}))).rejects.toThrow()
  await expect(loadTiqAccount(client,owner,()=>true,{},async()=>http({...page,releaseScope:'integrated'}))).rejects.toThrow()
  const send=vi.fn(async()=>http({ok:true,owner,id,releaseScope:'first-party'}))
  await writeTiqAccount(client,owner,()=>true,write,send);await writeTiqAccount(client,owner,()=>true,write,send)
  expect(send.mock.calls[0]).toEqual(send.mock.calls[1])
})
it('keeps uncertain save answers owner-scoped across relaunches and refuses unreadable pending state',async()=>{
  const records=new Map<string,string>()
  vi.stubGlobal('localStorage',{getItem:(key:string)=>records.get(key)??null,setItem:(key:string,value:string)=>records.set(key,value),removeItem:(key:string)=>records.delete(key)})
  await rememberPendingTiq(owner,write)
  expect(await readPendingTiq(owner)).toEqual(write);expect(await readPendingTiq(id)).toBeNull()
  await clearPendingTiq(owner);expect(await readPendingTiq(owner)).toBeNull()
  records.set('tiq-account-pending:v1:'+owner,'corrupted')
  await expect(readPendingTiq(owner)).rejects.toThrow()
})
it('gives the same legacy device assessment a stable import identity across key order and devices',async()=>{
  const first=await deviceTiqId(owner,write.date,answers)
  expect(await deviceTiqId(owner,write.date,{...answers,serve:2})).toBe(first)
  expect(await deviceTiqId(owner,write.date,Object.fromEntries(Object.entries(answers).reverse()))).toBe(first)
  expect(await deviceTiqId(id,write.date,answers)).not.toBe(first)
})
