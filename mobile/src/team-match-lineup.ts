import {teamReplyLabels,type TeamLineupPlayer} from '../../lib/team-match-replies-contract'
import type {MatchLineupCourt,SavedTeamLineup} from '../../lib/team-match-lineup-contract'
import {html} from './match-details'

const availabilityOrder={in:0,maybe:1,awaiting:2,out:3}
const availabilityLabel=(player:TeamLineupPlayer)=>player.choice?teamReplyLabels[player.choice]:'Awaiting reply'
const availabilityRank=(player:TeamLineupPlayer)=>availabilityOrder[player.choice??'awaiting']

export function lineupNames(roster:Pick<TeamLineupPlayer,'id'|'name'>[]){
 const groups=new Map<string,string[]>()
 for(const {id,name} of roster){const key=name.toLowerCase();groups.set(key,[...(groups.get(key)??[]),id])}
 return new Map(roster.map(({id,name}):[string,string]=>{
  const group=groups.get(name.toLowerCase())!
  if(group.length===1)return [id,name]
  let length=4
  while(length<id.length&&group.some(other=>other!==id&&other.slice(-length).toUpperCase()===id.slice(-length).toUpperCase()))length+=2
  return [id,`${name} (${id.slice(-length).toUpperCase()})`]
 }))
}

export function courtLabels(courts:MatchLineupCourt[]){
 let singles=0,doubles=0
 return courts.map(({format})=>format==='singles'?`Singles ${++singles}`:`Doubles ${++doubles}`)
}

export function matchLineupFields(courts:MatchLineupCourt[],roster:TeamLineupPlayer[]){
 const names=lineupNames(roster)
 const labels=courtLabels(courts)
 const ordered=[...roster].sort((a,b)=>availabilityRank(a)-availabilityRank(b)||a.name.localeCompare(b.name))
 return courts.map((court,index)=>`<fieldset class="lineup-court"><legend>${labels[index]}</legend>
  ${court.players.map((selected,slot)=>`<label>${court.format==='singles'?'Player':`Player ${slot+1}`}
   <select data-match-lineup-player="${index}:${slot}" required><option value="">Choose teammate</option>
    ${selected&&!names.has(selected)?`<option value="${selected}" selected>Player no longer on roster</option>`:''}
    ${ordered.filter(player=>player.choice!=='out'||player.id===selected).map(player=>
      `<option value="${player.id}" ${player.id===selected?'selected':''}>${html(names.get(player.id)!)} · ${availabilityLabel(player)}</option>`).join('')}
   </select></label><button type="button" class="secondary" data-find-lineup-replacement="${index}:${slot}" aria-label="${html(selected?`Find replacement for ${names.get(selected)??'assigned player'} on ${labels[index]}`:`Choose available player for ${labels[index]}, player ${slot+1}`)}">${selected?'Find replacement':'Choose available player'}</button>`).join('')}
  <button type="button" class="secondary" data-remove-lineup-court="${index}">Remove ${labels[index].toLowerCase()}</button>
 </fieldset>`).join('')
}

export function matchLineupMessage(courts:MatchLineupCourt[],roster:TeamLineupPlayer[],match:string){
 const names=lineupNames(roster)
 const eligible=new Set(roster.filter(player=>player.choice!=='out').map(player=>player.id))
 const selected=courts.flatMap(court=>court.players)
 if(!selected.length||selected.some(id=>!eligible.has(id)))throw Error('Choose an available teammate for each spot.')
 if(new Set(selected).size!==selected.length)throw Error('Choose each teammate only once.')
 const labels=courtLabels(courts)
 const message=`Lineup for ${match}\n\n`+courts.map((court,index)=>`${labels[index]} — ${court.players.map(id=>names.get(id)).join(' & ')}`).join('\n')
 if(message.length>2400)throw Error('This lineup is too long for one chat message.')
 return message
}

export function plannedLineupHtml(lineup:SavedTeamLineup,expanded=false){
 const labels=courtLabels(lineup.courts)
 return `<details class="team-result-court-list" data-planned-lineup ${expanded?'open':''}>
  <summary>Planned lineup</summary>
  <ol>${lineup.courts.map((court,index)=>`<li><strong>${labels[index]}</strong>
   <span>${court.players.map(id=>html(lineup.names[id])).join(' &amp; ')}</span></li>`).join('')}</ol>
 </details>`
}
