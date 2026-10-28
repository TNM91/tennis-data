import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {TeamScope} from './team-room-data'
import {parseTeamFixture} from './team-fixtures-data'
import {fixtureId} from '../../lib/team-fixtures-contract'
import type {AvailabilityReview,AvailabilityRequest} from '../../lib/native-availability-contract'
export type {AvailabilityReview,AvailabilityRequest}
export class AvailabilityRequestError extends Error{constructor(public conflict=false){super('Availability request not confirmed.')}}
export type AvailabilitySend=(method:'GET'|'POST',options:HttpOptions)=>Promise<HttpResponse>
const transport:AvailabilitySend=(method,options)=>method==='GET'?CapacitorHttp.get(options):CapacitorHttp.post(options)
async function session(client:SupabaseClient,owner:string,current:()=>boolean){const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==owner||!current())throw new AvailabilityRequestError(true);return data.session}
function envelope(value:unknown,owner:string,scope:TeamScope){const r=value as Partial<AvailabilityReview>&{publicationId?:string;fixtureId?:string;messageId?:string};if(!r||r.ok!==true||r.owner!==owner||r.scope?.teamName!==scope.teamName||r.scope.leagueName!==scope.leagueName||r.scope.flight!==scope.flight)throw new AvailabilityRequestError();return r}
export async function readAvailabilityReview(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,id:string,send:AvailabilitySend=transport):Promise<AvailabilityReview>{
 if(!fixtureId(id))throw new AvailabilityRequestError(true)
 const auth=await session(client,owner,current),r=await send('GET',{url:'https://www.tenaceiq.com/api/mobile/captain/availability?'+new URLSearchParams({team:scope.teamName,league:scope.leagueName,flight:scope.flight,fixture:id}),headers:{Authorization:'Bearer '+auth.access_token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:20000});await session(client,owner,current)
 if(r.status!==200)throw new AvailabilityRequestError([400,401,403,404,409].includes(r.status))
 const value=envelope(r.data,owner,scope),fixture=parseTeamFixture(value.fixture,scope)
 if(fixture.id!==id||typeof value.token!=='string'||!/^[a-f0-9]{64}$/.test(value.token)||!Array.isArray(value.roster)||value.roster.length>250||value.roster.some(n=>typeof n!=='string'||!n.trim()||n.length>120)||typeof value.existingCardId!=='string'||value.existingCardId!==''&&!fixtureId(value.existingCardId)||typeof value.canPost!=='boolean'||typeof value.reason!=='string'||value.reason.length>300||value.canPost&&(!!value.existingCardId||!!value.reason))throw new AvailabilityRequestError()
 return {ok:true,owner,scope:{teamName:scope.teamName,leagueName:scope.leagueName,flight:scope.flight},fixture,token:value.token,roster:[...value.roster],existingCardId:value.existingCardId,canPost:value.canPost,reason:value.reason}
}
export function freezeAvailabilityRequest(review:AvailabilityReview,id:string):AvailabilityRequest{if(!review.canPost||review.existingCardId||!fixtureId(id))throw new AvailabilityRequestError(true);return Object.freeze({fixtureId:review.fixture.id,publicationId:id,expectedCardToken:review.token})}
export async function sendAvailabilityRequest(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,a:AvailabilityRequest,lookup=false,send:AvailabilitySend=transport){
 const auth=await session(client,owner,current),r=await send('POST',{url:'https://www.tenaceiq.com/api/team-rooms',headers:{Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000,data:{teamName:scope.teamName,leagueName:scope.leagueName,flight:scope.flight,action:'publish_native_availability',nativeClient:true,...a,lookup}});await session(client,owner,current)
 if(r.status!==200)throw new AvailabilityRequestError([400,401,403,409].includes(r.status))
 const value=envelope(r.data,owner,scope);if(value.publicationId!==a.publicationId||value.fixtureId!==a.fixtureId||!fixtureId(value.messageId))throw new AvailabilityRequestError();return value.messageId
}
