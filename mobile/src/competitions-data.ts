import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner,type ScenarioSend} from './captain-scenarios-data'
import {competitionInput,publicCompetitionOwner,readCompetitionSnapshot,type CompetitionScope} from '../../lib/native-competitions-contract'
import {firstPartyBuild} from './build-scope'
export async function loadCompetitions(client:SupabaseClient,owner:string,current:()=>boolean,scope:CompetitionScope,query='',selected='',send:ScenarioSend=o=>CapacitorHttp.get(o)){
 const input=competitionInput(scope,query,selected)
 const guest=firstPartyBuild&&owner===publicCompetitionOwner
 if(guest&&(scope!=='discover'||!current()))throw Error('Competition context changed')
 const session=guest?null:await scenarioOwner(client,owner,current)
 const p=new URLSearchParams({scope,q:input.query});if(selected)p.set('league',selected)
 if(guest)p.set('audience','public')
 if(firstPartyBuild&&selected)p.set('overview','1')
 const endpoint=firstPartyBuild?'/api/mobile/first-party/competitions':'/api/mobile/competitions'
 const r=await send({url:'https://www.tenaceiq.com'+endpoint+'?'+p,headers:{...(session?{Authorization:'Bearer '+session.access_token}:{}),...(firstPartyBuild?{'X-TenAceIQ-League-Score':'2'}:{}),'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})
 if(!current())throw Error('Competition context changed')
 if(!guest)await scenarioOwner(client,owner,current)
 if(r.status!==200||(firstPartyBuild&&r.data?.releaseScope!=='first-party'))throw Error(r.status===401?'Sign in again to open Competitions.':'Competitions are unavailable. Check your connection and try again.')
 return readCompetitionSnapshot(r.data,owner,scope,input.query,selected)
}
