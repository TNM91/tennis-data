import type {TeamCourtRecord} from './team-court-records-data'
export type CourtFilters={format:'all'|'singles'|'doubles';year:string;result:'all'|'W'|'L';query:string}
export type CourtRecordGroup={key:string;label:string;played:number;wins:number;losses:number;singles:number;doubles:number}
export function filterTeamCourts(records:TeamCourtRecord[],filters:CourtFilters){
 const term=filters.query.trim().toLocaleLowerCase()
 return records.filter(row=>(filters.format==='all'||row.format===filters.format)&&(filters.year==='all'||row.date.slice(0,4)===filters.year)&&(filters.result==='all'||row.result===filters.result)&&(!term||[row.opponent,row.score,...(row.players??[]).map(player=>player.name)].some(value=>value.toLocaleLowerCase().includes(term))))
}
export function teamCourtGroups(records:TeamCourtRecord[],kind:'players'|'opponents'){
 const groups=new Map<string,CourtRecordGroup>()
 for(const row of records){
  const entries=kind==='opponents'?[{id:row.opponent,name:row.opponent}]:row.players??[]
  for(const entry of entries){
   const group=groups.get(entry.id)??{key:entry.id,label:entry.name,played:0,wins:0,losses:0,singles:0,doubles:0}
   group.played++;if(row.result==='W')group.wins++;else group.losses++;group[row.format]++;groups.set(entry.id,group)
  }
 }
 return [...groups.values()].sort((a,b)=>b.played-a.played||b.wins-a.wins||a.key.localeCompare(b.key))
}
