import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner,type ScenarioSend} from './captain-scenarios-data'
import {tournamentEntryId,tournamentEntryAction,readTournamentEntrySnapshot,readMyTournamentEntries} from '../../lib/native-tournament-entry-contract'
import {firstPartyBuild} from './build-scope'

export async function getMyTournamentEntries(client:SupabaseClient, owner:string, current:()=>boolean, division?:string) {
 if(firstPartyBuild)throw Error('Tournament entries are unavailable in this edition.')
 const session = await scenarioOwner(client, owner, current)
 const query = division === undefined ? '' : '?'+new URLSearchParams({division:tournamentEntryId(division)})
 const response = await CapacitorHttp.get({
  url: 'https://www.tenaceiq.com/api/mobile/tournaments/entries'+query,
  headers: {Authorization: 'Bearer '+session.access_token, 'Cache-Control': 'no-store'},
  webFetchExtra: {cache: 'no-store'},
  disableRedirects: true,
  responseType: 'json',
  connectTimeout: 12000,
  readTimeout: 30000,
 })
 await scenarioOwner(client, owner, current)
 if(response.status !== 200)throw Error('Tournament entries unavailable.')
 return readMyTournamentEntries(response.data, owner)
}
export async function tournamentEntryRequest(client:SupabaseClient,owner:string,current:()=>boolean,parent:string,division:string,organizer=false,action?:ReturnType<typeof tournamentEntryAction>,send:ScenarioSend=o=>CapacitorHttp.request(o)){
 if(firstPartyBuild)throw Error('Tournament registration is unavailable in this edition.')
 tournamentEntryId(parent,true);tournamentEntryId(division)
 if(action&&(action.parent!==parent||action.division!==division))throw Error('Entry selection changed.')
 const body=action?tournamentEntryAction(action):undefined,session=await scenarioOwner(client,owner,current)
 let response
 try{response=await send({method:body?'POST':'GET',url:'https://www.tenaceiq.com/api/mobile/tournaments/entry'+(body?'':'?'+new URLSearchParams({parent,division,...(organizer?{organizer:'1'}:{})})),headers:{Authorization:'Bearer '+session.access_token,'Cache-Control':'no-store',...(body?{'Content-Type':'application/json'}:{})},...(body?{data:body}:{}),webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000})}catch{throw Error(body?'Your request could not be confirmed. Refresh entry status before trying again.':'Registration is unavailable. Check your connection and refresh.')}
 await scenarioOwner(client,owner,current)
 if(response.status!==200){const r=response.data as {message?:unknown};throw Error([400,401,403,404,409,429].includes(response.status)&&typeof r?.message==='string'&&r.message.length<=600?r.message:body?'Your request could not be confirmed. Refresh entry status.':'Registration is unavailable. Refresh to try again.')}
 const result=readTournamentEntrySnapshot(response.data,owner,parent,division,body?false:organizer)
 if(body&&(!result.receipt||typeof result.alreadySubmitted!=='boolean'||body.action==='decide'&&result.receipt.id!==body.data.entryId))throw Error('Entry confirmation changed. Refresh entry status.')
 return result
}
