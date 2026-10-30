import {lineupRecord} from './native-captain-lineup-contract'
import {readOfficeSnapshot,type OfficeSnapshot} from './native-league-office-contract'
export type CompetitionScope='discover'|'mine'
export type CompetitionConnection={leagueId:string;kind:'player'|'team'|'organizer';status:'active'|'pending'}
export type CompetitionSnapshot=OfficeSnapshot&{scope:CompetitionScope;query:string;connections:CompetitionConnection[];moreConnections:boolean}
export function competitionInput(scope:string,query:string,selected:string){
 if(!['discover','mine'].includes(scope)||query.length>80||selected.length>80||selected&&!/^[a-zA-Z0-9_-]+$/.test(selected))throw Error('Invalid competition selection')
 return {scope:scope as CompetitionScope,query:query.trim().replace(/\s+/g,' '),selected}
}
export function readCompetitionSnapshot(value:unknown,owner:string,scope:CompetitionScope,query:string,selected:string):CompetitionSnapshot{
 const r=lineupRecord(value),base=readOfficeSnapshot(r,owner,selected)
 if(r.scope!==scope||r.query!==query||!Array.isArray(r.connections)||r.connections.length>100||typeof r.moreConnections!=='boolean')throw Error('Competition context changed')
 for(const l of base.leagues){try{new Intl.DateTimeFormat('en',{timeZone:l.timeZone})}catch{throw Error('Invalid league time zone')}}
 if(base.detail?.participants.some(p=>p.status!=='active'))throw Error('Unapproved public entry')
 const seen=new Set<string>(),connections=r.connections.map(value=>{const c=lineupRecord(value)
  if(typeof c.leagueId!=='string'||!base.leagues.some(l=>l.id===c.leagueId)||!['player','team','organizer'].includes(String(c.kind))||!['active','pending'].includes(String(c.status)))throw Error('Invalid competition entry')
  const key=c.leagueId+':'+c.kind+':'+c.status;if(seen.has(key))throw Error('Ambiguous competition entry');seen.add(key)
  return {leagueId:c.leagueId,kind:c.kind as CompetitionConnection['kind'],status:c.status as CompetitionConnection['status']}
 })
 return {...base,scope,query,connections,moreConnections:r.moreConnections}
}
