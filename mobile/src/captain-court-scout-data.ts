import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {TeamScope} from './team-room-data'
import type {CaptainMatch} from './captain-data'
import {scenarioOwner} from './captain-scenarios-data'
import {readCourtScoutRecords,type CourtScoutContext} from '../../lib/native-captain-court-scout-contract'
import {fixtureDate,fixtureWindow} from '../../lib/team-fixtures-contract'
export async function loadCaptainCourtScout(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,match:CaptainMatch,send:(o:HttpOptions)=>Promise<HttpResponse>=o=>CapacitorHttp.get(o)):Promise<CourtScoutContext>{
 const session=await scenarioOwner(client,owner,current),r=await send({url:'https://www.tenaceiq.com/api/mobile/captain/court-scout?'+new URLSearchParams({team:scope.teamName,league:scope.leagueName,flight:scope.flight,match:match.id}),headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000});await scenarioOwner(client,owner,current)
 if(r.status!==200)throw Error('Court scouting context changed.');return parseCaptainCourtScout(r.data,owner,scope,match)
}
export function parseCaptainCourtScout(value:unknown,owner:string,scope:TeamScope,match:CaptainMatch):CourtScoutContext{
 const v=value as CourtScoutContext&{ok?:boolean};if(v?.ok!==true||v.owner!==owner||v.scope?.teamName!==scope.teamName||v.scope?.leagueName!==scope.leagueName||v.scope?.flight!==scope.flight||v.match?.id!==match.id||v.match.date!==match.date||v.match.opponent!==match.opponent||!fixtureDate(v.before)||v.before>match.date||!fixtureDate(v.from)||v.from!==fixtureWindow(v.before).from||typeof v.checkedAt!=='string'||v.checkedAt.length>80||!Number.isFinite(Date.parse(v.checkedAt))||typeof v.limited!=='boolean')throw Error('Court scouting context changed.')
 return {owner,scope:{...scope},match:{id:match.id,date:match.date,opponent:match.opponent},before:v.before,from:v.from,checkedAt:v.checkedAt,limited:v.limited,records:readCourtScoutRecords(v.records,scope,match.opponent,v.from,v.before)}
}
