import {lineupReplyLabels,type MatchLineupCourt,type SavedTeamLineup} from '../../lib/team-match-lineup-contract'
import type {TeamLineupPlayer,TeamMatchReplies} from '../../lib/team-match-replies-contract'
import {html} from './html'
import {ownSharedCourtHtml} from './team-match-readiness'
import {lineupNames} from './team-match-lineup'

type AssignmentStatus='review'|'awaiting'|'unknown'|'confirmed'

export function availableLineupReserves(courts:MatchLineupCourt[],roster:TeamLineupPlayer[]){
 const assigned=new Set(courts.flatMap(court=>court.players))
 return roster.filter(player=>player.choice==='in'&&!assigned.has(player.id)).sort((a,b)=>a.name.localeCompare(b.name))
}

export function lineupCourtRows(courts:MatchLineupCourt[],names:Record<string,string>){
 let singles=0,doubles=0
 return courts.map(court=>({label:court.format==='singles'?`Singles ${++singles}`:`Doubles ${++doubles}`,
  ids:[...court.players],players:court.players.map(id=>names[id]??'Teammate').join(' & ')}))
}

export function lineupPublishComparison(courts:MatchLineupCourt[],roster:TeamLineupPlayer[],previous?:SavedTeamLineup){
 const people=new Map(roster.map(player=>[player.id,{id:player.id,name:player.name}]))
 for(const id of previous?.courts.flatMap(court=>court.players)??[])if(!people.has(id))people.set(id,{id,name:previous!.names[id]})
 const names=Object.fromEntries(lineupNames([...people.values()]))
 const before=lineupCourtRows(previous?.courts??[],names),after=lineupCourtRows(courts,names)
 const samePlayers=(left:string[],right:string[])=>{
  const leftIds=[...left].sort(),rightIds=[...right].sort()
  return leftIds.length===rightIds.length&&leftIds.every((id,index)=>id===rightIds[index])
 }
 const rows=after.map(row=>{
  const prior=before.find(old=>old.label===row.label)
  const status=!prior?'new':samePlayers(prior.ids,row.ids)?'unchanged':'changed'
  return {...row,before:prior?.players,status}
 })
 const removed=before.filter(row=>!after.some(next=>next.label===row.label)).map(row=>({...row,before:row.players,status:'removed'}))
 const all=[...rows,...removed]
 return {changes:all.filter(row=>row.status!=='unchanged'),unchanged:all.filter(row=>row.status==='unchanged'),
  counts:{new:rows.filter(row=>row.status==='new').length,changed:rows.filter(row=>row.status==='changed').length,
   removed:removed.length,unchanged:rows.filter(row=>row.status==='unchanged').length}}
}

export function lineupConfirmationSummary(replies:TeamMatchReplies){
 const shared=replies.sharedLineup
 const roster=new Map(replies.lineupRoster?.map(player=>[player.id,player]))
 const responses=new Map(replies.lineupReplies?.filter(reply=>reply.version===shared?.version).map(reply=>[reply.profileId,reply.choice]))
 const checked=replies.lineupRoster!==undefined&&replies.lineupReplies!==undefined
 let singles=0,doubles=0
 const rows=(shared?.courts??[]).flatMap(court=>{
  const label=court.format==='singles'?`Singles ${++singles}`:`Doubles ${++doubles}`
  return court.players.map(id=>{
   const player=roster.get(id),choice=responses.get(id)
   const status:AssignmentStatus=!player?replies.rosterComplete?'review':'unknown':player.choice==='out'||choice==='needs_change'?'review':
    !checked?'unknown':choice==='confirmed'?'confirmed':'awaiting'
   const reason=!player?replies.rosterComplete?'No longer on roster':'Recheck this player':player.choice==='out'?'Can’t play':
    choice==='needs_change'?lineupReplyLabels.needs_change:!checked?'Recheck confirmations':choice==='confirmed'?lineupReplyLabels.confirmed:'Awaiting confirmation'
   return {id,name:shared!.names[id],court:label,status,reason}
  })
 })
 const priority={review:0,awaiting:1,unknown:2,confirmed:3}
 rows.sort((a,b)=>priority[a.status]-priority[b.status])
 return {rows,checked,confirmed:rows.filter(row=>row.status==='confirmed').length,
  awaiting:rows.filter(row=>row.status==='awaiting').length,review:rows.filter(row=>row.status==='review').length,
  unknown:rows.filter(row=>row.status==='unknown').length}
}

export function lineupConfirmationReminder(replies:TeamMatchReplies,matchLabel:string){
 const summary=lineupConfirmationSummary(replies)
 if(!replies.sharedLineup||!summary.checked)throw Error('Reload the match to check assignment confirmations.')
 const waiting=summary.rows.filter(row=>row.status==='awaiting')
 if(!waiting.length)return null
 const message=`Assignment check for ${matchLabel}\n\n${waiting.map(row=>row.name).join(', ')} — please open Team → Next match to confirm your published court assignment or request a change.\n\nIf you can’t play, update Can you play? too.`
 if(message.length>2400)throw Error('This reminder is too long for one chat message. Review the assignment responses instead.')
 return message
}

