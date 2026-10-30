import {CapacitorHttp,type HttpResponse} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner,type ScenarioSend} from './captain-scenarios-data'
import {entryLeague,entryDraft,readEntryReview,readEntryReceipt,type EntryDraft,type EntryReview} from '../../lib/native-league-entry-contract'
export async function leagueEntryRequest(client:SupabaseClient,owner:string,current:()=>boolean,leagueId:string,submission?:{review:EntryReview;draft:EntryDraft},send:ScenarioSend=o=>CapacitorHttp.request(o)){
 entryLeague(leagueId);const session=await scenarioOwner(client,owner,current)
 const body=submission?{leagueId,review:submission.review.review,draft:entryDraft(submission.draft)}:undefined
 if(submission&&(submission.review.owner!==owner||submission.review.leagueId!==leagueId))throw Error('Entry account changed')
 let r:HttpResponse
 try{r=await send({method:body?'POST':'GET',url:'https://www.tenaceiq.com/api/mobile/competitions/entry'+(body?'':'?'+new URLSearchParams({league:leagueId})),headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store',...(body?{'Content-Type':'application/json'}:{})},...(body?{data:body}:{}),webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:60000})}catch{throw Error(body?'Your request could not be confirmed. Check entry status before trying again.':'Entry status is unavailable. Check your connection and try again.')}
 await scenarioOwner(client,owner,current)
 if(r.status!==200){const data=r.data as {message?:unknown};throw Error([400,403,409].includes(r.status)&&typeof data?.message==='string'&&data.message.length<=600?data.message:body?'Your request could not be confirmed. Check entry status before trying again.':'Entry status is unavailable. Check your connection and try again.')}
 if(!body)return {kind:'review' as const,review:readEntryReview(r.data,owner,leagueId)}
 const data=r.data as {ok?:boolean;owner?:string;leagueId?:string;receipt?:unknown;alreadySubmitted?:unknown}
 if(data?.ok!==true||data.owner!==owner||data.leagueId!==leagueId||typeof data.alreadySubmitted!=='boolean')throw Error('Request confirmation unavailable. Check entry status.')
 const receipt=readEntryReceipt(data.receipt);if(submission&&submission.review.format==='team'&&receipt.name.toLowerCase()!==body.draft.name.toLowerCase())throw Error('Entry confirmation changed')
 return {kind:'receipt' as const,receipt,alreadySubmitted:data.alreadySubmitted}
}
