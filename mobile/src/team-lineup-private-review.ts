import type {MatchLineupCourt} from '../../lib/team-match-lineup-contract'
import type {TeamMatchReplies} from '../../lib/team-match-replies-contract'
import {html} from './html'
import {courtLabels,lineupNames} from './team-match-lineup'
import {lineupPublishComparison} from './team-lineup-publication'

export function privateLineupReview(courts:MatchLineupCourt[],replies:TeamMatchReplies|null){
 const roster=replies?.lineupRoster??[],previous=replies?.sharedLineup
 const people=new Map(roster.map(player=>[player.id,{id:player.id,name:player.name}]))
 for(const [id,name] of Object.entries(previous?.names??{}))if(!people.has(id))people.set(id,{id,name})
 const names=lineupNames([...people.values()]),players=new Map(roster.map(player=>[player.id,player]))
 const uses=new Map<string,number>()
 for(const id of courts.flatMap(court=>court.players).filter(Boolean))uses.set(id,(uses.get(id)??0)+1)
 const comparison=lineupPublishComparison(courts,roster,previous)
 const current=[...comparison.changes.filter(row=>row.status!=='removed'),...comparison.unchanged]
 const labels=courtLabels(courts)
 const rows=current.map(row=>({...row,court:labels.indexOf(row.label),issues:[] as {slot:number;detail:string}[]}))
 for(const [court,plan] of courts.entries()){
  const row=rows.find(item=>item.court===court)!
  plan.players.forEach((id,slot)=>{
   if(!id){row.issues.push({slot,detail:'Open spot · Choose a teammate'});return}
   const name=names.get(id)??'Teammate',player=players.get(id)
   if((uses.get(id)??0)>1)row.issues.push({slot,detail:`${name} · Assigned more than once`})
   const reason=!replies?.lineupRoster?'Availability not checked':!player?replies.rosterComplete?'No longer on roster':'Not in loaded roster':
    player.choice==='in'?null:player.choice==='out'?'Can’t play':player.choice==='maybe'?'Maybe':'Awaiting reply'
   if(reason)row.issues.push({slot,detail:`${name} · ${reason}`})
  })
 }
 rows.sort((left,right)=>left.court-right.court)
 return {counts:comparison.counts,needsReview:rows.filter(row=>row.issues.length).length,
  rows:rows.filter(row=>row.status!=='unchanged'||row.issues.length),
  removed:comparison.changes.filter(row=>row.status==='removed')}
}

export function privateLineupReviewHtml(courts:MatchLineupCourt[],replies:TeamMatchReplies|null,expanded:boolean,disabled:boolean){
 const review=privateLineupReview(courts,replies),counts=review.counts
 const changes=[counts.changed?`${counts.changed} updated`:'',counts.new?`${counts.new} new`:'',counts.removed?`${counts.removed} removed`:''].filter(Boolean)
 const summary=[changes.join(' · ')||'No court changes',`${review.needsReview} ${review.needsReview===1?'court needs':'courts need'} review`].join(' · ')
 return `<details class="team-lineup-private-review" data-private-lineup-review ${expanded?'open':''}>
  <summary><span>Private changes</span><small>${summary}</small></summary>
  <p>${replies?.sharedLineup?'Compared with the published lineup. Edits stay private until you publish.':'No lineup has been published yet. These court assignments are private.'}</p>
  <p>Availability is from the last match check.${replies?.rosterComplete===true?'':' Only loaded teammates have been checked.'}</p>
  ${review.rows.length||review.removed.length?`<ul aria-label="Courts to review">${review.rows.map(row=>`<li>
   <div class="team-lineup-change-heading"><strong>${row.label}</strong><span>${row.status==='new'?'New court':row.status==='changed'?'Updated':'Check availability'}</span></div>
   ${row.status==='changed'?`<span>Published · ${html(row.before??'')}</span>`:''}<span>Private · ${html(row.players)}</span>
   ${row.issues.length?`<ul aria-label="${row.label} checks">${row.issues.map(issue=>`<li>${html(issue.detail)}</li>`).join('')}</ul>`:''}
   <button type="button" class="secondary" data-review-private-court="${row.court}" aria-label="Review ${row.label}" ${disabled?'disabled':''}>Review court<span aria-hidden="true">›</span></button>
  </li>`).join('')}${review.removed.map(row=>`<li><div class="team-lineup-change-heading"><strong>${row.label}</strong><span>Removed</span></div><span>Published · ${html(row.players)}</span><span>Removed from your private plan.</span></li>`).join('')}</ul>`:
   courts.length?'<p>Court assignments match the published lineup. No player spots need review.</p>':''}
  ${!courts.length?'<p>Add a court below to plan the lineup.</p>':''}
 </details>`
}
