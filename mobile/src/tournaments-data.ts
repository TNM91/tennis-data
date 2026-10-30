import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner,type ScenarioSend} from './captain-scenarios-data'
import {tournamentInput,readTournamentSnapshot} from '../../lib/native-tournaments-contract'
export async function loadTournaments(client:SupabaseClient,owner:string,current:()=>boolean,query='',selected='',division='',send:ScenarioSend=o=>CapacitorHttp.get(o)){
 const input=tournamentInput(query,selected,division),session=await scenarioOwner(client,owner,current),p=new URLSearchParams({q:input.query})
 if(selected)p.set('tournament',selected);if(division)p.set('division',division)
 const r=await send({url:'https://www.tenaceiq.com/api/mobile/tournaments?'+p,headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})
 await scenarioOwner(client,owner,current)
 if(r.status!==200)throw Error('Tournaments unavailable')
 return readTournamentSnapshot(r.data,owner,input.query,selected,division)
}
