import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner,type ScenarioSend} from './captain-scenarios-data'
import {decisionDraft,readDecisionEntry,readDecisionReview,type LeagueDecision} from '../../lib/native-league-decisions-contract'
export async function leagueDecisionRequest(client:SupabaseClient,owner:string,current:()=>boolean,leagueId:string,input?:{entryId:string;review:string;decision:LeagueDecision;note:string;confirmed:boolean},send:ScenarioSend=o=>CapacitorHttp.request(o)){
 const session=await scenarioOwner(client,owner,current);let r
 try{r=await send({url:'https://www.tenaceiq.com/api/mobile/league-office/entries'+(input?'':'?'+new URLSearchParams({league:leagueId})),method:input?'POST':'GET',headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store',...(input?{'Content-Type':'application/json'}:{})},...(input?{data:decisionDraft({leagueId,...input})}:{}),webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:60000})}catch{throw Error('Your decision could not be confirmed. Refresh requests before trying again.')}
 await scenarioOwner(client,owner,current)
 if(r.status!==200){const message=r.data&&typeof r.data==='object'&&typeof r.data.message==='string'&&r.data.message.length<=600?r.data.message:'';throw Error([400,403,409].includes(r.status)&&message?message:'Requests could not be confirmed. Refresh to try again.')}
 if(!input)return {review:readDecisionReview(r.data,owner,leagueId),receipt:null}
 if(r.data?.ok!==true||r.data.owner!==owner||r.data.leagueId!==leagueId)throw Error('League account changed')
 const receipt=readDecisionEntry(r.data.receipt);if(receipt.id!==input.entryId||input.decision==='information'&&(!receipt.actionRequired||receipt.requestNote!==input.note.trim())||input.decision!=='information'&&receipt.status!==input.decision)throw Error('Decision receipt changed')
 return {review:null,receipt,notified:r.data.notified===true}
}
