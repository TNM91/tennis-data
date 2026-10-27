import type {TeamRosterPlayer} from './team-roster-data'
import type {PlayerChoice} from './player-connection'
import {rosterPlayerChoice} from './roster-player-profile'
export function comparisonSeedPlayers(value:readonly PlayerChoice[]|undefined):[PlayerChoice,PlayerChoice]|null{
 if(!Array.isArray(value)||value.length!==2)return null
 if(value.some(player=>!player||typeof player.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(player.id)||typeof player.name!=='string'||!player.name.trim()||player.name.length>200||[player.location,player.flight].some(part=>part!==null&&(typeof part!=='string'||part.length>200)))||value[0].id===value[1].id)return null
 return value.map(player=>({...player})) as [PlayerChoice,PlayerChoice]
}
export function rosterComparisonPlayers(rows:TeamRosterPlayer[],selected:readonly string[]){
 if(selected.length!==2||new Set(selected).size!==2)return null
 const chosen=selected.map(id=>{const matches=rows.filter(row=>row.id===id);return matches.length===1?rosterPlayerChoice(matches[0]):null})
 return chosen.every((player):player is PlayerChoice=>player!==null)?comparisonSeedPlayers(chosen):null
}
export function toggleRosterComparison(rows:TeamRosterPlayer[],selected:readonly string[],id:string){
 const eligible=new Set(rows.filter(row=>rosterPlayerChoice(row)).map(row=>row.id)),current=selected.filter(value=>eligible.has(value)).slice(-2)
 if(!eligible.has(id))return current
 if(current.includes(id))return current.filter(value=>value!==id)
 return [...current.slice(-1),id]
}
