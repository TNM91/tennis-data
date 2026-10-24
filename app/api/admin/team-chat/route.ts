import {getAdminApiAuth} from '@/lib/admin-api-auth'
import {parseTeamMessageSendId} from '@/lib/team-room-message-send'
export const runtime='nodejs'
export async function GET(request:Request) {
 const auth=await getAdminApiAuth(request)
 if(!auth.ok)return auth.response
 const result=await auth.service.from('team_chat_reports').select('id,message_id,conversation_id,reason,message_body,created_at').eq('status','open').order('created_at',{ascending:true}).order('id',{ascending:true}).limit(50)
 if(result.error)return Response.json({ok:false,message:'Chat reports are unavailable.'},{status:503})
 return Response.json({ok:true,reports:result.data || []},{headers:{'Cache-Control':'private, no-store'}})
}
export async function POST(request:Request) {
 const auth=await getAdminApiAuth(request)
 if(!auth.ok)return auth.response
 let body
 try{body=await request.json()}catch{return Response.json({ok:false,message:'Invalid review.'},{status:400})}
 const id=parseTeamMessageSendId(body?.id)
 if(!id || !['resolve','remove'].includes(body?.action))return Response.json({ok:false,message:'Choose a report and review action.'},{status:400})
 const report=await auth.service.from('team_chat_reports').select('id,message_id,conversation_id,reported_user_id').eq('id',id).eq('status','open').maybeSingle()
 if(report.error)return Response.json({ok:false,message:'Could not check this report.'},{status:503})
 if(!report.data)return Response.json({ok:false,message:'This report has already been reviewed. Refresh the queue.'},{status:409})
 const now=new Date().toISOString()
 if(body.action==='remove') {
  const removed=await auth.service.from('internal_messages').update({deleted_at:now}).eq('id',report.data.message_id).eq('conversation_id',report.data.conversation_id).eq('sender_user_id',report.data.reported_user_id)
  if(removed.error)return Response.json({ok:false,message:'Could not remove this post.'},{status:503})
 }
 const saved=await auth.service.from('team_chat_reports').update({status:'resolved',reviewed_by:auth.userId,reviewed_at:now}).eq('id',id).eq('status','open')
 if(saved.error)return Response.json({ok:false,message:'Could not finish this review. Refresh and try again.'},{status:503})
 return Response.json({ok:true})
}
