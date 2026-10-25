import {buildPracticeCalendarRange,buildPracticeGoogleCalendarHref} from './captain-practice-rsvp'
import {validPracticeRsvpPath,type PracticeShare} from './native-practice-share-contract'

/** One occurrence only. Calendar providers choose the local timezone; no subscription or RSVP write. */
export function practiceCalendarPreview(share:PracticeShare,teamName:string){
 const p=share.practice
 if(!validPracticeRsvpPath(share.rsvpPath)||!['proposed','confirmed'].includes(p.status))return null
 const range=buildPracticeCalendarRange(p.date,p.time,p.endTime)
 if(!range)return null
 // The shared calendar builders use a 90-minute fallback, capped at 23:59.
 const endTime=range.end.slice(9,11)+':'+range.end.slice(11,13)
 if(p.endTime&&p.endTime!==endTime)return null
 const input={teamName,scheduledDate:p.date,scheduledTime:p.time,scheduledEndTime:p.endTime,facility:p.facility,notes:p.focus}
 return {endTime,estimatedEnd:!p.endTime,icsUrl:'https://www.tenaceiq.com/api/practice/'+share.rsvpPath.split('/')[2]+'/calendar.ics',googleUrl:buildPracticeGoogleCalendarHref(input)}
}