function privateLineupNotice(replies:TeamMatchReplies,busy:boolean){
 if(!replies.savedLineup||replies.savedLineup.version===replies.sharedLineup?.version)return ''
 return `<div class="team-lineup-private-notice"><p>Your private lineup has unpublished edits. Teammates still see ${replies.sharedLineup?'the published assignments':'no court assignments'}.</p>
  <button type="button" class="secondary" data-review-private-lineup ${busy?'disabled':''}>Review private lineup</button></div>`
}

export function lineupPublishPreviewHtml(courts:MatchLineupCourt[],roster:TeamLineupPlayer[],previous?:SavedTeamLineup){
 const comparison=lineupPublishComparison(courts,roster,previous),counts=comparison.counts
 const summary=previous?[[counts.changed,'updated'],[counts.new,'new'],[counts.removed,'removed'],[counts.unchanged,'unchanged']]
  .filter(([count])=>Number(count)>0).map(([count,label])=>`${count} ${label}`).join(' · '):`${courts.length} ${courts.length===1?'court':'courts'} to publish`
 return `<section class="team-lineup-publish-preview" aria-label="Lineup to publish"><h3 tabindex="-1">Review lineup</h3>
  <p>${previous?'This replaces the published lineup. Assigned players will need to confirm this version.':'Your teammates will see these court assignments in Next match.'}</p>
  <p class="team-lineup-change-summary">${html(summary)}</p>
  ${previous&&!comparison.changes.length?'<p>No court assignment changes.</p>':''}
  ${comparison.changes.length?`<ul aria-label="Court changes">${comparison.changes.map(row=>`<li data-lineup-change="${row.status}"><div class="team-lineup-change-heading"><strong>${html(row.label)}</strong><span>${row.status==='new'?'New court':row.status==='removed'?'Removed court':'Updated'}</span></div>
   ${row.status==='removed'?`<span>Removed from the published lineup</span><small>Previously · ${html(row.before!)}</small>`:
    `<span>${html(row.players)}</span>${row.before?`<small>Previously · ${html(row.before)}</small>`:''}`}</li>`).join('')}</ul>`:''}
  ${comparison.unchanged.length?`<details class="team-lineup-unchanged"><summary>Unchanged courts (${comparison.unchanged.length})</summary><ul aria-label="Unchanged courts">${comparison.unchanged.map(row=>`<li data-lineup-change="unchanged"><strong>${html(row.label)}</strong><span>${html(row.players)}</span></li>`).join('')}</ul></details>`:''}
 </section>`
}

export function lineupPublicationHtml(replies:TeamMatchReplies|null,owner:string,captain:boolean,busy:boolean){
 if(!replies)return ''
 const shared=replies?.sharedLineup
 if(!shared)return captain?`<section class="team-lineup-publication" aria-label="Published lineup"><h3 tabindex="-1">Published lineup</h3><p>No lineup published yet. Private court assignments stay with your captains.</p>${privateLineupNotice(replies,busy)}</section>`:''
 const assigned=Object.hasOwn(shared.names,owner),own=replies?.lineupReply
 const ownStatus=own?lineupReplyLabels[own.choice]:'Awaiting your confirmation'
 const summary=lineupConfirmationSummary(replies)
 return `<section class="team-lineup-publication" aria-label="Published lineup"><h3 tabindex="-1">Published lineup</h3>
  ${captain?`<p>${summary.checked?`${summary.confirmed} of ${summary.rows.length} assignments confirmed`:'Reload the match to check confirmations.'}</p>
  ${summary.checked?`<dl class="team-lineup-confirmation-counts"><div><dt>To confirm</dt><dd>${summary.awaiting}</dd></div><div><dt>Needs review</dt><dd>${summary.review}</dd></div></dl>`:''}
  ${summary.unknown?`<p>${summary.unknown} ${summary.unknown===1?'assignment could':'assignments could'} not be checked. Reload the match before following up.</p>`:''}
  ${privateLineupNotice(replies,busy)}
  <ul class="team-lineup-confirmations" aria-label="Assignment responses">${summary.rows.map(row=>`<li data-assignment-status="${row.status}"><div><strong>${html(row.name)}</strong><span>${html(row.court)} · ${row.reason}</span></div>
   ${row.status==='review'?`<button type="button" class="secondary" data-review-lineup-player="${html(row.id)}" aria-label="Review court for ${html(row.name)}" ${busy?'disabled':''}>Review court</button>`:''}</li>`).join('')}</ul>
  ${summary.awaiting?`<button type="button" class="secondary" data-draft-confirmation-reminder ${busy?'disabled':''}>Draft confirmation reminder</button><p>Review the reminder in team chat before sending.</p>`:''}`:''}
  ${!captain||assigned?ownSharedCourtHtml(shared,owner):''}
  ${assigned?`<p class="team-lineup-own-status">${replies?.own?.choice==='out'?'You’re marked Out for this match.':ownStatus}</p><div class="team-readiness-actions">
   <button type="button" class="secondary" data-lineup-reply="confirmed" ${busy||own?.choice==='confirmed'||replies?.own?.choice==='out'?'disabled':''}>Confirm my assignment</button>
   <button type="button" class="secondary" data-lineup-reply="needs_change" ${busy||own?.choice==='needs_change'?'disabled':''}>Request a change</button>
  </div><p>For a different court or partner, request a change. If you can’t play the match, update your availability below.</p>`:''}
 </section>`
}
