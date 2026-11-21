import {expect,it} from 'vitest'
import type {GrowthPlan} from '../tiq-growth'
import type {TrainingSession} from '../../mobile/src/level-up-data'
import {prepareGrowthPractice} from '../../mobile/src/tiq-practice-return'

const id=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0'),owner=id(1)
const plan:GrowthPlan={version:1,skill:'serve',target:'7 of 10 serves in',sessions:3,reviewDate:'2026-11-27',id:id(2),
  baseline:id(3),sourceAssignment:null,state:'active',logs:[],assessment:null,revision:id(4),createdAt:'2026-11-20T12:00:00Z',updatedAt:'2026-11-20T12:00:00Z'}
const practice:TrainingSession={id:'level-up-'+id(5),playerUserId:owner,focusId:'serve',focusTitle:'Serve',drillTitle:'Serve Target Call',
  rating:3,note:'7/10 with a smooth second serve',elapsedSeconds:120,completedAt:'2026-11-20T12:30:00Z',context:'alone',feeling:'ready',
  accessMode:'player_plus',sharedWithCoach:false,workType:'court',cardId:'serve-target-call'}

it('prepares a reviewable log with a stable session identity without changing the plan',()=>{
  const before=JSON.stringify(plan),result=prepareGrowthPractice(owner,plan.id,plan,practice)
  expect(result).toMatchObject({state:'ready',session:{id:id(5),date:expect.stringMatching(/^2026-11-\d\d$/),note:practice.note},shortened:false})
  expect(prepareGrowthPractice(owner,plan.id,plan,practice)).toEqual(result);expect(JSON.stringify(plan)).toBe(before)
})

it('does not copy a note from another account, plan, drill, or a practice before the plan',()=>{
  for(const row of [{...practice,playerUserId:id(6)},{...practice,cardId:'wall-rally-rhythm'},{...practice,completedAt:'2026-11-19T12:00:00Z'},
    {...practice,completedAt:'invalid'},{...practice,id:'unrecognized-session'}]){
    expect(prepareGrowthPractice(owner,plan.id,plan,row)).toEqual({state:'unavailable'})
  }
  expect(prepareGrowthPractice(owner,id(9),plan,practice)).toEqual({state:'unavailable'})
  expect(prepareGrowthPractice(owner,plan.id,null,practice)).toEqual({state:'unavailable'})
})

it('rejects closed or full plans and identifies a practice already logged after a fresh read',()=>{
  for(const state of ['reviewed','archived'] as const)expect(prepareGrowthPractice(owner,plan.id,{...plan,state},practice)).toEqual({state:'unavailable'})
  const log={id:id(5),date:'2026-11-20',note:practice.note}
  expect(prepareGrowthPractice(owner,plan.id,{...plan,logs:[log]},practice)).toEqual({state:'already-logged'})
  expect(prepareGrowthPractice(owner,plan.id,{...plan,logs:Array.from({length:24},(_,n)=>({...log,id:id(20+n)}))},practice)).toEqual({state:'unavailable'})
})

it('bounds a long training note without cutting an emoji and provides a clear empty-note default',()=>{
  const result=prepareGrowthPractice(owner,plan.id,plan,{...practice,note:'a'.repeat(159)+'🎾'})
  expect(result).toMatchObject({state:'ready',shortened:true,session:{note:'a'.repeat(159)}})
  expect(prepareGrowthPractice(owner,plan.id,plan,{...practice,note:'  '})).toMatchObject({state:'ready',shortened:false,session:{note:'Serve Target Call completed.'}})
})
