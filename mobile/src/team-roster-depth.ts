import {getTiqEvidence} from '../../lib/tiq-rating-evidence'
import type {TeamRosterPlayer} from './team-roster-data'
export type RosterDiscipline='singles'|'doubles'
export type RosterSort='name'|'singles'|'doubles'|'ntrp'
export function rosterDisciplineEstimate(row:TeamRosterPlayer,view:RosterDiscipline) {
 const evidence=getTiqEvidence(row.player,view),raw=row.player?.[`${view}_dynamic_rating`]??null
 const value=(evidence.status==='current'||evidence.status==='provisional')&&typeof raw==='number'&&Number.isFinite(raw)&&raw>=1.5&&raw<=7?raw:null
 return {value,status:evidence.status,note:evidence.label}
}
const byName=(a:TeamRosterPlayer,b:TeamRosterPlayer)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)
export function sortRosterPlayers(rows:TeamRosterPlayer[],sort:RosterSort):TeamRosterPlayer[] {
 if(sort==='name')return [...rows].sort(byName)
 const value=(row:TeamRosterPlayer)=>sort==='ntrp'?row.ntrp:rosterDisciplineEstimate(row,sort).value
 return [...rows].sort((a,b)=>{const left=value(a),right=value(b);return left===null?(right===null?byName(a,b):1):right===null?-1:right-left||byName(a,b)})
}
export function rosterDepth(rows:TeamRosterPlayer[],view:RosterDiscipline,includeStarting=false) {
 const entries=rows.map(row=>({row,...rosterDisciplineEstimate(row,view)}))
 const current=entries.filter(e=>e.value!==null&&e.status==='current'),starting=entries.filter(e=>e.value!==null&&e.status==='provisional')
 const ranked=[...current,...(includeStarting?starting:[])].sort((a,b)=>b.value!-a.value!||byName(a.row,b.row))
 return {total:rows.length,current:current.length,starting:starting.length,unavailable:rows.length-current.length-starting.length,ranked:ranked.slice(0,6),rankedTotal:ranked.length,average:ranked.length?ranked.reduce((sum,e)=>sum+e.value!,0)/ranked.length:null}
}
