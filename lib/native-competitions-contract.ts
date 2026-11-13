import {lineupRecord} from './native-captain-lineup-contract'
import {readOfficeSnapshot,type OfficeSnapshot} from './native-league-office-contract'
export type CompetitionScope='discover'|'mine'
export const publicCompetitionOwner='public-competitions'
export type CompetitionConnection={leagueId:string;kind:'player'|'team'|'organizer';status:'active'|'pending'|'rejected'|'removed'}
export type CompetitionSnapshot=OfficeSnapshot&{scope:CompetitionScope;query:string;connections:CompetitionConnection[];moreConnections:boolean;detailsUnderReview?:true;canReviewEntries?:true}
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
  if(typeof c.leagueId!=='string'||!base.leagues.some(l=>l.id===c.leagueId)||!['player','team','organizer'].includes(String(c.kind))||!['active','pending','rejected','removed'].includes(String(c.status))||c.kind==='organizer'&&c.status!=='active')throw Error('Invalid competition entry')
  const key=c.leagueId+':'+c.kind+':'+c.status;if(seen.has(key))throw Error('Ambiguous competition entry');seen.add(key)
  return {leagueId:c.leagueId,kind:c.kind as CompetitionConnection['kind'],status:c.status as CompetitionConnection['status']}
 })
 if(r.detailsUnderReview===true&&(!base.detail||base.detail.participants.length||base.detail.fixtures.length||
   base.detail.results.length||base.detail.standings.length||base.detail.standingsAvailable))throw Error('Unreviewed league details')
 if(r.canReviewEntries===true&&(!selected||owner===publicCompetitionOwner||!connections.some(c=>c.leagueId===selected&&c.kind==='organizer')))throw Error('League review access changed')
 return {...base,scope,query,connections,moreConnections:r.moreConnections,
  ...(r.detailsUnderReview===true?{detailsUnderReview:true as const}:{}),...(r.canReviewEntries===true?{canReviewEntries:true as const}:{})}
}
