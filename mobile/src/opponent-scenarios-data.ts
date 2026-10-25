import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {TeamScope} from './team-room-data'
import type {CaptainMatch} from './captain-data'
import {scenarioOwner} from './captain-scenarios-data'
import {parseCaptainCourtScout} from './captain-court-scout-data'
import {opponentScenarioRatings,type OpponentScenarioContext} from '../../lib/native-opponent-scenario-contract'
export async function loadOpponentScenarios(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,match:CaptainMatch,send:(o:HttpOptions)=>Promise<HttpResponse>=o=>CapacitorHttp.get(o)):Promise<OpponentScenarioContext>{
 const session=await scenarioOwner(client,owner,current),r=await send({url:'https://www.tenaceiq.com/api/mobile/captain/opponent-scenarios?'+new URLSearchParams({team:scope.teamName,league:scope.leagueName,flight:scope.flight,match:match.id}),headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000});await scenarioOwner(client,owner,current)
 if(r.status!==200)throw Error('Opponent assumptions unavailable.');const ctx=parseCaptainCourtScout(r.data,owner,scope,match);return {...ctx,ratings:opponentScenarioRatings((r.data as {ratings?:unknown}).ratings,ctx)}
}
