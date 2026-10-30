import type {SupabaseClient} from '@supabase/supabase-js'
import type {ScenarioSend} from '../../mobile/src/captain-scenarios-data'
import {openCompetitions} from '../../mobile/src/competitions-view'
import {competitionSnapshot} from './competitions-data'
import {tournamentOwner as owner,tournamentSnapshot,tournamentSummary} from './native-tournaments'
const mode=new URL(location.href).searchParams.get('view')||''
const state={owner,active:true,offline:false,delay:false,calls:0,removeEntrant:false,prependStanding:false,removeGroup:false,withholdDraw:false,release:()=>{}}
const client={auth:{getSession:async()=>({data:{session:{user:{id:state.owner},access_token:'fixture-only'}}})}} as unknown as SupabaseClient
const send:ScenarioSend=async o=>{
 state.calls++;if(state.delay)await new Promise<void>(resolve=>{state.release=resolve});if(state.offline)throw Error('Offline')
 const u=new URL(o.url);let data:unknown
 if(u.pathname.endsWith('/tournaments')){
  const s=tournamentSnapshot(u.searchParams.get('tournament')||'',u.searchParams.get('division')||'');s.query=u.searchParams.get('q')||''
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
  if(mode==='empty')s.tournaments=[]
  data={ok:true,...s}
 }else{const s=competitionSnapshot();s.owner=owner;data={ok:true,...s}}
 return {status:200,data,headers:{},url:o.url}
}
document.querySelector('#app')!.innerHTML='<h1>My Lab</h1><button type="button" id="open">Your competitions</button>'
let panel:ReturnType<typeof openCompetitions>|null=null
document.querySelector<HTMLButtonElement>('#open')!.onclick=()=>{panel=openCompetitions(client,owner,()=>state.active,'mine',undefined,send)}
Object.assign(window,{tournamentFixture:{state,back:()=>panel?.back(),dispose:()=>panel?.dispose()}})
