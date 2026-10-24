import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {TeamScope} from './team-room-data'

export type ChatAction =
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
  response=await send({url:'https://www.tenaceiq.com/api/team-rooms',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},data:{...scope,...action},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000})
 }catch{throw new ChatActionError('We couldn’t confirm this send. Retry to check the same message.',true)}
 if(!isCurrent())throw new ChatActionError('This team is no longer open.',true)
 if(response.status!==200 || response.data?.ok!==true) {
  const uncertain=response.status>=500 || response.status===409 || response.status>=300 && response.status<400 || response.status===200
  throw new ChatActionError(response.status===403?'Your team access is unavailable.':response.status===401?'Sign in again to continue.':uncertain?'We couldn’t confirm this send. Retry the same message.':'This action wasn’t saved. Refresh the team and try again.',uncertain)
 }
 if(action.action==='send' && (response.data.message?.id!==action.clientMessageId || response.data.message?.isMine!==true || response.data.message?.body!==action.body))throw new ChatActionError('We couldn’t confirm this send. Retry the same message.',true)
 return response.data
}

export class TeamChatDraft {
 text=''
 reply:{id:string;name:string;body:string}|null=null
 pending:Extract<ChatAction,{action:'send'}>|null=null
 sending=false
 notice=''
 private disposed=false
 constructor(private readonly send:(action:ChatAction)=>Promise<unknown>,private readonly newId:()=>string=()=>crypto.randomUUID()){}
 async submit():Promise<boolean> {
  if(this.disposed || this.sending || !this.pending && !this.text.trim())return false
  const wasPending=Boolean(this.pending)
  if(!this.pending)this.pending={action:'send',clientMessageId:this.newId(),body:this.text.trim().slice(0,2400),replyToMessageId:this.reply?.id || ''}
  const pending=this.pending
  this.sending=true;this.notice='Sending…'
  try{
   await this.send(pending)
   if(this.disposed)return false
   this.text='';this.reply=null;this.pending=null;this.notice='Sent.'
   return true
  }catch(cause){
   if(this.disposed)return false
   this.notice=cause instanceof ChatActionError?cause.message:'We couldn’t confirm this send. Retry the same message.'
   if(cause instanceof ChatActionError && !cause.uncertain && !wasPending)this.pending=null
   return false
  }finally{this.sending=false}
 }
 discard(){if(this.sending)return;this.text='';this.reply=null;this.pending=null;this.notice='Retry discarded. The original message may already be in the conversation.'}
 dispose(){this.disposed=true;this.text='';this.reply=null;this.pending=null;this.notice=''}
}
