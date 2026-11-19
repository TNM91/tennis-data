import {lineupReplyLabels,type MatchLineupCourt,type SavedTeamLineup} from '../../lib/team-match-lineup-contract'
import type {TeamLineupPlayer,TeamMatchReplies} from '../../lib/team-match-replies-contract'
import {html} from './html'
import {ownSharedCourtHtml} from './team-match-readiness'

export function availableLineupReserves(courts:MatchLineupCourt[],roster:TeamLineupPlayer[]){
 const assigned=new Set(courts.flatMap(court=>court.players))
 return roster.filter(player=>player.choice==='in'&&!assigned.has(player.id)).sort((a,b)=>a.name.localeCompare(b.name))
}

export function lineupCourtRows(courts:MatchLineupCourt[],names:Record<string,string>){
 let singles=0,doubles=0
 return courts.map(court=>({label:court.format==='singles'?`Singles ${++singles}`:`Doubles ${++doubles}`,
  players:court.players.map(id=>names[id]??'Teammate').join(' & ')}))
}

export function lineupPublishPreviewHtml(courts:MatchLineupCourt[],roster:TeamLineupPlayer[],previous?:SavedTeamLineup){
 const names=Object.fromEntries(roster.map(player=>[player.id,player.name]))
 const before=lineupCourtRows(previous?.courts??[],previous?.names??{}),after=lineupCourtRows(courts,names)
 return `<section class="team-lineup-publish-preview" aria-label="Lineup to publish"><h3 tabindex="-1">Review lineup</h3>
  <p>${previous?'This replaces the published lineup. Assigned players will need to confirm this version.':'Your teammates will see these court assignments in Next match.'}</p>
  <ul>${after.map(row=>`<li><strong>${html(row.label)}</strong><span>${html(row.players)}</span>${before.find(old=>old.label===row.label)?.players&&before.find(old=>old.label===row.label)?.players!==row.players?
   `<small>Previously · ${html(before.find(old=>old.label===row.label)!.players)}</small>`:''}</li>`).join('')}
   ${before.filter(row=>!after.some(next=>next.label===row.label)).map(row=>`<li><strong>${html(row.label)}</strong><span>Removed from the published lineup</span></li>`).join('')}</ul>
 </section>`
}

export function lineupPublicationHtml(replies:TeamMatchReplies|null,owner:string,captain:boolean,busy:boolean){
 if(!replies)return ''
 const shared=replies?.sharedLineup
 if(!shared)return captain?'<section class="team-lineup-publication" aria-label="Published lineup"><h3 tabindex="-1">Published lineup</h3><p>No lineup published yet. Private court assignments stay with your captains.</p></section>':''
 const assigned=Object.hasOwn(shared.names,owner),own=replies?.lineupReply
 const ownStatus=own?lineupReplyLabels[own.choice]:'Awaiting your confirmation'
 const responses=new Map(replies?.lineupReplies?.map(reply=>[reply.profileId,reply.choice]))
 return `<section class="team-lineup-publication" aria-label="Published lineup"><h3 tabindex="-1">Published lineup</h3>
  ${captain?`<p>${replies?.lineupReplies?`${[...responses.entries()].filter(([id,choice])=>choice==='confirmed'&&replies.lineupRoster?.some(player=>player.id===id&&player.choice!=='out')).length} of ${Object.keys(shared.names).length} assignments confirmed`:'Reload the match to check confirmations.'}</p>
  <ul class="team-lineup-confirmations">${Object.entries(shared.names).map(([id,name])=>{
   const choice=responses.get(id),player=replies.lineupRoster?.find(player=>player.id===id)
   const label=!player?replies.rosterComplete?'No longer on roster':'Recheck this player':player.choice==='out'?'Can’t play':choice?lineupReplyLabels[choice]:'Awaiting confirmation'
   return `<li><strong>${html(name)}</strong><span>${label}</span></li>`
  }).join('')}</ul>`:''}
  ${ownSharedCourtHtml(shared,owner)}
  ${assigned?`<p class="team-lineup-own-status">${replies?.own?.choice==='out'?'You’re marked Out for this match.':ownStatus}</p><div class="team-readiness-actions">
   <button type="button" class="secondary" data-lineup-reply="confirmed" ${busy||own?.choice==='confirmed'||replies?.own?.choice==='out'?'disabled':''}>Confirm my assignment</button>
   <button type="button" class="secondary" data-lineup-reply="needs_change" ${busy||own?.choice==='needs_change'?'disabled':''}>Request a change</button>
  </div><p>For a different court or partner, request a change. If you can’t play the match, update your availability below.</p>`:''}
 </section>`
}
