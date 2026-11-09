import type {SupabaseClient} from '@supabase/supabase-js'
import type {ScenarioSend} from '../../mobile/src/captain-scenarios-data'
import {openCompetitions} from '../../mobile/src/competitions-view'
import {competitionSnapshot} from './competitions-data'
import type {TournamentEntryReceipt} from '../../lib/native-tournament-entry-contract'
import {tournamentEntrySnapshot,tournamentReceipt} from './native-tournament-entry'
import {tournamentOwner as owner,tournamentSnapshot,tournamentSummary} from './native-tournaments'
const mode=new URL(location.href).searchParams.get('view')||''
const state={owner,active:true,offline:false,delay:false,calls:0,entryPosts:0,entrySaved:false,entryLostReply:false,entryConflict:false,decisionSaved:false,declined:false,removeEntrant:false,prependStanding:false,removeGroup:false,withholdDraw:false,reorderCards:false,release:()=>{}}
const pass={entry:'approved',court:'1',date:'2026-11-15',time:'10:00',drawUnavailable:false,knockout:false,calendarMissing:false,calendarReads:0,calendarWrites:0,divisionVenue:'',divisionAddress:''}
const originalFetch=window.fetch.bind(window)
window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href)
 if(url.origin!=='https://www.tenaceiq.com'||!['/api/mobile/calendar','/api/mobile/calendar/practices'].includes(url.pathname))return originalFetch(input,init)
 if(init?.method&&init.method!=='GET'){pass.calendarWrites++;return Response.json({ok:false},{status:405})}
 const range={from:url.searchParams.get('from')!,to:url.searchParams.get('to')!}
 if(url.pathname.endsWith('/practices'))return Response.json({ok:true,owner:state.owner,range,practices:[]})
 pass.calendarReads++
 const match={id:'tournament:division-one:r2-m1',kind:'tournament',eventType:'match',competitionId:'division-one',competitionName:'4.0 Doubles',title:'4.0 Doubles: vs Jordan Serve',date:pass.date,time:pass.time,
  location:`Northside Tennis Center · Court ${pass.court}`,opponent:'Jordan Serve',detail:`Round 2 · Court ${pass.court}`,href:'',status:'Scheduled',responseStatus:'',responseUpdatedAt:'',responseIsStale:false,
  publishedView:{id:'event-one',divisionId:'division-one'},
 }
 const other={...match,id:'tournament:division-one:r3-m3',opponent:'Someone Else',title:'4.0 Doubles: vs Someone Else'}
 const competitions=[...(pass.calendarMissing?[]:[match]),other].filter(item=>item.date>=range.from&&item.date<=range.to)
 return Response.json({ok:true,owner:state.owner,range,personal:[],competitions,coach:[],warnings:[]})
}
const client={auth:{getSession:async()=>({data:{session:{user:{id:state.owner},access_token:'fixture-only'}}})}} as unknown as SupabaseClient
const send:ScenarioSend=async o=>{
 state.calls++;if(state.delay)await new Promise<void>(resolve=>{state.release=resolve});if(state.offline)throw Error('Offline')
 const u=new URL(o.url);let data:unknown
 if(u.pathname.endsWith('/tournaments/entry')){
  const s=tournamentEntrySnapshot();if(mode==='entry-manager'||mode==='entry-manager-long')s.context.canManage=true
  if(mode==='entry-manager-long'){s.context.name='ChampionshipDivision'.repeat(10);s.context.playerName='AlexServer'.repeat(8)}
  if(mode==='entry-director'){s.context.mode='director';s.context.director='director@example.test'}
  if(mode==='entry-closed')s.context.mode='closed'
  if(mode==='entry-singles')s.context.paired=false
  const receipt:TournamentEntryReceipt=tournamentReceipt()
  if(o.method==='POST'){state.entryPosts++;if(state.entryConflict)return {status:409,data:{message:'The division changed. Refresh registration.'},headers:{},url:o.url};const a=o.data as {action:string;data:{decision?:string}};if(a.action==='decide'){state.decisionSaved=true;state.declined=a.data.decision==='decline';receipt.status=(state.declined?'declined':'approved');receipt.inDraw=!state.declined}else state.entrySaved=true;s.receipt=receipt;if(state.entryLostReply)throw Error('Lost reply');return {status:200,data:{ok:true,...s,alreadySubmitted:false},headers:{},url:o.url}}
  if(u.searchParams.get('organizer')==='1'){s.queue=state.decisionSaved?[]:[receipt];if(mode==='entry-manager-long')s.queue[0].name='AlexServer'.repeat(8)+' / '+'SamReturn'.repeat(8)}
  else if(mode==='event-pass')s.receipt={...receipt,status:pass.entry==='pending'?'pending':'approved',inDraw:pass.entry==='approved'}
  else if(state.entrySaved)s.receipt=receipt
  data={ok:true,...s}
 }else if(u.pathname.endsWith('/tournaments')){
  const s=tournamentSnapshot(u.searchParams.get('tournament')||'',u.searchParams.get('division')||'');s.query=u.searchParams.get('q')||''
  if(mode==='registration-deadlines'){
   const event=s.tournaments[0]
   event.status='open'
   event.details.registrationClosesOn='2026-11-12'
   if(s.detail){
    const division=s.detail.divisions[0]
    division.status='open'
    division.details.registrationClosesOn='2026-11-13'
   }else{
    s.tournaments.push(
     {...event,id:'closed',name:'Southside Open',registrationClosed:true},
     {...event,id:'scheduled',name:'Eastside Open',status:'scheduled'},
     {...event,id:'undated',name:'Westside Open',details:{}},
    )
   }
  }
  if(mode==='division-comparison'&&s.detail){
   const doubles=s.detail.divisions[0]
   doubles.entrantType='teams'
   const singles={...tournamentSummary('division-two','event-one'),name:'3.5 Singles',format:'single_elimination',formatLabel:'Single elimination',date:'2026-11-15',location:'Westside Courts'}
   s.detail.divisions.push(singles)
   if(s.detail.active)s.detail.active=s.division===singles.id?singles:doubles
  }
  if(mode==='event-pass'&&s.detail?.active){
   if(pass.drawUnavailable)throw Error('Draw unavailable')
   const d=s.detail,entrant=tournamentReceipt().name
   d.root.details.venueName='Northside Tennis Center'
   d.root.details.venueAddress='123 Center Court'
   d.active!.details.venueName=pass.divisionVenue
   d.active!.details.venueAddress=pass.divisionAddress
   d.active!.details.timeZone=undefined
   const [result,next]=d.matches
   d.matches=[{...result,a:entrant,winner:entrant},{...next,a:entrant,date:pass.time?pass.date:'',court:pass.court,time:pass.time},
    {...next,id:'other-player',a:entrant+' Jr',b:'Unrelated Player'}]
   if(pass.knockout){
    d.active!.format='single_elimination'
    d.matches.push({...next,id:'r3-m1',a:entrant,b:'Winner R2.2',label:'Final',round:3,date:'2026-11-16',court:'9'})
   }
  }
  if(mode==='browse-return'&&!s.division){
   const parent=s.detail?.root.id||'',cards=s.detail?s.detail.divisions:s.tournaments
   const others=Array.from({length:6},(_,index)=>({...tournamentSummary('extra-'+index,parent),name:(parent?'Division ':'Open ')+(index+1)}))
   cards.splice(0,0,...others.slice(0,5))
   cards.splice(state.reorderCards?5:6,0,others[5])
  }
  if(mode==='long'){s.tournaments[0].name='NorthsideChampionship'.repeat(12);if(s.detail){s.detail.root.name=s.tournaments[0].name;s.detail.divisions[0].name='DoublesDivision'.repeat(15);if(s.detail.active)s.detail.active.name=s.detail.divisions[0].name;s.detail.matches.forEach(m=>{m.a='AlexServe'.repeat(25);if(m.winner)m.winner=m.a;m.court='Court'.repeat(25)});s.detail.standings.forEach(r=>{r.name='AlexServe'.repeat(25)})}}
  if(mode.startsWith('standings')&&s.detail){
   if(mode==='standings-divisions')s.detail.divisions.push({...tournamentSummary('division-two','event-one'),name:'Second flight'})
   if(s.detail.active){const d=s.detail,base={...d.standings[0],group:'Pool A'},unplayed={...base,played:0,wins:0,losses:0,gamesWon:0,gamesLost:0,gameDiff:0,winPct:0};d.standings=[base,{...base,group:'Pool B',wins:0,losses:1,gamesWon:7,gamesLost:12,gameDiff:-5,winPct:0},{...unplayed,name:'Jordan Serve'},{...base,name:'Casey Court',group:''},{...base,name:'Alex Ace Jr',group:'Pool B'}];d.entrants=4
    if(mode.includes('history')){d.standings.push(...Array.from({length:20},(_,i)=>({...unplayed,name:'Player '+i})));d.entrants+=20}
    if(mode.includes('long')){const name='AlexServe'.repeat(25),group='Pool '+('Championship'.repeat(35));d.standings[0].name=name;for(const row of d.standings)if(row.group==='Pool A')row.group=group;for(const row of d.matches){if(row.a==='Alex Ace')row.a=name;if(row.winner==='Alex Ace')row.winner=name}}
    if(state.removeGroup)d.standings=d.standings.filter(row=>row.group!=='Pool A')
    if(d.active?.id==='division-two')for(const row of d.standings)if(row.group==='Pool A')row.group='Pool C'
    if(mode.includes('history')&&state.prependStanding){d.standings.unshift(...Array.from({length:20},(_,i)=>({...unplayed,name:'New entry '+i})));d.entrants+=20}
   }
  }
  if(s.detail?.active){if(state.removeEntrant)s.detail.standings=[];else if(state.prependStanding&&!mode.includes('history'))s.detail.standings.unshift({...s.detail.standings[0],name:'Casey Court',wins:0,losses:1,winPct:0,gamesWon:7,gamesLost:12,gameDiff:-5})}
  if((mode==='limited'||state.withholdDraw)&&s.detail?.active){s.detail.drawNotice='This draw exceeds the app’s current display limit. No partial standings are shown.';s.detail.matches=[];s.detail.standings=[];s.detail.entrants=0}
  if(mode==='empty'||!s.selected&&s.query==='nothing')s.tournaments=[]
  data={ok:true,...s}
 }else{const s=competitionSnapshot();s.owner=owner;data={ok:true,...s}}
 return {status:200,data,headers:{},url:o.url}
}
document.querySelector('#app')!.innerHTML='<h1>My Lab</h1><button type="button" id="open">Your competitions</button>'
let panel:ReturnType<typeof openCompetitions>|null=null
document.querySelector<HTMLButtonElement>('#open')!.onclick=()=>{panel=openCompetitions(client,owner,()=>state.active,'mine',undefined,send)}
Object.assign(window,{tournamentFixture:{state,pass,back:()=>panel?.back(),dispose:()=>panel?.dispose()}})
