import type {NativeTeamRoom} from './team-room-data'
import {html} from './match-details'
import {findTeamRoomAssignedCourt} from '../../lib/team-room-arrival'
import {ChatActionError,type ChatAction} from './team-chat-send'
export type MatchAction=Extract<ChatAction,{action:'respond_lineup_change'|'respond'|'acknowledge_lineup'|'set_arrival_status'|'ack_final_lineup'}>
export function matchActionsHtml(room:NativeTeamRoom,owner:string){
 const message=room.activeCard,card=message?.card
 if(!message || !card || message.deletedAt || card.state==='archived' || card.completed)return '<p class="rating-context">Match replies open when your captain shares an active match plan.</p>'
 const player=room.members.find(member=>member.id===owner),assigned=findTeamRoomAssignedCourt(card.lineup,[player?.playerName,player?.name]),arrival=card.arrivals?.find(item=>item.profileId===owner)
 const response=message.response==='yes'?'Available':message.response==='maybe'?'Maybe':message.response==='no'?'Unavailable':'Not answered'
 const replacement=card.replacement
 const replacementHtml=replacement?`<section aria-label="Lineup replacement"><h3>Lineup change · ${html(replacement.courtLabel)}</h3><p>${html(replacement.replacementPlayerName)} is in for ${html(replacement.outgoingPlayerName)}.</p><p>New court: ${replacement.afterPlayers.map(html).join(' &amp; ')}</p><p>${replacement.response==='accepted'?'Replacement accepted.':replacement.response==='declined'?'Replacement can’t play.':'Waiting for the replacement’s reply.'}</p>${replacement.deadlineAt&&Number.isFinite(Date.parse(replacement.deadlineAt))?`<p>Reply by ${html(new Date(replacement.deadlineAt).toLocaleString())}</p>`:''}${replacement.canRespond?'<p>Your reply updates your availability and lets your captain know.</p><div class="match-filters" role="group" aria-label="Your replacement reply"><button type="button" data-replacement-response="accepted">Accept replacement</button><button type="button" class="secondary" data-replacement-response="declined">Can’t play replacement</button></div>':''}</section>`:''
 return `<section aria-label="Your match-day actions"><h2>Your match-day reply</h2>${replacementHtml}<p>Availability: <strong>${response}</strong></p><div class="match-filters" role="group" aria-label="Your availability">${([['yes','I’m in'],['maybe','Maybe'],['no','Can’t play']] as const).map(([value,label])=>`<button type="button" class="secondary" data-match-response="${value}" aria-pressed="${message.response===value}">${label}</button>`).join('')}</div><p class="rating-context">Your captain sees your reply. Availability does not guarantee a court assignment.</p>${card.cardType==='projected_lineup' && (card.lineupVersion || 0)>0?`<h3>Shared lineup</h3><p>Version ${card.lineupVersion} · ${card.acknowledged?'You have reviewed this version.':'Review the court plan before acknowledging.'}</p><button type="button" class="secondary" data-lineup-ack ${card.acknowledged?'disabled':''}>${card.acknowledged?'Lineup reviewed':'I’ve reviewed this lineup'}</button>`:''}${room.finalLineupReview?.currentUserRequired?`<h3>Final lineup</h3><button type="button" class="secondary" data-final-ack ${room.finalLineupReview.currentUserSeen?'disabled':''}>${room.finalLineupReview.currentUserSeen?'Final lineup seen':'I’ve seen the final lineup'}</button>`:''}${card.published && assigned?`<h3>Your arrival · ${html(assigned.courtLabel)}</h3><p>${html(arrival?.status==='here'?'You’re here.':arrival?.status==='on_my_way'?'You’re on your way.':arrival?.status==='running_late'?'You’re running late.':'Let your team know when you’re heading to court.')}</p><div class="match-filters" role="group" aria-label="Your arrival">${([['on_my_way','On my way'],['here','Here'],['running_late','Running late']] as const).map(([value,label])=>`<button type="button" class="secondary" data-match-arrival="${value}" aria-pressed="${arrival?.status===value}">${label}</button>`).join('')}</div><p class="rating-context">Running late alerts your team’s captains.</p>`:''}<p role="status" id="match-action-status"></p><button type="button" class="secondary" id="match-action-retry" hidden>Retry same match reply</button></section>`
}
/** Retain the desired action after ambiguous transport, without creating background retries. */
export class TeamMatchActions {
 pending:MatchAction|null=null;sending=false;notice='';private disposed=false
 constructor(private send:(action:MatchAction)=>Promise<unknown>){}
 async submit(action?:MatchAction){
  if(this.disposed || this.sending || !this.pending && !action)return false
  this.pending??=action!;this.sending=true;this.notice='Saving your match reply…'
  try{await this.send(this.pending);if(this.disposed)return false;this.pending=null;this.notice='Match reply saved.';return true}
  catch(cause){if(this.disposed)return false;if(cause instanceof ChatActionError && !cause.uncertain){this.pending=null;this.notice='The match changed or your access is unavailable. Refresh Match day.'}else this.notice='Couldn’t confirm your reply. Retry saves the same choice.';return false}
  finally{this.sending=false}
 }
 dispose(){this.disposed=true;this.pending=null;this.notice=''}
}
