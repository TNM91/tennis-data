import type {NativeCalendar} from '../../lib/native-calendar-contract'
import {calendarOccurrences} from './calendar-data'

const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ')

/** Index only calendar labels and event identities already available to this account. */
export function createCalendarFinder(calendar:NativeCalendar){
 const entries=calendarOccurrences(calendar),competitions=new Map(calendar.competitions.map(e=>[e.id,e])),practices=new Map((calendar.practices||[]).map(e=>[e.id,e]))
 const teamMatches=new Map((calendar.teamMatches||[]).map(e=>[e.roomId,e]))
 const indexed=entries.map(entry=>{
  const competition=entry.source==='competition'?competitions.get(entry.id):undefined,practice=entry.source==='team'?practices.get(entry.id):undefined
  const team=entry.source==='team'?(entry.kind==='match'?teamMatches.get(entry.id)?.scope:practice?.scope):undefined
  const matchDetail=entry.source==='team'&&entry.kind==='match'?entry.detail:''
  const hittingLabels=entry.hittingPlan||entry.chatHit?[entry.detail,entry.readiness]:[]
  const sourceName={coach:'Coach',personal:'Personal',competition:'Competition',chat:'Chat',team:entry.kind==='match'?'Team match':'Team practice'}
  return {entry,fields:[entry.title,entry.location,entry.kind,matchDetail,sourceName[entry.source],competition?.competitionName||'',competition?.opponent||'',team?.teamName||'',team?.leagueName||'',team?.flight||'',...hittingLabels].map(normalize)}
 })
 return {entries,find(query:string){const term=normalize(query.slice(0,160));return term?indexed.filter(row=>row.fields.some(field=>field.includes(term))).map(row=>row.entry):entries}}
}
