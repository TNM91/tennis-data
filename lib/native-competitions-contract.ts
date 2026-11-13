import {lineupRecord} from './native-captain-lineup-contract'
import {readOfficeResult,readOfficeSnapshot,type OfficeFixture,type OfficeResult,type OfficeSnapshot} from './native-league-office-contract'
import type {TiqTeamStandingRow} from './tiq-team-standings'
import {readScheduledLeagueMatch} from './native-league-schedule-contract'
import {testflightLeagueScoreId} from './testflight-league-scores'
import {courtAccountId} from './native-court-result-contract'
import {readLeagueAttention,type LeagueAttentionRow} from './native-league-attention-contract'
export type CompetitionScope='discover'|'mine'
export const publicCompetitionOwner='public-competitions'
export type CompetitionConnection={leagueId:string;kind:'player'|'team'|'organizer';status:'active'|'pending'|'rejected'|'removed'}
export type LeagueMatchDayRow={id:string;action:'enter'|'fix'|'pending'|'review'}|{id:string;action:'result';resultId:string}
export type CompetitionSnapshot=OfficeSnapshot&{scope:CompetitionScope;query:string;connections:CompetitionConnection[];moreConnections:boolean;detailsUnderReview?:true;canReviewEntries?:true;canScheduleMatches?:true;publishedSchedule?:OfficeFixture[];canOpenLeagueScores?:true;scoreReviewDemo?:true;approvedScores?:{results:OfficeResult[];standings:TiqTeamStandingRow[]};matchDay?:{matches:LeagueMatchDayRow[];pendingReviews?:number};attention?:LeagueAttentionRow[]}
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
 if((r.canReviewEntries===true||r.canScheduleMatches===true)&&(!selected||owner===publicCompetitionOwner||!connections.some(c=>c.leagueId===selected&&c.kind==='organizer')))throw Error('League organizer access changed')
 let publishedSchedule:OfficeFixture[]|undefined
 if(r.publishedSchedule!==undefined){
  if(!selected||r.detailsUnderReview!==true||!Array.isArray(r.publishedSchedule)||r.publishedSchedule.length>100)throw Error('Invalid published schedule')
  publishedSchedule=r.publishedSchedule.map(value=>{
   const {id,date,time,facility,a,b,status}=readScheduledLeagueMatch({...lineupRecord(value),court:'',duration:null})
   if(status!=='coordinator_set')throw Error('Invalid published match')
   return {id,date,time,facility,a,b,status}
  })
  if(new Set(publishedSchedule.map(match=>match.id)).size!==publishedSchedule.length)throw Error('Ambiguous published match')
 }
 let approvedScores:CompetitionSnapshot['approvedScores']
 if(r.approvedScores!==undefined){
  if(!base.detail||base.detail.league.format!=='team'||r.detailsUnderReview!==true)throw Error('Invalid league results')
  const approved=lineupRecord(r.approvedScores)
  const detail=readOfficeSnapshot({...r,detail:{...base.detail,results:approved.results,standings:approved.standings,standingsAvailable:true}},owner,selected).detail
  if(!detail)throw Error('Invalid league standings')
  approvedScores={results:detail.results.map(readOfficeResult),standings:detail.standings}
 }
 if(r.canOpenLeagueScores===true&&(!selected||owner===publicCompetitionOwner||base.detail?.league.format!=='team'))throw Error('Invalid score review access')
 if(r.scoreReviewDemo===true&&(!selected||selected!==testflightLeagueScoreId(owner)||r.canOpenLeagueScores!==true||
    r.canScheduleMatches===true||r.canReviewEntries===true||!connections.some(c=>c.leagueId===selected&&c.kind==='organizer')))throw Error('TestFlight league context changed')
 let matchDay:CompetitionSnapshot['matchDay']
 if(r.matchDay!==undefined){
  const source=lineupRecord(r.matchDay),canReview=r.canReviewEntries===true||r.scoreReviewDemo===true
  if(!base.detail||base.detail.league.format!=='team'||!Array.isArray(source.matches)||source.matches.length>100)throw Error('Invalid Match Day')
  const fixtures=new Map((publishedSchedule??base.detail.fixtures).map(f=>[f.id,f]))
  const results=new Map((approvedScores?.results??base.detail.results).map(result=>[result.id,result]))
  const ids=new Set<string>()
  const matches=source.matches.map((value):LeagueMatchDayRow=>{
   const m=lineupRecord(value),f=courtAccountId(m.id)?fixtures.get(m.id):undefined,a=m.action
   if(!f||ids.has(f.id)||!['confirmed','coordinator_set','completed'].includes(f.status))throw Error('Invalid Match Day match')
   ids.add(f.id)
   if(a==='result'){
    const result=typeof m.resultId==='string'?results.get(m.resultId):undefined
    if(!result||result.a!==f.a||result.b!==f.b||result.date!==f.date)throw Error('Unavailable Match Day result')
    return {id:f.id,action:a,resultId:result.id}
   }
   if(r.canOpenLeagueScores!==true||!['enter','fix','pending','review'].includes(String(a))||a==='review'&&!canReview)throw Error('Invalid Match Day action')
   return {id:f.id,action:a as 'enter'|'fix'|'pending'|'review'}
  })
  const count=source.pendingReviews
  const tally=matches.filter(m=>m.action==='review').length
  if(count!==undefined&&(!canReview||count!==tally)||tally>0&&count===undefined)throw Error('Invalid score review count')
  matchDay={matches,...(typeof count==='number'?{pendingReviews:count}:{})}
 }
 let attention:LeagueAttentionRow[]|undefined
 if(r.attention!==undefined){
  if(!base.detail||base.detail.league.format!=='team'||r.canOpenLeagueScores!==true||
    r.canReviewEntries!==true&&r.scoreReviewDemo!==true)throw Error('League follow-up access changed')
  attention=readLeagueAttention(r.attention,new Map((publishedSchedule??base.detail.fixtures).map(f=>[f.id,f])))
 }
 return {...base,scope,query,connections,moreConnections:r.moreConnections,
  ...(approvedScores?{approvedScores}:{}),
  ...(r.canOpenLeagueScores===true?{canOpenLeagueScores:true as const}:{}),
  ...(r.scoreReviewDemo===true?{scoreReviewDemo:true as const}:{}),
  ...(matchDay?{matchDay}:{}),
  ...(attention?{attention}:{}),
  ...(r.canScheduleMatches===true?{canScheduleMatches:true as const}:{}),
  ...(publishedSchedule?{publishedSchedule}:{}),
  ...(r.detailsUnderReview===true?{detailsUnderReview:true as const}:{}),...(r.canReviewEntries===true?{canReviewEntries:true as const}:{})}
}
