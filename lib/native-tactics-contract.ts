import type {TacticalScenario} from './tactical/types'
import type {TacticalScenarioSummary} from './tactical/scenarioStorage'
import {coachId,coachRecord} from './native-coach-contract'

const text=(v:unknown,max:number,fallback='')=>{if(v===undefined)return fallback;if(typeof v!=='string'||v.length>max)throw Error('Use shorter board details');return v}
const choice=<const T extends string>(v:unknown,options:readonly T[],fallback?:T):T=>{if(v===undefined&&fallback)return fallback;if(!options.includes(v as T))throw Error('Invalid board option');return v as T}
const coordinate=(v:unknown)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)throw Error('Keep court objects within the board');return v}
const point=(v:unknown)=>{const r=coachRecord(v);return {x:coordinate(r.x),y:coordinate(r.y)}}
function list<T>(v:unknown,max:number,parse:(item:unknown)=>T):T[]{if(!Array.isArray(v)||v.length>max)throw Error('This board has too many objects');return v.map(parse)}
function unique<T extends {id:string}>(v:T[]){if(new Set(v.map(x=>x.id)).size!==v.length)throw Error('Duplicate board objects');return v}
export const tacticsStamp=(v:unknown)=>{const s=text(v,80);if(!s||!Number.isFinite(Date.parse(s)))throw Error('Review the saved board again');return s}
export function readTacticalBoard(value:unknown):TacticalScenario{
 const r=coachRecord(value);if(JSON.stringify(r).length>160000)throw Error('Use a smaller board')
 const name=text(r.name,240).trim();if(!name)throw Error('Name your board')
 return {id:coachId(r.id),name,focus:text(r.focus,1000),category:choice(r.category,['practice','match'],'practice'),audience:list(r.audience??['coach'],3,v=>choice(v,['coach','captain','player'])),duration:text(r.duration,120),level:text(r.level,160),note:text(r.note,4000),
 tokens:unique(list(r.tokens,100,v=>{const x=coachRecord(v);return {id:coachId(x.id),...point(x),type:choice(x.type,['player','ball','cone','x','o']),label:text(x.label,180),...(x.role===undefined?{}:{role:text(x.role,100)}),...(x.team===undefined?{}:{team:choice(x.team,['green','blue','white'])}),...(x.handedness===undefined?{}:{handedness:choice(x.handedness,['righty','lefty'])})}})),
 paths:unique(list(r.paths,120,v=>{const x=coachRecord(v);return {id:coachId(x.id),kind:choice(x.kind,['ball','move','recover']),label:text(x.label,240),from:point(x.from),to:point(x.to)}})),
 zones:unique(list(r.zones,32,v=>{const x=coachRecord(v);return {id:coachId(x.id),...point(x),label:text(x.label,240),width:coordinate(x.width),height:coordinate(x.height),tone:choice(x.tone,['green','blue','white'],'blue')}})),
 cues:unique(list(r.cues,80,v=>{const x=coachRecord(v);return {id:coachId(x.id),role:choice(x.role,['coach','captain','player']),text:text(x.text,1000)}}))}
}
export type TacticsIntent={action:'save';scenario:TacticalScenario;expectedUpdatedAt:string|null}|{action:'delete';id:string;expectedUpdatedAt:string}
export function readTacticsIntent(value:unknown):TacticsIntent{
 const r=coachRecord(value),allowed=r.action==='save'?['action','scenario','expectedUpdatedAt']:['action','id','expectedUpdatedAt']
 if(Object.keys(r).some(k=>!allowed.includes(k)))throw Error('Unexpected board field')
 if(r.action==='save')return {action:r.action,scenario:readTacticalBoard(r.scenario),expectedUpdatedAt:r.expectedUpdatedAt===null?null:tacticsStamp(r.expectedUpdatedAt)}
 if(r.action==='delete')return {action:r.action,id:coachId(r.id),expectedUpdatedAt:tacticsStamp(r.expectedUpdatedAt)}
 throw Error('Choose a board action')
}
export type NativeTacticsSnapshot={owner:string;scenarios:TacticalScenarioSummary[];more:boolean;detail:TacticalScenarioSummary|null}
export function readNativeTactics(value:unknown,owner:string):NativeTacticsSnapshot{
 const r=coachRecord(value);if(r.ok!==true||r.owner!==owner||!owner||JSON.stringify(r).length>3000000||!Array.isArray(r.scenarios)||r.scenarios.length>50||typeof r.more!=='boolean')throw Error('Board library could not be confirmed')
 const parse=(v:unknown)=>{const x=coachRecord(v),scenario=readTacticalBoard(x.scenario);if(x.id!==scenario.id)throw Error('Board identity changed');return {id:scenario.id,name:scenario.name,focus:scenario.focus,updatedAt:tacticsStamp(x.updatedAt),scenario}}
 return {owner,scenarios:unique(r.scenarios.map(parse)),more:r.more,detail:r.detail===null?null:parse(r.detail)}
}
