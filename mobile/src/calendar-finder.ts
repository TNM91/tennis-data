import type {NativeCalendar} from '../../lib/native-calendar-contract'
import {calendarOccurrences} from './calendar-data'

const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ')

/** Index only calendar labels and event identities already available to this account. */
export function createCalendarFinder(calendar:NativeCalendar){
 const entries=calendarOccurrences(calendar),competitions=new Map(calendar.competitions.map(e=>[e.id,e])),practices=new Map((calendar.practices||[]).map(e=>[e.id,e]))
 const indexed=entries.map(entry=>{
  const competition=entry.source==='competition'?competitions.get(entry.id):undefined,practice=entry.source==='team'?practices.get(entry.id):undefined
  return {entry,fields:[entry.title,entry.location,entry.kind,entry.source==='team'?'Team practice':entry.source==='coach'?'Coach':entry.source==='personal'?'Personal':'Competition',competition?.competitionName||'',competition?.opponent||'',practice?.scope.teamName||'',practice?.scope.leagueName||'',practice?.scope.flight||''].map(normalize)}
 })
 return {entries,find(query:string){const term=normalize(query.slice(0,160));return term?indexed.filter(row=>row.fields.some(field=>field.includes(term))).map(row=>row.entry):entries}}
}
