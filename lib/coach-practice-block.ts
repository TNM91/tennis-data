import type {CoachAssignment} from './coach-storage'
import type {NativeCoachStudent} from './native-coach-contract'
import {readPracticeBlock,type PracticeBlock} from './tiq-growth'
import {tiqSkills} from './tiq-assessment-skills'

export function coachPracticeBlock(assignment:CoachAssignment):PracticeBlock|null{
 try{const block=readPracticeBlock(assignment.assignment.tiqGrowth)
  return assignment.assignment.cardId===tiqSkills.find(skill=>skill.id===block.skill)?.drill.id?block:null
 }catch{return null}
}
export function editableCoachPracticeBlock(assignment:CoachAssignment,student:Pick<NativeCoachStudent,'linked'|'status'>):PracticeBlock|null{
 if(!student.linked||student.status==='paused'||assignment.status!=='assigned'||Object.hasOwn(assignment.assignment,'playerCheckIn')||Object.hasOwn(assignment.assignment,'coachReview'))return null
 return coachPracticeBlock(assignment)
}
