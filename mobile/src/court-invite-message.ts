import {formatCalendarDay,isValidCalendarDate} from '../../lib/calendar-date'
import {hittingPlanConfirmed,hittingPlanStart,hittingPlanTimeZone,type HittingPlan} from '../../lib/hitting-plan'
import type {ExploreCourt} from './explore-court-catalog'
import {courtDirections} from './explore-court-directions'

const courtTimeFormat=new Intl.DateTimeFormat('en-US',{timeZone:hittingPlanTimeZone,hour:'numeric',minute:'2-digit',timeZoneName:'short'})

function courtSchedule(schedule:{date:string;time:string}){
 const date=isValidCalendarDate(schedule.date)?formatCalendarDay(schedule.date):''
 const start=date&&schedule.time?hittingPlanStart(schedule):null
 const when=date?` on ${date}${start?' at '+courtTimeFormat.format(start):''}`:''
 return {when,start}
}

export function courtInviteMessage(court:ExploreCourt,schedule:{date:string;time:string;hittingPlan?:HittingPlan}){
 const {when,start}=courtSchedule(schedule)
 const body=start&&hittingPlanConfirmed(schedule)
  ?`Tennis at ${court.name}${when}.`
  :`Want to hit at ${court.name}${when}?${start?'':' What time works for you?'}`
 const {apple,google}=courtDirections(court)
 return {body,directions:`Apple Maps: ${apple}\nGoogle Maps: ${google}`,start}
}

export function courtCancellationMessage(court:ExploreCourt,schedule:{date:string;time:string}){
 const {when,start}=courtSchedule(schedule)
 if(start)return `Our tennis hit at ${court.name}${when} is canceled.`
}
