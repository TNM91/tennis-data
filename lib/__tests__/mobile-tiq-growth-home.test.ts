import {expect,it} from 'vitest'
import type {GrowthSnapshot,GrowthSummary} from '../tiq-growth'
import {growthHomeHtml} from '../../mobile/src/tiq-growth-home'

const plan:GrowthSummary={version:1,id:'active',baseline:'private-assessment',sourceAssignment:null,state:'active',skill:'serve',target:'8 of 10 second serves in',sessions:3,completed:2,reviewDate:'2026-11-27',assessment:null,revision:'revision',createdAt:'2026-11-20T12:00:00Z',updatedAt:'2026-11-21T12:00:00Z'}
const snapshot:GrowthSnapshot={owner:'player',plans:[plan],selected:null,baseline:null,reassessment:null,more:false}
const ready=(change:Partial<GrowthSnapshot>={},pendingId:string|null=null,pendingUnavailable=false)=>({phase:'ready' as const,snapshot:{...snapshot,...change},pendingId,pendingUnavailable})

it('resumes the active plan from saved counts without exposing assessment references or inventing practice',()=>{
  const before=JSON.stringify(snapshot),output=growthHomeHtml(ready(),'2026-11-20')
  expect(output).toContain('8 of 10 second serves in');expect(output).toContain('2 / 3 practices');expect(output).toContain('Resume practice plan')
  expect(output).toContain('datetime="2026-11-27"');expect(output).not.toContain('private-assessment');expect(output).not.toContain('Review ready');expect(JSON.stringify(snapshot)).toBe(before)
})
it('marks a review as ready by date or count without claiming a TiQ improvement',()=>{
  for(const candidate of [plan,{...plan,completed:4}]){
    const output=growthHomeHtml(ready({plans:[candidate]}),candidate.completed===4?'2026-11-20':'2026-11-27')
    expect(output).toContain('Review ready');expect(output).toContain('Review practice plan');expect(output).not.toContain('TiQ increased')
    if(candidate.completed===4){expect(output).toContain('4 / 3 practices');expect(output).toContain('value="3"')}
  }
})
it('hides a confirmed empty or finished-only plan list and never substitutes an archived target',()=>{
  for(const plans of [[],[{...plan,state:'reviewed' as const}],[{...plan,state:'archived' as const}]])expect(growthHomeHtml(ready({plans}),'2026-11-20')).toBe('')
  const output=growthHomeHtml(ready({plans:[{...plan,id:'archived',state:'archived',target:'Old target'},plan]}),'2026-11-20')
  expect(output).toContain(plan.target);expect(output).not.toContain('Old target')
})
it('offers recovery for pending or unreadable device updates even when no active plan was read',()=>{
  const pending=growthHomeHtml(ready({plans:[]},'pending'),'2026-11-20'),corrupt=growthHomeHtml(ready({plans:[]},null,true),'2026-11-20')
  expect(pending).toContain('Confirm plan update');expect(pending).toContain('needs confirmation');expect(pending).not.toContain('0 /')
  expect(corrupt).toContain('Device retry details couldn’t load');expect(corrupt).toContain('Confirm plan update')
  expect(growthHomeHtml(ready({},plan.id),'2026-11-20')).toContain('Last confirmed · 2 / 3 practices')
  expect(growthHomeHtml(ready({},'older-plan'),'2026-11-20')).not.toContain(plan.target)
})
it('distinguishes failed and loading reads from an empty plan and escapes the saved target',()=>{
  expect(growthHomeHtml({phase:'unavailable'},'2026-11-20')).toContain('Retry plan');expect(growthHomeHtml({phase:'unavailable'},'2026-11-20')).toContain('couldn’t load')
  expect(growthHomeHtml({phase:'loading'},'2026-11-20')).toContain('Loading your saved plan');expect(growthHomeHtml({phase:'loading'},'2026-11-20')).not.toContain('data-plan-open')
  const output=growthHomeHtml(ready({plans:[{...plan,target:'<img src=x onerror=alert(1)>'}]}),'2026-11-20')
  expect(output).toContain('&lt;img');expect(output).not.toContain('<img')
})
