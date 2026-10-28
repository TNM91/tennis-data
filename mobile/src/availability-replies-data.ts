import type {SupabaseClient} from '@supabase/supabase-js'
import {CapacitorHttp,type HttpOptions,type HttpResponse} from '@capacitor/core'
import type {TeamScope} from './team-room-data'
import {fixtureId} from '../../lib/team-fixtures-contract'
import {availabilityReplyGroups,type AvailabilityReplies} from '../../lib/native-availability-replies-contract'
export type {AvailabilityReplies}
export function parseAvailabilityReplies(value:unknown,owner:string,scope:TeamScope,id:string):AvailabilityReplies{
 const r=value as AvailabilityReplies
 if(!r||r.ok!==true||r.owner!==owner||r.messageId!==id||r.scope?.teamName!==scope.teamName||r.scope.leagueName!==scope.leagueName||r.scope.flight!==scope.flight||typeof r.matchDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.matchDate)||!Number.isFinite(Date.parse(r.matchDate+'T12:00:00Z'))||typeof r.opponent!=='string'||r.opponent.length>160||typeof r.checkedAt!=='string'||!Number.isFinite(Date.parse(r.checkedAt))||!r.groups)throw Error('Invalid match replies')
 let total=0
 for(const key of availabilityReplyGroups){const list=r.groups[key];if(!Array.isArray(list)||list.some(n=>typeof n!=='string'||!n.trim()||n.length>120))throw Error('Invalid match replies');total+=list.length}
 if(total>250)throw Error('Invalid match replies')
 return {ok:true,owner,scope:{teamName:scope.teamName,leagueName:scope.leagueName,flight:scope.flight},messageId:id,matchDate:r.matchDate,opponent:r.opponent,checkedAt:r.checkedAt,groups:{yes:[...r.groups.yes],maybe:[...r.groups.maybe],no:[...r.groups.no],waiting:[...r.groups.waiting]}}
}
export async function readAvailabilityReplies(client:SupabaseClient,owner:string,current:()=>boolean,scope:TeamScope,id:string,send:(options:HttpOptions)=>Promise<HttpResponse>=options=>CapacitorHttp.get(options)){
 if(scope.chatRoomId||!fixtureId(id))throw Error('Choose a shared match in General')
 const session=async()=>{const {data,error}=await client.auth.getSession();if(error||data.session?.user.id!==owner||!current())throw Error('Captain access changed');return data.session}
 const auth=await session(),response=await send({url:'https://www.tenaceiq.com/api/mobile/captain/availability-replies?'+new URLSearchParams({team:scope.teamName,league:scope.leagueName,flight:scope.flight,message:id}),headers:{Authorization:'Bearer '+auth.access_token,'Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:20000})
 await session();if(response.status!==200)throw Error('Match replies unavailable')
 return parseAvailabilityReplies(response.data,owner,scope,id)
}
