import {getCaptainApiAuth} from '@/lib/captain-api-auth'
import {getCaptainAvailabilityServiceClient} from '@/lib/captain-availability-request-server'
import {readAccountJson} from '@/lib/mobile-account-auth'
import {practiceId} from '@/lib/native-player-practice-contract'
import {practiceReminderHref,practiceReminderLimit} from '@/lib/native-practice-reminder-contract'
import {updateTimestamp} from '@/lib/native-updates-contract'
import {privateTeamRoomId} from '@/lib/private-team-contract'

export const runtime='nodejs'
export const maxDuration=30
const json=(data:object,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}})

async function reminder(request:Request,send:boolean){
 try{
  const auth=await getCaptainApiAuth(request)
  if(!auth.ok)return auth.response
  const params=new URL(request.url).searchParams
  const keys=['team','league','flight','eventId']
  if([...params.keys()].length!==keys.length||keys.some(key=>params.getAll(key).length!==1))return json({ok:false},400)
  const scope={teamName:params.get('team')!,leagueName:params.get('league')!,flight:params.get('flight')!}
  const roomId=privateTeamRoomId(scope.leagueName),eventId=params.get('eventId')
  if(!roomId||!practiceId(eventId)||!scope.teamName.trim()||scope.teamName.length>100||scope.flight.length>60||
     /[\u0000-\u001f\u007f]/.test(scope.teamName+scope.flight))return json({ok:false},400)
  let delivery={}
  if(send){
   const input=await readAccountJson(request,10000)
   if(!input)return json({ok:false},400)
   const {requestId,updatedAt,recipientIds}=input
   if(Object.keys(input).length!==3||!practiceId(requestId)||!updateTimestamp(updatedAt)||
      !Array.isArray(recipientIds)||recipientIds.length<1||recipientIds.length>practiceReminderLimit||
      !recipientIds.every(practiceId)||new Set(recipientIds.map(id=>id.toLowerCase())).size!==recipientIds.length)
    return json({ok:false},400)
   delivery={p_request:requestId,p_revision:updatedAt,p_recipients:recipientIds,
    p_href:practiceReminderHref(scope,eventId,requestId)}
  }
  const {data,error}=await getCaptainAvailabilityServiceClient().rpc('native_private_practice_reminder',{
   p_owner:auth.userId,p_room:roomId,p_event:eventId,p_team:scope.teamName,p_flight:scope.flight,...delivery,
  }).retry(false)
  if(error||![200,400,403,404,409].includes(data?.status))return json({ok:false},503)
  if(data.status!==200)return json({ok:false},data.status)
  const result=send?{count:data.count}:{updatedAt:data.updatedAt,date:data.date,recipients:data.recipients,alreadySent:data.alreadySent}
  return json({ok:true,owner:auth.userId,eventId,scope,...result})
 }catch{return json({ok:false},503)}
}

export const GET=(request:Request)=>reminder(request,false)
export const POST=(request:Request)=>reminder(request,true)
