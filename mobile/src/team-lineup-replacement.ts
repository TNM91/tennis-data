import type {MatchLineupCourt} from '../../lib/team-match-lineup-contract'
import type {TeamLineupPlayer} from '../../lib/team-match-replies-contract'
import {html} from './html'
import {courtLabels,lineupNames} from './team-match-lineup'
import {availableLineupReserves} from './team-lineup-publication'

export type LineupReplacementTarget={court:number;slot:number;player:string}

export function lineupReplacementTarget(courts:MatchLineupCourt[],court:number,slot:number):LineupReplacementTarget|null{
 if(!Number.isInteger(court)||!Number.isInteger(slot)||court<0||slot<0||!courts[court]||slot>=courts[court].players.length)return null
 return {court,slot,player:courts[court].players[slot]}
}

export function lineupReplacementContext(courts:MatchLineupCourt[],roster:TeamLineupPlayer[],target:LineupReplacementTarget){
 const current=lineupReplacementTarget(courts,target.court,target.slot)
 if(!current||current.player!==target.player)return null
 const court=courts[target.court],names=lineupNames(roster)
 return {label:courtLabels(courts)[target.court],slot:target.slot+1,
  current:target.player?names.get(target.player)??'Player no longer on roster':'Open spot',
  partner:court.format==='doubles'?names.get(court.players[1-target.slot])??'Open spot':null,
  candidates:availableLineupReserves(courts,roster).map(player=>({...player,name:names.get(player.id)!}))}
}

export function replaceLineupPlayer(courts:MatchLineupCourt[],roster:TeamLineupPlayer[],target:LineupReplacementTarget,player:string){
 const context=lineupReplacementContext(courts,roster,target)
 if(!context)throw Error('This court changed. Return to your lineup and choose the spot again.')
 if(!context.candidates.some(candidate=>candidate.id===player))throw Error('That teammate is already assigned or is no longer marked In. Choose another teammate.')
 const next=structuredClone(courts)
 next[target.court].players[target.slot]=player
 return next
}

export function lineupReplacementHtml(courts:MatchLineupCourt[],roster:TeamLineupPlayer[],target:LineupReplacementTarget,complete:boolean){
 const context=lineupReplacementContext(courts,roster,target)
 if(!context)return ''
 return `<section class="team-lineup-replacement" aria-label="Available replacements">
  <h3 tabindex="-1">${context.label} · Player ${context.slot}</h3>
  <p>Replacing · <strong>${html(context.current)}</strong>${context.partner?`<span>Partner stays · ${html(context.partner)}</span>`:''}</p>
  <p>Choose an unassigned teammate marked In. Your other courts stay as planned.</p>
  ${!complete?'<p>Only the teammates loaded here are shown.</p>':''}
  ${context.candidates.length?`<ul>${context.candidates.map(player=>`<li><button type="button" class="secondary" data-choose-lineup-replacement="${html(player.id)}" aria-label="Choose ${html(player.name)} for ${context.label}"><span><strong>${html(player.name)}</strong><small>In · Not assigned</small></span><span aria-hidden="true">Choose ›</span></button></li>`).join('')}</ul>`:
   '<p>No unassigned teammates are marked In. Return to your lineup to review other replies.</p>'}
  <p>Selections stay private until you review and publish the lineup.</p>
  <button type="button" class="secondary" data-cancel-lineup-replacement>Back to lineup</button>
 </section>`
}
