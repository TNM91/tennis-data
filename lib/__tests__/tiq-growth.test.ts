import {afterEach,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {growthReminderCalendar,readGrowthWrite,readPracticeBlock,type GrowthPlan} from '../tiq-growth'
import {loadGrowth,writeGrowth,pendingGrowth,rememberGrowth,clearGrowth} from '../../mobile/src/tiq-growth-data'
import {readCoachCreate} from '../native-coach-contract'
const owner='11111111-1111-4111-8111-111111111111',id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='22222222-2222-4222-8222-222222222222'
const block={version:1,skill:'serve',target:'7 of 10 second serves in',sessions:3,reviewDate:'2027-01-15'} as const
const write={kind:'new',id,operation:id,expected:null,baseline:id,block,sourceAssignment:null} as const
const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic'}},error:null})}} as unknown as SupabaseClient
const page={ok:true,owner,plans:[],selected:null,baseline:null,reassessment:null,more:false,releaseScope:'first-party'}
const http=(data:unknown)=>({status:200,data,headers:{},url:'https://synthetic.test'})
afterEach(()=>vi.unstubAllGlobals())
it('validates measurable targets, real dates, practice counts and strict action fields',()=>{
  expect(readPracticeBlock(block)).toEqual(block)
  for(const bad of [{...block,sessions:0},{...block,sessions:1.5},{...block,reviewDate:'2027-02-30'},{...block,target:''},{...block,score:10}])expect(()=>readPracticeBlock(bad)).toThrow()
  expect(()=>readGrowthWrite({...write,owner:other})).toThrow()
  expect(()=>readGrowthWrite({...write,expected:other})).toThrow()
})
it('requires a matching assigned coach drill and review date for a practice block',()=>{
  const request={kind:'assignment',id,student:'student-one',expectedUpdatedAt:'2026-11-20T12:00:00Z',title:'Serve block',focus:'Serve',dueDate:block.reviewDate,instructions:block.target,evidence:'Count serves in',status:'assigned',assessmentDrill:'serve',tiqGrowth:block}
  expect(readCoachCreate(request)).toMatchObject({tiqGrowth:block})
  for(const bad of [{...request,assessmentDrill:'return'},{...request,dueDate:null},{...request,status:'draft'}])expect(()=>readCoachCreate(bad)).toThrow()
})
it('discards late responses and rejects another owner, scope or operation receipt',async()=>{
  let active=true
  await expect(loadGrowth(client,owner,()=>active,null,async()=>{active=false;return http(page)})).rejects.toThrow()
  for(const data of [{...page,owner:other},{...page,releaseScope:'integrated'}])await expect(loadGrowth(client,owner,()=>true,null,async()=>http(data))).rejects.toThrow()
  await expect(writeGrowth(client,owner,()=>true,write,async()=>http({ok:true,owner,id,operation:other,releaseScope:'first-party'}))).rejects.toThrow()
})
it('persists the exact uncertain operation in owner-scoped storage across relaunches',async()=>{
  const records=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>records.get(key)??null,setItem:(key:string,value:string)=>records.set(key,value),removeItem:(key:string)=>records.delete(key)})
  await rememberGrowth(owner,write);expect(await pendingGrowth(owner)).toEqual(write);expect(await pendingGrowth(other)).toBeNull()
  const send=vi.fn(async()=>http({ok:true,owner,id,operation:id,releaseScope:'first-party'}));await writeGrowth(client,owner,()=>true,(await pendingGrowth(owner))!,send);await writeGrowth(client,owner,()=>true,write,send)
  expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);await clearGrowth(owner);expect(await pendingGrowth(owner)).toBeNull()
})
it('exports one stable calendar event with an optional alert and no assessment or practice notes',()=>{
  const plan:GrowthPlan={...block,id,baseline:id,sourceAssignment:null,state:'active',logs:[{id,date:'2026-11-20',note:'private practice note'}],assessment:null,revision:id,createdAt:'2026-11-20T12:00:00Z',updatedAt:'2026-11-20T12:00:00Z'}
  const first=growthReminderCalendar(plan,'18:00',owner,new Date('2026-11-20T13:00:00Z')),second=growthReminderCalendar(plan,'19:00',owner,new Date('2026-11-20T14:00:00Z'))
  const unfold=(s:string)=>s.replace(/\r\n /g,'')
  expect(unfold(first).match(/UID:.+/)?.[0]).toBe(unfold(second).match(/UID:.+/)?.[0]);expect(first).toContain('BEGIN:VALARM')
  expect(first).not.toContain('private practice note');expect(first).not.toContain(block.target)
  expect(first.split('\r\n').every(line=>line.length<=75)).toBe(true)
  expect(()=>growthReminderCalendar(plan,'25:00',owner)).toThrow()
})
