import {formatCalendarDay} from '../../lib/calendar-date'
import type {ReviewedNextMatch} from '../../lib/team-fixtures-contract'
import {lineupReplyLabels} from '../../lib/team-match-lineup-contract'
import {teamReplyLabels,type TeamMatchReplies} from '../../lib/team-match-replies-contract'
import {html} from './html'
import {lineupNames} from './team-match-lineup'
import type {TeamNextMatchSchedule} from './team-room-data'

export type PlayerAssignmentSnapshot={
 revision:string|null
 version:string|null
 match:ReviewedNextMatch|null
 court:string|null
 partners:{id:string;name:string}[]
 availability:string
 response:string
}
export type PlayerAssignmentUpdate={before:PlayerAssignmentSnapshot;after:PlayerAssignmentSnapshot}

export function playerAssignmentSnapshot(schedule:TeamNextMatchSchedule|null,replies:TeamMatchReplies|null,owner:string):PlayerAssignmentSnapshot{
 const shared=replies?.sharedLineup
 let singles=0,doubles=0
 const assignment=shared?.courts.map(court=>({court,label:court.format==='singles'?`Singles ${++singles}`:`Doubles ${++doubles}`}))
  .find(({court})=>court.players.includes(owner))
 const response=replies?.lineupReply?.version===shared?.version?replies?.lineupReply:null
 return {revision:schedule?.revision??null,version:shared?.version??null,match:schedule?.nextMatch?{...schedule.nextMatch}:null,
  court:assignment?.label??null,partners:assignment?.court.players.filter(id=>id!==owner).map(id=>({id,name:shared!.names[id]}))??[],
  availability:replies?.own?teamReplyLabels[replies.own.choice]:'Not replied',
  response:response?lineupReplyLabels[response.choice]:'Not confirmed'}
}

export function playerAssignmentChanges(update:PlayerAssignmentUpdate,time:(match:ReviewedNextMatch)=>string){
 const {before,after}=update
 const rows:{label:string;before:string;after:string}[]=[]
 const add=(label:string,previous:string|undefined,current:string|undefined)=>{if(previous!==current)rows.push({label,before:previous||'To be confirmed',after:current||'To be confirmed'})}
 if(!after.match){rows.push({label:'Match',before:before.match?`vs ${before.match.opponent}`:'Not scheduled',after:'No upcoming match'});return rows}
 add('Opponent',before.match?.opponent,after.match.opponent)
 add('Date',before.match?formatCalendarDay(before.match.date):undefined,formatCalendarDay(after.match.date))
 if(before.match?.time!==after.match.time||before.match?.timeZone!==after.match.timeZone){
  const zoneChanged=before.match?.timeZone!==after.match.timeZone
  const when=(match:ReviewedNextMatch|null)=>match?`${time(match)||'Time to be confirmed'}${zoneChanged?' · '+match.timeZone.replaceAll('_',' '):''}`:undefined
  add('Start time',when(before.match),when(after.match))
 }
 add('Venue',before.match?.facility,after.match.facility)
 add('Your court',before.court??'Not assigned',after.court??'Not assigned')
 const partnerKey=(partners:PlayerAssignmentSnapshot['partners'])=>partners.map(player=>player.id).sort().join(',')
 if(partnerKey(before.partners)!==partnerKey(after.partners)){
  const names=lineupNames([...new Map([...before.partners,...after.partners].map(player=>[player.id,player])).values()])
  const partners=(snapshot:PlayerAssignmentSnapshot)=>snapshot.partners.map(player=>names.get(player.id)).join(' & ')||(snapshot.court?'Singles':'Not assigned')
  add('Your partner',partners(before),partners(after))
 }
 add('Your availability',before.availability,after.availability)
 add('Your response',before.response,after.response)
 return rows
}

export function playerAssignmentUpdateHtml(update:PlayerAssignmentUpdate,time:(match:ReviewedNextMatch)=>string,showAssignment=false){
 const rows=playerAssignmentChanges(update,time)
 const newVersion=update.before.version!==update.after.version
 return `<section class="team-assignment-updates" aria-label="Match updates"><h3 tabindex="-1">Review match updates</h3>
  <p>${rows.length?'Changed since you last checked this match.':newVersion?'Your captain published a new lineup. Your court and partner are unchanged.':'The match or your response was updated. Your court and partner are unchanged.'}</p>
  ${rows.length?`<ul>${rows.map(row=>`<li><strong>${html(row.label)}</strong><span>Before · ${html(row.before)}</span><span>Now · ${html(row.after)}</span></li>`).join('')}</ul>`:''}
  ${update.after.match?'<p>Check the current details before responding. Nothing is confirmed automatically.</p>':''}
  ${showAssignment&&update.after.match&&update.after.court?'<button type="button" class="secondary" data-readiness-action="publication">View current assignment<span aria-hidden="true">›</span></button>':''}</section>`
}
