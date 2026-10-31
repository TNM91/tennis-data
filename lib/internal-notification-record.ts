export type InternalNotificationType = 'message' | 'schedule' | 'support' | 'system'
export type InternalNotification = {
  id:string;recipientProfileId:string;actorUserId:string;notificationType:InternalNotificationType
  title:string;body:string;href:string;conversationId:string;scheduleEventId:string;readAt:string;createdAt:string
}
export type NotificationRow = {
  id?:string|null;recipient_profile_id?:string|null;actor_user_id?:string|null;notification_type?:string|null
  title?:string|null;body?:string|null;href?:string|null;conversation_id?:string|null;schedule_event_id?:string|null
  read_at?:string|null;created_at?:string|null
}
const text=(value:unknown)=>typeof value==='string'?value.trim():''
/** Shared website/app projection. It never reads a session or creates a client. */
export function toInternalNotification(row:NotificationRow):InternalNotification|null {
  const id=text(row.id),recipientProfileId=text(row.recipient_profile_id)
  if(!id||!recipientProfileId)return null
  const kind=text(row.notification_type)
  return {id,recipientProfileId,actorUserId:text(row.actor_user_id),notificationType:kind==='schedule'||kind==='support'||kind==='system'?kind:'message',
    title:text(row.title),body:text(row.body),href:text(row.href),conversationId:text(row.conversation_id),scheduleEventId:text(row.schedule_event_id),readAt:text(row.read_at),createdAt:text(row.created_at)}
}
