import type {TeamMatchReplies} from '../../lib/team-match-replies-contract'
import {lineupConfirmationSummary} from './team-lineup-publication'
import {teamMatchReadiness,type ReadinessAction} from './team-match-readiness'
import type {TeamNextMatchSchedule} from './team-room-data'

export type CaptainMatchStatus={
 state:'details'|'unchecked'|'unpublished'|'review'|'confirmations'|'ready'
 label:string
 detail:string
 next?:ReadinessAction
 published:boolean
 confirmations:string
}

export function captainMatchStatus(schedule:TeamNextMatchSchedule|null,replies:TeamMatchReplies|null):CaptainMatchStatus{
 const shared=replies?.sharedLineup
 const summary=replies?lineupConfirmationSummary(replies):null
 const base={published:Boolean(shared),confirmations:!shared?'Not published':!summary?.checked?'Not checked':`${summary.confirmed} of ${summary.rows.length}`}
 const status=(state:CaptainMatchStatus['state'],label:string,detail:string,next?:ReadinessAction):CaptainMatchStatus=>({...base,state,label,detail,next})
 if(!schedule?.nextMatch||!schedule.revision)return status('unchecked','Recheck the match','Reload to check the latest match and captain access.',{key:'reload',label:'Recheck match readiness'})
 if(!schedule.nextMatch.time)return status('details','Set the start time','Give your teammates a clear time to play.',{key:'time',label:'Set the start time'})
 if(!schedule.nextMatch.facility)return status('details','Add the venue','Let your teammates know where to meet.',{key:'venue',label:'Add the venue'})
 if(!replies?.lineupRoster)return status('unchecked','Availability not checked','Reload before making court assignments.',{key:'reload',label:'Recheck availability'})
 const readiness=teamMatchReadiness(shared?.courts,replies)
 if(shared&&(!summary!.checked||summary!.unknown||!replies.rosterComplete||!summary!.rows.length))return status('unchecked','Recheck assignment responses','Some availability or confirmations could not be checked. Reload before following up.',{key:'reload',label:'Recheck match readiness'})
 if(shared&&(summary!.review||readiness.attention.length||readiness.open||readiness.duplicates))return status('review','Published lineup needs attention','Check the assigned players’ availability and change requests.',{key:'publication',label:'Review published assignments'})
 if(replies.savedLineup&&replies.savedLineup.version!==shared?.version)return status('unpublished',shared?'Private edits to review':'Lineup not published',shared?'Teammates still see the published assignments. Your private edits have not been shared.':'Your saved court assignments are private. Review and publish them when ready.',{key:'lineup',label:'Review private lineup'})
 if(!shared)return status('unpublished','Lineup not published','Plan the courts, then publish the assignments for your team.',
  replies.lineupRoster.some(player=>player.choice!=='out')?{key:'lineup',label:'Add court assignments'}:{key:'availability',label:'Review team availability'})
 if(summary!.awaiting)return status('confirmations','Waiting for confirmations',`${summary!.awaiting} ${summary!.awaiting===1?'assigned player still needs':'assigned players still need'} to confirm. Review the responses before drafting a reminder.`,{key:'publication',label:'Review confirmations'})
 return status('ready','Ready for match day','Time and venue set. All published players are In and confirmed.',{key:'publication',label:'Open published assignments'})
}
