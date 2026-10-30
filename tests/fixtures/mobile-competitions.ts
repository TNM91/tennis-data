import {openLeagueOffice} from '../../mobile/src/league-office-view'
import {decisionReviewFixture} from './league-decisions-data'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {ScenarioSend} from '../../mobile/src/captain-scenarios-data'
import {entryReviewFixture} from './league-entry-data'
import {openCompetitions} from '../../mobile/src/competitions-view'
import {labActionsHtml} from '../../mobile/src/lab-home'
import {competitionOwner as owner,competitionSnapshot,competitionDetail,competitionPlayerDetail} from './competitions-data'
const mode=new URLSearchParams(location.search).get('view')||'team'
const state={playerWithdrawn:false,playerReordered:false,teamWithdrawn:false,teamReordered:false,finderChanged:false,calls:0,offline:false,delay:false,active:true,owner,decisionPosts:0,decisionSaved:false,decisionInformation:false,decisionLostReply:false,decisionConflict:false,entryInformation:false,entryQuestionChanged:false,entryPosts:0,entrySaved:false,entryLostReply:false,entryClosed:false,entryAllowed:true,entryChanged:false,release:null as null|(()=>void)}
function detailForFinder(){
 const d=mode.includes('player')?competitionPlayerDetail():competitionDetail();if(mode.includes('player')){
  if(mode.includes('long')){const name='Alex '+('Championship'.repeat(18));d.participants[0].name=name;for(const row of [...d.fixtures,...d.results]){if(row.a==='Alex Server')row.a=name;if(row.b==='Alex Server')row.b=name;if('winner' in row&&row.winner==='Alex Server')row.winner=name}}
  if(mode.includes('partial')){d.moreFixtures=true;d.moreResults=true}
  if(mode.includes('history')){d.participants.push(...Array.from({length:30},(_,i)=>({name:'Player '+(i+1),status:'active'})));d.fixtures.push(...Array.from({length:20},(_,i)=>({...d.fixtures[0],id:'history-date-'+i})));d.results.push(...Array.from({length:20},(_,i)=>({...d.results[0],id:'history-result-'+i})))}
  if(state.playerReordered)d.participants.reverse()
  if(state.playerWithdrawn)d.participants=d.participants.filter(p=>p.name!=='Alex Server')
 }if(mode.includes('evidence')){
  d.fixtures.push({...d.fixtures[0],id:'similar-team',a:'Baseline Aces B',b:'Other team',date:'2026-11-08'});d.results.push({...d.results[0],id:'similar-result',a:'Baseline Aces B',b:'Other team',courts:[{...d.results[0].courts[0],a:'Baseline Aces'}]})
  if(mode.includes('long')){const name='Baseline '+('Championship'.repeat(18));for(const r of [...d.standings])if(r.teamName==='Baseline Aces')r.teamName=name;for(const r of d.participants)if(r.name==='Baseline Aces')r.name=name;for(const r of [...d.fixtures,...d.results]){if(r.a==='Baseline Aces')r.a=name;if('winner' in r&&r.winner==='Baseline Aces')r.winner=name}}
  if(mode.includes('history')){d.standings.push(...Array.from({length:30},(_,i)=>({...d.standings[0],teamName:'Team '+(i+1)})));d.participants.push(...Array.from({length:30},(_,i)=>({name:'Team '+(i+1),status:'active'})));d.fixtures.push(...Array.from({length:20},(_,i)=>({...d.fixtures[0],id:'history-date-'+i})));d.results.push(...Array.from({length:20},(_,i)=>({...d.results[0],id:'history-result-'+i})))}
  if(state.teamReordered){d.standings.reverse();d.participants.reverse()}
  if(state.teamWithdrawn){d.standings=d.standings.filter(s=>s.teamName!=='Baseline Aces');d.participants=d.participants.filter(p=>p.name!=='Baseline Aces')}
  if(mode.includes('partial')){d.moreFixtures=true;d.moreResults=true;d.standingsAvailable=false;d.standings=[]}
 }if(mode.includes('empty')){d.fixtures=[];d.results=[]}if(!mode.includes('finder'))return d
 d.fixtures.push({...d.fixtures[0],id:'fixture-other',date:'2026-11-08',a:'Spin Masters',b:'Court Kings',status:'proposed'})
 d.results.push({...d.results[0],id:'event-later',date:'2026-10-24',a:'Spin Masters',b:'Court Kings',winner:'Court Kings',courts:[{label:'Line 1 · Singles',a:'Morgan',b:'Taylor',winner:'Side B',score:'7-5, 6-4'}]},{...d.results[0],id:'event-unrecorded',date:'2026-10-25',winner:'',courts:[]})
 if(mode.includes('long')){d.fixtures[0].a='Baseline '+('Championship'.repeat(18));d.results[0].courts[0].a='Alex '+('Server'.repeat(35))}
 if(state.finderChanged){d.fixtures[0].date='2026-11-09';d.results[0].date='2026-10-26'}
 return d
}
const client={auth:{getSession:async()=>({data:{session:{user:{id:state.owner},access_token:'fixture-only'}}})}} as unknown as SupabaseClient
const send:ScenarioSend=async options=>{
 state.calls++
 if(new URL(options.url).pathname.endsWith('/league-office/entries')){
  const review=decisionReviewFixture();if(mode==='office-team'){review.format='team';review.entries[0].name='North Aces'}if(mode==='office-long'){review.leagueName='Northside '+('Championship '.repeat(14));review.entries[0].name='Alex '+('Server '.repeat(20))}if(mode==='office-ineligible')review.entries[0].eligibility='ineligible';if(mode==='office-closed')review.open=false
  if(options.method==='POST'){state.decisionPosts++;if(state.decisionConflict)return {status:409,data:{message:'This entry changed. Refresh requests before deciding.'},headers:{},url:options.url};const data=options.data as {decision:string;note:string};state.decisionSaved=true;state.decisionInformation=data.decision==='information';const receipt={...review.entries[0],status:data.decision==='information'?'pending':data.decision,actionRequired:state.decisionInformation,requestNote:state.decisionInformation?data.note:''};if(state.decisionLostReply)throw Error('Lost reply');if(state.delay)await new Promise<void>(resolve=>{state.release=resolve});return {status:200,data:{ok:true,owner,leagueId:'league-one',receipt,notified:true},headers:{},url:options.url}}
  if(state.decisionSaved){if(state.decisionInformation){review.entries[0].actionRequired=true;review.entries[0].requestNote='Please confirm your age division.'}else review.entries=[]}
  if(state.delay)await new Promise<void>(resolve=>{state.release=resolve});return {status:state.offline?503:200,data:{ok:true,...review},headers:{},url:options.url}
 }
 if(new URL(options.url).pathname.endsWith('/league-office')){
  const league={...detailForFinder().league,name:'Northside 4.0'},detail={...detailForFinder(),league,participants:mode.includes('evidence')||mode.includes('player')?detailForFinder().participants:[{name:'Alex Server',status:state.decisionSaved?'active':'pending'}],moreParticipants:false};return {status:200,data:{ok:true,owner,checkedAt:'2026-10-30T05:40:00Z',leagues:[league],moreLeagues:false,detail:new URL(options.url).searchParams.get('league')?detail:null},headers:{},url:options.url}
 }
 if(new URL(options.url).pathname.endsWith('/entry')){
  const review=entryReviewFixture();review.owner=owner;if(mode==='entry-information')state.entryInformation=true;review.open=!state.entryClosed;review.allowed=state.entryAllowed;if(state.entryChanged){review.review='b'.repeat(64);review.requirement.ageDivision='55 & Over'}
  if(mode==='entry-team'){review.format='team';review.player={...review.player,id:'',name:'',rating:null};review.blockedReason='Team entry requires active League access.'}
  if(mode==='entry-long'){review.leagueName='Northside '+('Championship '.repeat(14));review.player.name='Alex '+('Server '.repeat(20))}
  if(options.method==='POST'){state.entryPosts++;state.entrySaved=true;if(state.entryLostReply)throw Error('Lost reply')}
  if(state.entryInformation)review.receipts=[{id:'11111111-1111-4111-8111-111111111111',name:review.player.name,status:'pending',information:{updatedAt:state.entryQuestionChanged?'2026-10-30T05:41:00Z':'2026-10-30T05:40:00Z',note:state.entryQuestionChanged?'Please reconfirm your rating and age division.':'Please confirm your age division.'}}]
  if(state.entrySaved)review.receipts=[{id:'saved-entry',name:review.player.name||'North Aces',status:'pending'}]
  const r={status:state.offline?503:200,data:options.method==='POST'?{ok:true,owner,leagueId:'league-one',receipt:review.receipts[0],alreadySubmitted:false}:{ok:true,...review},headers:{},url:options.url}
  if(state.delay)await new Promise<void>(resolve=>{state.release=resolve})
  return r
 }
 const p=new URL(options.url).searchParams,snapshot=competitionSnapshot()
 snapshot.scope=p.get('scope')==='mine'?'mine':'discover';snapshot.query=p.get('q')||''
 if(snapshot.scope==='discover')snapshot.connections=[]
 if(snapshot.query==='nothing')snapshot.leagues=[]
 if(mode.includes('finder'))snapshot.leagues.push({...snapshot.leagues[0],id:'league-two',name:'Second season'})
 if(p.get('league')){snapshot.detail=detailForFinder();if(p.get('league')==='league-two')snapshot.detail.league={...snapshot.leagues[1]}}
 if(mode==='long'){snapshot.leagues[0].name='Northside'+('Championship'.repeat(15));if(snapshot.detail)snapshot.detail.league.name=snapshot.leagues[0].name}
 if(mode==='incomplete'&&snapshot.detail){snapshot.detail.moreResults=true;snapshot.detail.standingsAvailable=false;snapshot.detail.standings=[]}
 if(mode.includes('player')){snapshot.leagues[0]={...snapshot.leagues[0],name:'Northside Singles Ladder',format:'individual'};snapshot.connections=snapshot.connections.map(c=>({...c,kind:'player' as const}))}
 if(mode==='individual'){snapshot.leagues[0].format='individual';if(snapshot.detail){snapshot.detail.league.format='individual';snapshot.detail.standingsAvailable=false;snapshot.detail.standings=[]}}
 const r={status:state.offline?503:200,data:state.offline?{ok:false}:{ok:true,...snapshot},headers:{},url:options.url}
 if(state.delay)await new Promise<void>(resolve=>{state.release=resolve})
 return r
}
document.querySelector('#app')!.innerHTML='<h1>My Lab</h1>'+labActionsHtml()
let view:ReturnType<typeof openCompetitions>|null=null
document.querySelector<HTMLButtonElement>('[data-lab-screen="competitions"]')!.onclick=()=>{state.active=true;view=openCompetitions(client,owner,()=>state.active,'mine',undefined,send,document.querySelector<HTMLElement>('[data-lab-screen="competitions"]')!)}
Object.assign(window,{competitionFixture:{state,dispose:()=>view?.dispose(),back:()=>view?.back()}})

if(mode.startsWith('office')){document.querySelector('#app')!.innerHTML='<h1>My Lab</h1><button type="button" data-office-open>Open League Office</button>';document.querySelector<HTMLButtonElement>('[data-office-open]')!.onclick=()=>{state.active=true;const office=openLeagueOffice(client,owner,()=>state.active,send);Object.assign(window,{officeFixture:{dispose:()=>office.dispose(),back:()=>office.back()}})}}
