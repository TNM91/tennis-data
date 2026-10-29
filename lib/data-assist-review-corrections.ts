import {parseLineLabel} from './data-assist-import'
import {inferLeagueAgeDivision,inferMixedPairRole} from './player-eligibility'
import {withExtensionScoreMetadata} from './data-assist-scorecard-parser'
import type {DataAssistScorecardParsedDraft} from './data-assist-ocr'
import type {DataAssistTeamSummaryParsedDraft} from './data-assist-team-summary-parser'

export type ImportReviewEdits = Record<string,string>
export type ImportReviewSource = {
 kind:'scorecard'|'team_summary'
 fields:Record<string,string>
 rows:Array<Record<string,string>>
}
export type ImportReviewAddedRows = Array<Record<string,string>>
export type ImportReviewCorrection = {base:ImportReviewSource;edits:ImportReviewEdits;addedRows?:ImportReviewAddedRows}
// Native HTTP bridges may reorder object keys. Array order and all values remain significant.
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)
const invalid=()=>Error('Check the corrected details against your source file.')
const record=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw invalid();return v as Record<string,unknown>}
const text=(v:unknown,max=500)=>{if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b-\x1f\x7f]/.test(v))throw invalid();return v}
const players=(v:unknown)=>{if(!Array.isArray(v)||v.length>2)throw invalid();return v.map(p=>text(p,160)).join('\n')}
/** A bounded editing projection. Never send raw OCR, contacts or storage paths to the editor. */
export function importReviewSource(value:unknown):ImportReviewSource|undefined{
 try{
  const p=record(value)
  if(p.draftKind==='team_summary'){
   if(!Array.isArray(p.players)||!p.players.length||p.players.length>100||p.playerCount!==p.players.length)return
   return {kind:'team_summary',fields:{rosterTeamName:text(p.rosterTeamName),leagueName:text(p.leagueName),flight:text(p.flight)},rows:p.players.map(v=>{const r=record(v);if(r.ntrp!==null&&(typeof r.ntrp!=='number'||!Number.isFinite(r.ntrp)||r.ntrp<1||r.ntrp>7))throw invalid();return {name:text(r.name,160),teamName:text(r.teamName),ntrp:r.ntrp===null?'':String(r.ntrp)}})}
  }
  if(p.draftKind&&p.draftKind!=='scorecard'||p.matches||p.players||!Array.isArray(p.lines)||!p.lines.length||p.lines.length>10||p.lineCount!==p.lines.length)return
  return {kind:'scorecard',fields:{externalMatchId:text(p.externalMatchId),matchDate:text(p.matchDate),homeTeam:text(p.homeTeam),awayTeam:text(p.awayTeam)},rows:p.lines.map(v=>{const r=record(v);return {lineLabel:text(r.lineLabel,80),homePlayers:players(r.homePlayers),awayPlayers:players(r.awayPlayers),score:text(r.score,160),winner:text(r.winner,20)}})}
 }catch{return}
}
export function importReviewValues(base:ImportReviewSource,edits:ImportReviewEdits,addedRows:ImportReviewAddedRows=[]):ImportReviewSource{
 if(!Array.isArray(addedRows)||base.rows.length+addedRows.length>(base.kind==='scorecard'?10:100))throw invalid()
 const keys=base.kind==='scorecard'?['lineLabel','homePlayers','awayPlayers','score','winner']:['name','teamName','ntrp']
 const additions=addedRows.map(value=>{const row=record(value);if(Object.keys(row).length!==keys.length||keys.some(k=>!Object.hasOwn(row,k)))throw invalid();return Object.fromEntries(keys.map(k=>[k,text(row[k])]))})
 const fields={...base.fields},rows=[...base.rows,...additions].map(r=>({...r}))
 for(const [key,value] of Object.entries(edits)){
  if(typeof value!=='string'||value.length>500)throw invalid()
  if(Object.hasOwn(fields,key)){fields[key]=value;continue}
  const m=/^rows\.(0|[1-9]\d*)\.([a-zA-Z]+)$/.exec(key),row=m?rows[Number(m[1])]:undefined
  if(!row||!m||!Object.hasOwn(row,m[2])||m[2]==='lineLabel'&&Number(m[1])<base.rows.length)throw invalid()
  row[m[2]]=value
 }
 return {...base,fields,rows}
}
function required(v:string,label:string,max=500){const result=text(v,max).trim();if(!result||/[\r\n\t]/.test(result))throw Error('Check '+label+'.');return result}
function checkedPlayers(v:string,count:number){const names=v.split(/\r?\n/).map(n=>n.trim()).filter(Boolean);if(names.length!==count||new Set(names.map(n=>n.toLowerCase())).size!==count)throw Error('Enter '+count+' different player name'+(count===1?'':'s')+' on each side, one per line.');return names.map(n=>required(n,'player names',160))}
function checkedDate(value:string){
 const m=/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/.exec(value)||null
 const iso=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(value)
 const y=Number(iso?.[1]||m?.[3]),month=Number(iso?.[2]||m?.[1]),day=Number(iso?.[3]||m?.[2]),d=new Date(Date.UTC(y,month-1,day))
 if(!Number.isFinite(d.valueOf())||d.getUTCFullYear()!==y||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)throw Error('Choose a valid match date between 2000 and 2099.')
 return `${month}/${day}/${y}`
}
export function importReviewProblem(base:ImportReviewSource,edits:ImportReviewEdits,addedRows:ImportReviewAddedRows=[]):string{
 try{validateValues(importReviewValues(base,edits,addedRows));return ''}catch(e){return e instanceof Error?e.message:'Check the corrected details.'}
}
function validateValues(value:ImportReviewSource){
 const {fields,rows}=value
 for(const [key,v] of Object.entries(fields))if(key!=='flight')required(v,key.replace(/([A-Z])/g,' $1').toLowerCase())
 if(value.kind==='scorecard'){
  if(!/^\d{10}$/.test(fields.externalMatchId.trim()))throw Error('Enter the 10-digit match ID from the scorecard.')
  checkedDate(fields.matchDate.trim())
  if(fields.homeTeam.trim().toLowerCase()===fields.awayTeam.trim().toLowerCase())throw Error('Home and visiting teams must be different.')
  const courts=new Set<string>()
  for(const [index,row] of rows.entries()){
   const identity=parseLineLabel(row.lineLabel,index),key=String(identity.lineNumber)
   if(courts.has(key))throw Error('Each saved court position must appear once. Check the court numbers in Data Assist if the source repeats a number.');courts.add(key)
   if(!/singles|doubles/i.test(row.lineLabel))throw Error('This court type needs review in Data Assist.')
   const count=/doubles/i.test(row.lineLabel)?2:1,home=checkedPlayers(row.homePlayers,count),away=checkedPlayers(row.awayPlayers,count)
   if(new Set([...home,...away].map(n=>n.toLowerCase())).size!==count*2)throw Error('A player cannot appear on both sides of a court.')
   const score=required(row.score,'the court score',160)
   if(!/^(?:(?:\d{1,2}\s*[-–]\s*\d{1,2}(?:\s*[([]\d{1,3}[)\]])?\s*){1,5}(?:retired|ret\.?|default|def\.?|walkover|w\/?o|timed|time limit)?|retired|default|walkover|w\/?o)$/i.test(score))throw Error('Use the court score shown in your source file, such as 6-4 6-3.')
   if(!['home','away'].includes(row.winner))throw Error('Choose the winning team for every court.')
  }
 }else{
  const names=new Set<string>()
  for(const row of rows){const name=required(row.name,'player names',160).toLowerCase();if(names.has(name))throw Error('Each player must appear once in this roster.');names.add(name);required(row.teamName||fields.rosterTeamName,'the player team');if(!/^[1-7](?:\.[05])?$/.test(row.ntrp.trim())||Number(row.ntrp)>7)throw Error('Choose the recorded NTRP for every player.')}
 }
}
/** Apply allowlisted changes to the stored draft, preserving private fields and parser provenance. */
export function applyImportReviewCorrection(stored:unknown,correction:unknown):DataAssistScorecardParsedDraft|DataAssistTeamSummaryParsedDraft{
 const body=record(correction),base=importReviewSource(stored)
 if(Object.keys(body).some(k=>!['base','edits','addedRows'].includes(k))||!base||canonical(base)!==canonical(body.base))throw Error('This saved draft changed. Refresh it and review the latest values.')
 const edits=record(body.edits) as ImportReviewEdits
 if(Object.keys(edits).length>510)throw invalid()
 const additions=(body.addedRows??[]) as ImportReviewAddedRows
 const value=importReviewValues(base,edits,additions);validateValues(value)
 if(base.kind==='scorecard'&&value.rows.slice(base.rows.length).some(row=>! /^(?:[1-9]|10) (Singles|Doubles)$/.test(row.lineLabel)))throw Error('Choose a court number and type for each added court.')
 if(base.kind==='scorecard'){
  const p=stored as DataAssistScorecardParsedDraft
  return {...p,...Object.fromEntries(Object.entries(value.fields).map(([k,v])=>[k,v.trim()])),matchDate:checkedDate(value.fields.matchDate.trim()),lineCount:value.rows.length,lines:value.rows.map((row,i)=>{
   const line=p.lines[i]??{lineLabel:row.lineLabel,ntrp:null,homePlayers:[],awayPlayers:[],score:'',winner:'unknown',confidenceScore:0,parseNotes:['Court added from source file by uploader.']}
   const changedScore=row.score.trim()!==line.score||row.winner!==line.winner
   // Score and winner are explicitly checked by the uploader. Never retain stale set metadata.
   const updated={...line,homePlayers:checkedPlayers(row.homePlayers,/doubles/i.test(row.lineLabel)?2:1),awayPlayers:checkedPlayers(row.awayPlayers,/doubles/i.test(row.lineLabel)?2:1),score:row.score.trim(),winner:row.winner,...(changedScore?{winnerSource:'winner_column' as const}: {})}
   if(!changedScore)return updated
   const metadata=withExtensionScoreMetadata(updated)
   return {...metadata,score:row.score.trim(),parseNotes:Array.from(new Set([...(line.parseNotes||[]),...(metadata.parseNotes||[]),'Score and winner confirmed by uploader.']))}
  })}
 }
 const p=stored as DataAssistTeamSummaryParsedDraft
 // Contact details stay private and unchanged. A unique matching name follows its roster correction.
 if(new Set(base.rows.map(row=>row.name.trim().toLowerCase())).size!==base.rows.length)throw Error('Repeated player names need review in Data Assist.')
 const contextChanged=value.fields.leagueName.trim()!==base.fields.leagueName.trim()||value.fields.flight.trim()!==base.fields.flight.trim()
 const context=contextChanged?{mixedPairRole:inferMixedPairRole(value.fields.leagueName,value.fields.flight),ageDivision:inferLeagueAgeDivision(value.fields.leagueName,value.fields.flight)}:{}
 const names=new Map(base.rows.map((row,i)=>[row.name,value.rows[i].name.trim()]))
 return {...p,...Object.fromEntries(Object.entries(value.fields).map(([k,v])=>[k,v.trim()])),playerCount:value.rows.length,players:value.rows.map((row,i)=>({...p.players[i],...context,...(!p.players[i]?{ratingSource:'self' as const,mixedPairRole:inferMixedPairRole(value.fields.leagueName,value.fields.flight),ageDivision:inferLeagueAgeDivision(value.fields.leagueName,value.fields.flight)}:{}),name:value.rows[i].name.trim(),teamName:(value.rows[i].teamName||value.fields.rosterTeamName).trim(),ntrp:Number(value.rows[i].ntrp),...(value.rows[i].ntrp!==base.rows[i]?.ntrp?{ratingSource:'self' as const}:{})})),contacts:p.contacts?.map(contact=>({...contact,name:names.get(contact.name)||contact.name}))}
}
