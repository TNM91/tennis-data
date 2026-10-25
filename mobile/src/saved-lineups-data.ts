import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner,type ScenarioSend} from './captain-scenarios-data'
import {scenarioBaselineSignature,type CaptainScenarioContext} from '../../lib/native-captain-scenario-contract'
import {readSavedLineups} from '../../lib/native-saved-lineups-contract'
import {lineupRecord} from '../../lib/native-captain-lineup-contract'
export async function loadSavedLineups(client:SupabaseClient,owner:string,current:()=>boolean,ctx:CaptainScenarioContext,send:ScenarioSend=o=>CapacitorHttp.get(o)){
 const session=await scenarioOwner(client,owner,current),scope=ctx.lineup.scope,match=ctx.lineup.match,r=await send({url:'https://www.tenaceiq.com/api/mobile/captain/saved-lineups?'+new URLSearchParams({team:scope.teamName,league:scope.leagueName,flight:scope.flight,match:match.id}),headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000});await scenarioOwner(client,owner,current)
 const raw=lineupRecord(r.data),s=lineupRecord(raw.scope),m=lineupRecord(raw.match)
 if(r.status!==200||raw.ok!==true||raw.owner!==owner||ctx.owner!==owner||raw.baseline!==scenarioBaselineSignature(ctx.lineup)||s.teamName!==scope.teamName||s.leagueName!==scope.leagueName||s.flight!==scope.flight||m.id!==match.id||m.date!==match.date||m.opponent!==match.opponent||typeof raw.more!=='boolean'||typeof raw.checkedAt!=='string'||raw.checkedAt.length>80||!Number.isFinite(Date.parse(raw.checkedAt)))throw Error('Saved library unavailable or the working plan changed. Refresh comparison.')
 return {rows:readSavedLineups(raw.rows),more:raw.more,checkedAt:raw.checkedAt}
}
