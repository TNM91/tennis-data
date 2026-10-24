import type {ChatPhoto} from './chat-photos'
import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'

export type ChatAction =
  | {action:'set_chat_mute';conversationId:string;muted:boolean}
  | {action:'read_chat_photo';messageId:string;photoPreview?:boolean}
  | {action:'send_chat_photo';clientMessageId:string;body:string;replyToMessageId:string;photoBase64:string}
  | {action:'set_chat_reaction';messageId:string;reaction:'helpful'|'celebrate';active:boolean}
  | {action:'mark_chat_read';messageId:string}
  | {action:'send';clientMessageId:string;body:string;replyToMessageId:string}
  | {action:'report_chat_message';messageId:string;reason:'harassment'|'spam'|'inappropriate'|'other'}
  | {action:'block_chat_member'|'unblock_chat_member';memberId:string}
export class ChatActionError extends Error {
 constructor(message:string,readonly uncertain:boolean){super(message)}
}
export async function postTeamChat(client:SupabaseClient,userId:string,isCurrent:()=>boolean,scope:TeamScope,action:ChatAction,send:typeof CapacitorHttp.post=options=>CapacitorHttp.post(options)) {
 const {data,error}=await client.auth.getSession()
 if(error || !data.session || data.session.user.id!==userId || !isCurrent())throw new ChatActionError('Sign in again before posting.',false)
 let response
 try {
  response=await send({url:'https://www.tenaceiq.com/api/team-rooms',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},data:{...scope,...action},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:action.action==='send_chat_photo' || action.action==='read_chat_photo'?30000:12000})
 }catch{throw new ChatActionError('We couldn’t confirm this send. Retry to check the same message.',true)}
 if(!isCurrent())throw new ChatActionError('This team is no longer open.',true)
 if(response.status!==200 || response.data?.ok!==true) {
  const uncertain=response.status>=500 || response.status===409 || response.status>=300 && response.status<400 || response.status===200
  throw new ChatActionError(response.status===403?'Your team access is unavailable.':response.status===401?'Sign in again to continue.':uncertain?'We couldn’t confirm this send. Retry the same message.':'This action wasn’t saved. Refresh the team and try again.',uncertain)
 }
 if(action.action==='set_chat_mute' && (response.data.conversationId!==action.conversationId || response.data.muted!==action.muted))throw new ChatActionError('Couldn’t confirm your team alerts. Retry the same setting.',true)
 if(action.action==='read_chat_photo' && response.data.messageId!==action.messageId)throw new ChatActionError('Photo unavailable. Close and try again.',false)
 if(action.action==='set_chat_reaction' && (response.data.messageId!==action.messageId || response.data.reaction!==action.reaction || response.data.active!==action.active))throw new ChatActionError('Couldn’t confirm this reaction. Retry the same choice.',true)
 if(action.action==='send_chat_photo' && response.data.message?.attachment?.mimeType!=='image/jpeg')throw new ChatActionError('Couldn’t confirm your photo. Retry the same send.',true)
 if((action.action==='send' || action.action==='send_chat_photo') && (response.data.message?.id!==action.clientMessageId || response.data.message?.isMine!==true || response.data.message?.body!==(action.action==='send_chat_photo'?(action.body || 'Shared a photo.'):action.body)))throw new ChatActionError('We couldn’t confirm this send. Retry the same message.',true)
 return response.data
}

export class TeamChatDraft {
 photo:ChatPhoto|null=null
 text=''
 reply:{id:string;name:string;body:string}|null=null
 pending:Extract<ChatAction,{action:'send'|'send_chat_photo'}>|null=null
 sending=false
 notice=''
 private disposed=false
 constructor(private readonly send:(action:ChatAction)=>Promise<unknown>,private readonly newId:()=>string=()=>crypto.randomUUID()){}
 async submit():Promise<boolean> {
  if(this.disposed || this.sending || !this.pending && !this.text.trim() && !this.photo)return false
  const wasPending=Boolean(this.pending)
  if(!this.pending)this.pending={...(this.photo?{action:'send_chat_photo' as const,photoBase64:this.photo.base64}:{action:'send' as const}),clientMessageId:this.newId(),body:this.text.trim().slice(0,2400),replyToMessageId:this.reply?.id || ''}
  const pending=this.pending
  this.sending=true;this.notice='Sending…'
  try{
   await this.send(pending)
   if(this.disposed)return false
   this.photo=null;this.text='';this.reply=null;this.pending=null;this.notice='Sent.'
   return true
  }catch(cause){
   if(this.disposed)return false
   this.notice=cause instanceof ChatActionError?cause.message:'We couldn’t confirm this send. Retry the same message.'
   if(cause instanceof ChatActionError && !cause.uncertain && !wasPending)this.pending=null
   return false
  }finally{this.sending=false}
 }
 discard(){if(this.sending)return;this.photo=null;this.text='';this.reply=null;this.pending=null;this.notice='Retry discarded. The original message may already be in the conversation.'}
 dispose(){this.disposed=true;this.photo=null;this.text='';this.reply=null;this.pending=null;this.notice=''}
}
