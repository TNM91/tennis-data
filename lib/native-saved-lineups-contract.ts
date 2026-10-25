import {normalizeSavedSlots} from './captain-saved-slots'
import type {CaptainLineupSlot} from './captain-lineup-format'
import {lineupRecord,readLineupPlan,type LineupEditorData} from './native-captain-lineup-contract'
export type SavedLineup={id:string;name:string;slots:CaptainLineupSlot[];hasDefaults:boolean}
const text=(v:unknown,max:number)=>{if(typeof v!=='string'||v.length>max)throw Error('Saved lineup unavailable.');return v.trim()}
export function savedSlots(raw:unknown){
 if(!Array.isArray(raw)||raw.length>30)throw Error('Saved courts unavailable.')
 for(const value of raw){const s=lineupRecord(value);text(s.id,120);text(s.label,120);if(!['singles','doubles'].includes(String(s.slotType))||s.defaulted!==undefined&&typeof s.defaulted!=='boolean'||s.ratingLevel!==undefined&&(typeof s.ratingLevel!=='number'||!Number.isFinite(s.ratingLevel)||s.ratingLevel<1||s.ratingLevel>10)||!Array.isArray(s.players)||s.players.length>(s.slotType==='doubles'?2:1))throw Error('Saved courts unavailable.');for(const value of s.players){const p=lineupRecord(value);text(p.playerId,120);text(p.playerName,240)}}
 return normalizeSavedSlots(raw)
}
export function readSavedLineups(raw:unknown):SavedLineup[]{if(!Array.isArray(raw)||raw.length>20)throw Error('Saved library unavailable.');const rows=raw.map(value=>{const r=lineupRecord(value),id=text(r.id,120),name=text(r.name,240);if(!id||!name||typeof r.hasDefaults!=='boolean')throw Error('Saved library unavailable.');return {id,name,slots:savedSlots(r.slots),hasDefaults:r.hasDefaults}});if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Saved library unavailable.');return rows}
/** Copy identities only. Never infer current membership from a stored display name. */
export function importSavedLineup(base:LineupEditorData,row:SavedLineup){
 const plan=structuredClone(readLineupPlan(base.plan,base.roster)),warnings:string[]=[];let copied=0
 if(row.hasDefaults)throw Error('Saved default rules need review on the website before reuse.')
 const label=(v:string)=>v.trim().toLowerCase(),slots=row.slots,keys=slots.map(s=>label(s.label))
 if(slots.length!==plan.courts.length||new Set(keys).size!==keys.length||new Set(plan.courts.map(s=>label(s.label))).size!==plan.courts.length)throw Error('Saved court labels or format do not match this working plan.')
 for(const c of plan.courts){const s=slots.find(s=>label(s.label)===label(c.label));if(!s||s.slotType!==c.slotType||s.ratingLevel!==c.ratingLevel)throw Error('Saved court labels or format do not match this working plan.')}
 const ids=slots.filter(s=>!s.defaulted).flatMap(s=>s.players.map(p=>p.playerId)).filter(Boolean),duplicate=new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))
 for(const c of plan.courts){const s=slots.find(s=>label(s.label)===label(c.label))!;c.players=c.players.map(()=> '');if(c.defaulted){warnings.push(c.label+': remains defaulted in your working plan.');continue}if(s.defaulted){warnings.push(c.label+': saved default left open.');continue}const players=s.players.map(p=>base.roster.filter(r=>p.playerId&&r.playerId===p.playerId));if(s.players.some(p=>!p.playerId||duplicate.has(p.playerId))||players.some(p=>p.length!==1)){warnings.push(c.label+': incomplete, duplicate or disconnected player identities; left open.');continue}c.players=players.map(p=>p[0].key);copied++}
 return {plan:readLineupPlan(plan,base.roster),warnings,copied}
}
