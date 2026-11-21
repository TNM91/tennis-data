import type {GrowthPlan, GrowthSession} from '../../lib/tiq-growth'
import {tiqSkills} from '../../lib/tiq-assessment-skills'
import {tiqUuid} from '../../lib/tiq-self-assessment'
import type {TrainingSession} from './level-up-data'
import {growthDay} from './coach-growth-overview'

export type GrowthPracticeReturn = {state:'ready';session:GrowthSession;shortened:boolean}
  | {state:'already-logged'|'unavailable'}

export function prepareGrowthPractice(owner:string, expectedPlan:string, plan:GrowthPlan|null, practice:TrainingSession):GrowthPracticeReturn {
  const completed=new Date(practice.completedAt)
  if(!plan||plan.id!==expectedPlan||plan.state!=='active'||plan.logs.length>=24||practice.playerUserId!==owner
    ||practice.cardId!==tiqSkills.find(skill=>skill.id===plan.skill)?.drill.id||!Number.isFinite(completed.getTime())
    ||completed.getTime()<Date.parse(plan.createdAt))return {state:'unavailable'}
  let id:string
  try{id=tiqUuid(practice.id.replace(/^level-up-/,''))}catch{return {state:'unavailable'}}
  if(plan.logs.some(log=>log.id===id))return {state:'already-logged'}
  const original=practice.note.trim()||`${practice.drillTitle} completed.`
  const note=original.slice(0,160).replace(/[\uD800-\uDBFF]$/,'')
  return {state:'ready',session:{id,date:growthDay(completed),note},shortened:note.length<original.length}
}
