import type {SupabaseClient} from '@supabase/supabase-js'
import type {ScenarioSend} from '../../mobile/src/captain-scenarios-data'
import {openCompetitions} from '../../mobile/src/competitions-view'
import {labActionsHtml} from '../../mobile/src/lab-home'
import {competitionOwner as owner,competitionSnapshot,competitionDetail} from './competitions-data'
const mode=new URLSearchParams(location.search).get('view')||'team'
const state={calls:0,offline:false,delay:false,active:true,owner,release:null as null|(()=>void)}
const client={auth:{getSession:async()=>({data:{session:{user:{id:state.owner},access_token:'fixture-only'}}})}} as unknown as SupabaseClient
const send:ScenarioSend=async options=>{
 state.calls++;const p=new URL(options.url).searchParams,snapshot=competitionSnapshot()
 snapshot.scope=p.get('scope')==='mine'?'mine':'discover';snapshot.query=p.get('q')||''
 if(snapshot.scope==='discover')snapshot.connections=[]
 if(snapshot.query==='nothing')snapshot.leagues=[]
 if(p.get('league'))snapshot.detail=competitionDetail()
 if(mode==='long'){snapshot.leagues[0].name='Northside'+('Championship'.repeat(15));if(snapshot.detail)snapshot.detail.league.name=snapshot.leagues[0].name}
 if(mode==='incomplete'&&snapshot.detail){snapshot.detail.moreResults=true;snapshot.detail.standingsAvailable=false;snapshot.detail.standings=[]}
 if(mode==='individual'){snapshot.leagues[0].format='individual';if(snapshot.detail){snapshot.detail.league.format='individual';snapshot.detail.standingsAvailable=false;snapshot.detail.standings=[]}}
 const r={status:state.offline?503:200,data:state.offline?{ok:false}:{ok:true,...snapshot},headers:{},url:options.url}
 if(state.delay)await new Promise<void>(resolve=>{state.release=resolve})
 return r
}
document.querySelector('#app')!.innerHTML='<h1>My Lab</h1>'+labActionsHtml()
let view:ReturnType<typeof openCompetitions>|null=null
document.querySelector<HTMLButtonElement>('[data-lab-screen="competitions"]')!.onclick=()=>{state.active=true;view=openCompetitions(client,owner,()=>state.active,'mine',undefined,send,document.querySelector<HTMLElement>('[data-lab-screen="competitions"]')!)}
Object.assign(window,{competitionFixture:{state,dispose:()=>view?.dispose()}})
