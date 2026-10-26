import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner,type ScenarioSend} from './captain-scenarios-data'
import {readNamedLineupRequest,type NamedLineupRequest} from '../../lib/native-named-lineup-contract'
import {lineupRecord} from '../../lib/native-captain-lineup-contract'
export async function saveNamedLineup(client:SupabaseClient,owner:string,current:()=>boolean,request:NamedLineupRequest,send:ScenarioSend=o=>CapacitorHttp.post(o)){
 const body=readNamedLineupRequest(request),session=await scenarioOwner(client,owner,current),r=await send({url:'https://www.tenaceiq.com/api/mobile/captain/saved-lineups',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},data:body,webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000});await scenarioOwner(client,owner,current)
 const value=lineupRecord(r.data);if(r.status!==200||value.ok!==true||value.id!==body.id||value.name!==body.name||typeof value.replayed!=='boolean')throw Object.assign(Error(r.status===409?'The name, fixture, working plan or saved record changed. Close and review a new save.':r.status===403?'Captain save access is unavailable. Check your account and library before trying again.':'Save could not be confirmed. Check or retry the same save before creating another.'),{status:r.status})
 return {id:body.id,name:body.name,replayed:value.replayed}
}
