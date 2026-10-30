import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner,type ScenarioSend} from './captain-scenarios-data'
import {competitionInput,readCompetitionSnapshot,type CompetitionScope} from '../../lib/native-competitions-contract'
export async function loadCompetitions(client:SupabaseClient,owner:string,current:()=>boolean,scope:CompetitionScope,query='',selected='',send:ScenarioSend=o=>CapacitorHttp.get(o)){
 const input=competitionInput(scope,query,selected),session=await scenarioOwner(client,owner,current)
 const p=new URLSearchParams({scope,q:input.query});if(selected)p.set('league',selected)
 const r=await send({url:'https://www.tenaceiq.com/api/mobile/competitions?'+p,headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})
 await scenarioOwner(client,owner,current)
 if(r.status!==200)throw Error(r.status===401?'Sign in again to open Competitions.':'Competitions are unavailable. Check your connection and try again.')
 return readCompetitionSnapshot(r.data,owner,scope,input.query,selected)
}
