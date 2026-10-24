export type LineupPlayer={key:string;playerId:string;name:string}
export type LineupCourt={id:string;label:string;slotType:'singles'|'doubles';ratingLevel?:number;defaulted:boolean;players:string[]}
export type LineupPlan={courts:LineupCourt[];notes:string;location:string;directions:string;arrivalTime:string;teamNotes:string}
export type LineupEditorData={ok:true;scope:{teamName:string;leagueName:string;flight:string};match:{id:string;date:string;opponent:string};version:string;sent:boolean;roster:LineupPlayer[];plan:LineupPlan}
export const lineupRecord=(v:unknown):Record<string,unknown>=>v && typeof v==='object' && !Array.isArray(v)?v as Record<string,unknown>:{}
function bounded(v:unknown,max:number){if(typeof v!=='string'||v.length>max)throw Error('Check the lineup details.');return v.trim()}
/** Strict native write contract. Player keys are roster identities, never assumed player UUIDs. */
export function readLineupPlan(value:unknown,roster:LineupPlayer[]):LineupPlan{
 const row=lineupRecord(value),seen=new Set<string>(),ids=new Set<string>()
 if(!Array.isArray(row.courts)||!row.courts.length||row.courts.length>30)throw Error('Choose between 1 and 30 courts.')
 const courts=row.courts.map(value=>{
  const court=lineupRecord(value),id=bounded(court.id,120),label=bounded(court.label,120)
  if(!id||!label||ids.has(id)||!['singles','doubles'].includes(String(court.slotType))||typeof court.defaulted!=='boolean')throw Error('Check the court labels and formats.')
  ids.add(id);const slotType=court.slotType as 'singles'|'doubles',count=slotType==='doubles'?2:1
  if(!Array.isArray(court.players)||court.players.length!==count)throw Error('Check the court assignments.')
  const players=court.players.map(value=>{const key=bounded(value,120);if(key&&(!roster.some(p=>p.key===key)||seen.has(key)))throw Error('Choose each roster player only once.');if(key)seen.add(key);return key})
  if(court.defaulted&&players.some(Boolean))throw Error('Remove players before defaulting a court.')
  if(court.ratingLevel!==undefined&&(typeof court.ratingLevel!=='number'||!Number.isFinite(court.ratingLevel)||court.ratingLevel<1||court.ratingLevel>10))throw Error('Check the court rating.')
  return {id,label,slotType,defaulted:court.defaulted,players,...(court.ratingLevel!==undefined?{ratingLevel:court.ratingLevel as number}:{})}
 })
 return {courts,notes:bounded(row.notes,1200),location:bounded(row.location,240),directions:bounded(row.directions,600),arrivalTime:bounded(row.arrivalTime,80),teamNotes:bounded(row.teamNotes,1200)}
}
