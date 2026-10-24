import {lineupRecord} from './native-captain-lineup-contract'
const str=(v:unknown)=>typeof v==='string'?v:''
export function replacementReminderRequestId(value:unknown){const notice=lineupRecord(value);return str(notice.publishedAnnouncementMessageId)||str(notice.notifiedAt)}
/** Old unbound schedules are safe only when the court has not changed since scheduling. */
export function replacementReminderIsCurrent(value:unknown,expectedRequestId:string,scheduledAt:string){
 const card=lineupRecord(value),notice=lineupRecord(card.lineupChangeNotice),current=replacementReminderRequestId(notice)
 if(card.cardType!=='projected_lineup'||card.matchCompletedAt||notice.pending!==false||notice.response||!current)return false
 if(expectedRequestId)return current===expectedRequestId
 const changed=Date.parse(str(card.lineupChangedAt)),scheduled=Date.parse(scheduledAt)
 return Number.isFinite(changed)&&Number.isFinite(scheduled)&&changed<=scheduled
}
