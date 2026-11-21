import {expect, it} from 'vitest'
import type {GrowthPlan} from '../tiq-growth'
import type {TiqAssessment, TiqAnswer} from '../tiq-self-assessment'
import {growthNextStep, growthReviewChoices, growthReviewHtml} from '../../mobile/src/tiq-growth-review'

const id=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0')
const assessment=(n:number,serve:TiqAnswer,date='2026-11-20',createdAt='2026-11-20T13:00:00Z'):TiqAssessment=>({
  id:id(n),date,createdAt,version:1,answers:{serve,return:1,rally:2,movement:2,net:1,points:2},
})
const baseline=assessment(1,1,'2026-11-19','2026-11-19T12:00:00Z')
const plan:GrowthPlan={version:1,skill:'serve',target:'7 of 10 second serves in',sessions:3,reviewDate:'2026-11-27',
  id:id(2),baseline:baseline.id,sourceAssignment:null,state:'active',logs:[],assessment:null,revision:id(3),
  createdAt:'2026-11-20T12:00:00Z',updatedAt:'2026-11-20T12:00:00Z'}

it('excludes the baseline, pre-plan saves and backdated assessments, then chooses the latest eligible date',()=>{
  const recent=assessment(4,3),later=assessment(5,2,'2026-11-21'),backdated=assessment(6,1,'2026-11-18')
  const tooEarly=assessment(7,3,'2026-11-21',plan.createdAt)
  expect(growthReviewChoices(plan,baseline,[recent,backdated,baseline,later,tooEarly]).map(row=>row.id)).toEqual([later.id,recent.id])
  expect(growthReviewChoices(plan,null,[backdated]).map(row=>row.id)).toEqual([backdated.id])
})

it('guides practice and logging without claiming a practice was completed',()=>{
  expect(growthNextStep(plan,[],'2026-11-20')?.action).toBe('drill')
  const logged={...plan,logs:[{id:id(4),date:'2026-11-20',note:'7 in'}]}
  expect(growthNextStep(logged,[],'2026-11-20')).toMatchObject({action:'log',copy:expect.stringContaining('1 of 3')})
  expect(growthNextStep(plan,[],'2026-11-27')).toMatchObject({action:'retake',title:'Your review date is here'})
  expect(growthNextStep({...logged,sessions:1},[],'2026-11-20')).toMatchObject({action:'retake',title:'Your planned practices are logged'})
})

it('offers a review preview only for an active plan and leaves rating changes to an assessment',()=>{
  expect(growthNextStep(plan,[assessment(4,3)],'2026-11-27')?.action).toBe('review')
  for(const state of ['reviewed','archived'] as const)expect(growthNextStep({...plan,state},[],'2026-11-28')).toBeNull()
})

it.each([[3,'Higher self-rating'],[1,'Same self-rating'],[0,'Lower self-rating']] as const)(
  'labels a %s review as a self-rating and includes its dated skill anchors', (serve,label)=>{
    const result=growthReviewHtml(plan,baseline,assessment(4,serve))
    expect(result).toContain(label);expect(result).toContain('Starting assessment');expect(result).toContain('Review assessment')
    expect(result).toContain('datetime="2026-11-19"');expect(result).toContain('datetime="2026-11-20"')
    expect(result).toContain('logging practice does not change your TiQ')
  })

it('withholds a directional comparison when either assessment was removed',()=>{
  for(const [before,after] of [[null,assessment(4,3)],[baseline,null],[null,null]] as const){
    const result=growthReviewHtml(plan,before,after)
    expect(result).toContain('Comparison unavailable');expect(result).toContain('Assessment removed or unavailable')
    expect(result).not.toContain('Higher self-rating');expect(result).not.toContain('Lower self-rating')
  }
})
