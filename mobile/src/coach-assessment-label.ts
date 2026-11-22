import {chatTimestamp} from '../../lib/chat-timestamp'
import {assessmentContexts, type CoachAssessment} from '../../lib/native-coach-assessment-contract'

// Observation instants use the viewer's local date. Number only the authorized,
// loaded records, preserving Postgres microseconds and stable equal-time ties.
export function coachAssessmentChoiceLabel(entry:CoachAssessment,rows:readonly CoachAssessment[]){
  const date=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'})
  const day=date.format(new Date(entry.createdAt))
  const sameDay=rows.filter(row=>date.format(new Date(row.createdAt))===day).sort((a,b)=>{
    const left=chatTimestamp(a.createdAt)!,right=chatTimestamp(b.createdAt)!
    return left<right?-1:left>right?1:a.id.localeCompare(b.id)
  })
  const position=sameDay.findIndex(row=>row.id===entry.id)
  const numbered=sameDay.length>1&&position>=0?` · ${position+1} of ${sameDay.length}`:''
  return `${day}${numbered} · ${entry.coach} · ${assessmentContexts[entry.observation.context]}`
}
