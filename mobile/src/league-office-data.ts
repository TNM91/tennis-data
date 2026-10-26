import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner,type ScenarioSend} from './captain-scenarios-data'
import {readOfficeSnapshot} from '../../lib/native-league-office-contract'
export async function loadLeagueOffice(client:SupabaseClient,owner:string,current:()=>boolean,selected='',send:ScenarioSend=o=>CapacitorHttp.get(o)){
 const session=await scenarioOwner(client,owner,current),r=await send({url:'https://www.tenaceiq.com/api/mobile/league-office'+(selected?'?'+new URLSearchParams({league:selected}):''),headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000});await scenarioOwner(client,owner,current)
 if(r.status!==200)throw Error(r.status===403?'League Office access is required for your account.':'League Office is unavailable. Check your connection and try again.')
 return readOfficeSnapshot(r.data,owner,selected)
}
