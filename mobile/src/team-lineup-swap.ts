import type {MatchLineupCourt} from '../../lib/team-match-lineup-contract'
import type {TeamLineupPlayer} from '../../lib/team-match-replies-contract'
import type {LineupReplacementTarget} from './team-lineup-replacement'
import {courtLabels,lineupNames} from './team-match-lineup'
import {lineupCourtRows} from './team-lineup-publication'
import {html} from './html'

export type LineupSwapReview={before:MatchLineupCourt[];after:MatchLineupCourt[];names:Record<string,string>;
 source:LineupReplacementTarget;other:LineupReplacementTarget;version:string|null}

export function lineupSwapContext(courts:MatchLineupCourt[],roster:TeamLineupPlayer[],source:LineupReplacementTarget){
 if(!Number.isInteger(source.court)||!Number.isInteger(source.slot)||!courts[source.court]||courts[source.court].players[source.slot]!==source.player)return null
 const selected=courts.flatMap(court=>court.players).filter(Boolean)
 const players=new Map(roster.map(player=>[player.id,player])),names=lineupNames(roster),labels=courtLabels(courts)
 const reason=new Set(selected).size!==selected.length?'Use each player once before swapping courts.':
  !source.player||players.get(source.player)?.choice!=='in'?'Both players must be marked In to swap courts.':''
 const candidates=reason?[]:courts.flatMap((court,index)=>index===source.court?[]:court.players.flatMap((id,slot)=>
  players.get(id)?.choice==='in'?[{id,name:names.get(id)!,court:index,slot,label:labels[index],
   partner:court.format==='doubles'?names.get(court.players[1-slot])??'Player not in loaded roster':null}]:[]))
 return {reason,candidates}
}

export function swapLineupPlayers(courts:MatchLineupCourt[],roster:TeamLineupPlayer[],source:LineupReplacementTarget,other:LineupReplacementTarget){
 const context=lineupSwapContext(courts,roster,source)
 if(!context)throw Error('This court changed. Return to your lineup and choose the spot again.')
 if(context.reason)throw Error(context.reason)
 if(!context.candidates.some(candidate=>candidate.id===other.player&&candidate.court===other.court&&candidate.slot===other.slot))
  throw Error('The other assignment changed or that player is no longer marked In. Review the swap again.')
 const next=structuredClone(courts)
 next[source.court].players[source.slot]=other.player
 next[other.court].players[other.slot]=source.player
 return next
}

export function lineupSwapReviewHtml(review:LineupSwapReview){
 const before=lineupCourtRows(review.before,review.names),after=lineupCourtRows(review.after,review.names)
 return `<section class="team-lineup-replacement team-lineup-swap-review" aria-label="Court swap review">
  <h3 tabindex="-1">Review court swap</h3>
  <p>${html(review.names[review.source.player])} and ${html(review.names[review.other.player])} will exchange courts.</p>
  <ul aria-label="Courts affected by swap">${before.flatMap((court,index)=>index===review.source.court||index===review.other.court?
   [`<li><strong>${html(court.label)}</strong><span>Before · ${html(court.players)}</span><span>After · ${html(after[index].players)}</span></li>`]:[]).join('')}</ul>
  <p>This changes your private plan only. Save it or review and publish when you’re ready for teammates to see it.</p>
  <button type="button" data-apply-lineup-swap>Apply swap to private plan</button>
  <button type="button" class="secondary" data-cancel-lineup-swap>Back to players</button>
 </section>`
}
