import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner} from './captain-scenarios-data'
import type {CoachSend} from './coach-workspace-data'
import {readCoachConnection, readCoachConnectionIntent, type CoachConnectionIntent} from '../../lib/native-coach-connection-contract'

export class CoachConnectionError extends Error {
 constructor(public status:number){super(status===401?'Sign in again with your verified email.':status===403?'Sign in with the email address your coach invited.':status===404?'This invitation was not found. Ask your coach for a new link.':status===410?'This invitation has expired. Ask your coach for a new link.':status===409?'This invitation or student connection changed. Review it again.':'The connection could not be confirmed. Check its status before trying again.')}
}
export async function coachConnectionRequest(client:SupabaseClient,owner:string,current:()=>boolean,intent:CoachConnectionIntent,send:CoachSend=(_method,options)=>CapacitorHttp.post(options)){
 const data=readCoachConnectionIntent(intent),session=await scenarioOwner(client,owner,current)
 const response=await send('POST',{url:'https://www.tenaceiq.com/api/mobile/coach/connection',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json','Cache-Control':'no-store'},webFetchExtra:{cache:'no-store'},disableRedirects:true,responseType:'json',connectTimeout:12000,readTimeout:30000,data})
 await scenarioOwner(client,owner,current)
 if(response.status!==200)throw new CoachConnectionError(response.status)
 return readCoachConnection(response.data,owner)
}
