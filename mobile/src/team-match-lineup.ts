import {teamReplyLabels,type TeamLineupPlayer} from '../../lib/team-match-replies-contract'
import type {MatchLineupCourt,SavedTeamLineup} from '../../lib/team-match-lineup-contract'
import {html} from './match-details'

const availabilityOrder={in:0,maybe:1,awaiting:2,out:3}
const availabilityLabel=(player:TeamLineupPlayer)=>player.choice?teamReplyLabels[player.choice]:'Awaiting reply'
const availabilityRank=(player:TeamLineupPlayer)=>availabilityOrder[player.choice??'awaiting']

function lineupNames(roster:TeamLineupPlayer[]){
 const counts=new Map<string,number>()
 for(const {name} of roster){const key=name.toLowerCase();counts.set(key,(counts.get(key)??0)+1)}
 return new Map(roster.map(({id,name})=>[id,counts.get(name.toLowerCase())!>1?`${name} (${id.slice(-4).toUpperCase()})`:name]))
}

function courtLabels(courts:MatchLineupCourt[]){
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
   </select></label>`).join('')}
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
