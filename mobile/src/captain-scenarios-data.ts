import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {TeamScope} from './team-room-data'
import type {CaptainMatch} from './captain-data'
import {parseLineupEditor} from './captain-lineup-data'
import {scenarioRatings,scenarioBaselineSignature,scenarioSeed,type CaptainScenarioContext} from '../../lib/native-captain-scenario-contract'
import {readLineupPlan,type LineupPlan} from '../../lib/native-captain-lineup-contract'
export type ScenarioSend=(options:HttpOptions)=>Promise<HttpResponse>
export async function scenarioOwner(client:SupabaseClient,owner:string,current:()=>boolean){const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==owner||!current())throw Error('Sign in again to compare lineups.');return data.session}
export async function loadCaptainScenarios(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,match:CaptainMatch,send:ScenarioSend=o=>CapacitorHttp.get(o)):Promise<CaptainScenarioContext>{
 const session=await scenarioOwner(client,owner,current),r=await send({url:'https://www.tenaceiq.com/api/mobile/captain/scenarios?'+new URLSearchParams({team:scope.teamName,league:scope.leagueName,flight:scope.flight,match:match.id}),headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000});await scenarioOwner(client,owner,current)
 const raw=r.data as {ok?:boolean;owner?:string;lineup?:{ok?:boolean};ratings?:unknown;checkedAt?:string}
 if(r.status!==200||raw?.ok!==true||raw.owner!==owner||raw.lineup?.ok!==true||typeof raw.checkedAt!=='string'||raw.checkedAt.length>80||!Number.isFinite(Date.parse(raw.checkedAt)))throw Error('Scenario context unavailable.')
 const lineup=parseLineupEditor(raw.lineup,scope,match.id)
 if(lineup.match.date!==match.date||lineup.match.opponent!==match.opponent||lineup.version!==''&&!Number.isFinite(Date.parse(lineup.version)))throw Error('The fixture or saved plan changed.')
 readLineupPlan(lineup.plan,lineup.roster)
 return {owner,lineup,ratings:scenarioRatings(raw.ratings,lineup.roster),checkedAt:raw.checkedAt}
}
export async function reviewedScenarioHandoff(ctx:CaptainScenarioContext,plan:LineupPlan,load:()=>Promise<CaptainScenarioContext>,current:()=>boolean){
 const fresh=await load();if(!current()||fresh.owner!==ctx.owner||scenarioBaselineSignature(fresh.lineup)!==scenarioBaselineSignature(ctx.lineup))throw Error('The saved plan, fixture or roster changed. Refresh your alternatives before using them.')
 if(JSON.stringify(fresh.ratings)!==JSON.stringify(ctx.ratings))return {ready:false as const,context:fresh}
 return {ready:true as const,context:fresh,seed:scenarioSeed(fresh,plan)}
}
