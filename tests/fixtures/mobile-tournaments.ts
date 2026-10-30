import type {SupabaseClient} from '@supabase/supabase-js'
import type {ScenarioSend} from '../../mobile/src/captain-scenarios-data'
import {openCompetitions} from '../../mobile/src/competitions-view'
import {competitionSnapshot} from './competitions-data'
import type {TournamentEntryReceipt} from '../../lib/native-tournament-entry-contract'
import {tournamentEntrySnapshot,tournamentReceipt} from './native-tournament-entry'
import {tournamentOwner as owner,tournamentSnapshot} from './native-tournaments'
const mode=new URL(location.href).searchParams.get('view')||''
const state={owner,active:true,offline:false,delay:false,calls:0,entryPosts:0,entrySaved:false,entryLostReply:false,entryConflict:false,decisionSaved:false,declined:false,release:()=>{}}
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
  else if(state.entrySaved)s.receipt=receipt
  data={ok:true,...s}
 }else if(u.pathname.endsWith('/tournaments')){
  const s=tournamentSnapshot(u.searchParams.get('tournament')||'',u.searchParams.get('division')||'');s.query=u.searchParams.get('q')||''
  if(mode==='long'){s.tournaments[0].name='NorthsideChampionship'.repeat(12);if(s.detail){s.detail.root.name=s.tournaments[0].name;s.detail.divisions[0].name='DoublesDivision'.repeat(15);if(s.detail.active)s.detail.active.name=s.detail.divisions[0].name;s.detail.matches.forEach(m=>{m.a='AlexServe'.repeat(25);if(m.winner)m.winner=m.a;m.court='Court'.repeat(25)});s.detail.standings.forEach(r=>{r.name='AlexServe'.repeat(25)})}}
  if(mode==='limited'&&s.detail?.active){s.detail.drawNotice='This draw exceeds the app’s current display limit. No partial standings are shown.';s.detail.matches=[];s.detail.standings=[];s.detail.entrants=0}
  if(mode==='empty')s.tournaments=[]
  data={ok:true,...s}
 }else{const s=competitionSnapshot();s.owner=owner;data={ok:true,...s}}
 return {status:200,data,headers:{},url:o.url}
}
document.querySelector('#app')!.innerHTML='<h1>My Lab</h1><button type="button" id="open">Your competitions</button>'
let panel:ReturnType<typeof openCompetitions>|null=null
document.querySelector<HTMLButtonElement>('#open')!.onclick=()=>{panel=openCompetitions(client,owner,()=>state.active,'mine',undefined,send)}
Object.assign(window,{tournamentFixture:{state,back:()=>panel?.back(),dispose:()=>panel?.dispose()}})
