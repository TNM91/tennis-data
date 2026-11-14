import { accountClient,accountResponse,readAccountJson,verifiedAccount } from '@/lib/mobile-account-auth'
import {
  playerChatAction,playerChatReadParams,readPlayerChatInbox,readPlayerChatInvitation,readPlayerChatRematch,readPlayerChatRoom,type PlayerChatAction,
} from '@/lib/player-chats-contract'
import { teamChatMessageId } from '@/lib/team-chat-cursor'
import { updateTimestamp } from '@/lib/native-updates-contract'
import { loadTeamLogoUrls } from '@/lib/team-branding-storage'
import { chatHitChangesHeader, chatHitsHeader, readChatHit } from '@/lib/chat-hit-contract'
import { hittingPlanStart } from '@/lib/hitting-plan'
import { after } from 'next/server'
import { nativeHitPushConfigured,sendDueNativeHitPush } from '@/lib/native-hit-push'

export const runtime = 'nodejs'
export const maxDuration = 30

const json = (body: object,status = 200) => accountResponse({releaseScope:'first-party',...body},status,{
  'Referrer-Policy':'no-referrer',
})
const failure = (message: string,status: number) => json({ok:false,message},status)
const errors = {
  forbidden:[403,'This chat or player is unavailable.'],
  invalid:[400,'Check the chat details.'],
  full:[409,'This list, group, or invite account limit has been reached.'],
  capacity:[409,'Keep enough spots for everyone who has joined.'],
  stale:[409,'The practice changed. Refresh the group and try again.'],
  hit_stale:[409,'The hitting plan changed. Review the latest plan.'],
  hit_unchanged:[400,'Choose a different time or club.'],
  unavailable:[404,'This invite is unavailable. Ask for a fresh link.'],
} as const
const service = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) throw Error('Chat unavailable')
  return accountClient(key)
}

export async function GET(request: Request) {
  const account = await verifiedAccount(request)
  if (!account) return failure('Sign in and confirm your email to open Chats.',401)
  let selection: ReturnType<typeof playerChatReadParams>
  try { selection = playerChatReadParams(new URL(request.url).searchParams) }
  catch { return failure('Choose a chat.',400) }
  try {
    const owner = account.user.id
    const {room,before,rematch} = selection
    const db = service()
    if (rematch) {
      const {data,error} = await db.rpc('native_chat_hit_rematch',{p_owner:owner,p_hit:rematch}).retry(false)
      if (error) throw Error()
      if (!data) return failure('This hitting partner is no longer available in Chats.',404)
      return json({ok:true,owner,rematch:readPlayerChatRematch(data)})
    }
    const {data,error} = await db.rpc(room ? 'native_player_chat_room_with_practice' : 'native_player_chats_read',{
      p_owner:owner,p_room:room,p_before_at:before?.createdAt??null,p_before_id:before?.id??null,
    }).retry(false)
    if (error) throw Error()
    if (data?.code === 'forbidden') return failure(errors.forbidden[1],errors.forbidden[0])
    if (data?.code !== 'ok') throw Error()
    if (room) {
      const selected = readPlayerChatRoom(data.room,room)
      if (selected.group) {
        const logos = await loadTeamLogoUrls(db, [selected.id], 'player_group').catch(()=>new Map<string,string>())
        return json({ok:true,owner,room:{...selected,logo:logos.get(selected.id)}})
      }
      // Scope this additional lookup to clients that can display the card.
      const wantsChanges = request.headers.get(chatHitChangesHeader)==='1'
      if (!before && wantsChanges) {
        const state = await db.rpc('native_chat_hit_state_for_room',{p_owner:owner,p_room:room}).retry(false)
        if (!state.error) {
          selected.hit=state.data?.hit ? readChatHit(state.data.hit) : null
          selected.confirmedHit=state.data?.confirmedHit ? readChatHit(state.data.confirmedHit) : undefined
          selected.canSuggestHit=true
        }
      }
      if (!before && selected.hit===undefined && request.headers.get(chatHitsHeader)==='1') {
        const hit = await db.rpc('native_chat_hit_for_room',{p_owner:owner,p_room:room}).retry(false)
        if (!hit.error) selected.hit=hit.data ? readChatHit(hit.data) : null
      }
      return json({ok:true,owner,room:selected})
    }
    const inbox = readPlayerChatInbox(data)
    const ids = inbox.rooms.map(item=>item.id)
    const [logos, timestamps] = await Promise.all([
      loadTeamLogoUrls(db,inbox.rooms.filter(item=>item.group).map(item=>item.id),'player_group').catch(()=>new Map<string,string>()),
      ids.length ? db.from('internal_conversations').select('id,updated_at').in('id',ids).eq('status','open').limit(ids.length)
        .then(result=>result.data??[],()=>[]) : [],
    ])
    const activity = new Map(timestamps.map(item=>[item.id,item.updated_at]))
    return json({ok:true,owner,...inbox,rooms:inbox.rooms.map(item=>({...item,logo:logos.get(item.id),activityAt:activity.get(item.id)}))})
  } catch { return failure('Chats couldn’t load. Refresh to try again.',503) }
}

export async function POST(request: Request) {
  const account = await verifiedAccount(request)
  if (!account) return failure('Sign in and confirm your email to continue.',401)
  let input: PlayerChatAction
  try {
    if (new URL(request.url).search) throw Error()
    input = playerChatAction(await readAccountJson(request,15000))
  } catch { return failure('Check the chat details.',400) }
  try {
    const owner = account.user.id
    if (input.action==='hit_propose' || input.action==='hit_suggest' || input.action==='hit_reply' || input.action==='hit_cancel') {
      const schedule = input.action==='hit_propose' || input.action==='hit_suggest' ? input : null
      const parameters = {
        p_owner:owner,p_room:input.room,p_hit:input.id,
        p_club:schedule?.clubId??null,p_date:schedule?.date??null,p_time:schedule?.time??null,
        p_starts:schedule?hittingPlanStart(schedule)!.toISOString():null,
      }
      const db = service()
      const {data,error} = input.action==='hit_suggest'
        ? await db.rpc('native_suggest_chat_hit',{...parameters,p_replaces:input.replaces}).retry(false)
        : await db.rpc('native_write_chat_hit',{
          ...parameters,p_action:input.action,p_response:input.action==='hit_reply'?input.response:null,
        }).retry(false)
      if (error) throw Error()
      if (data?.code==='ok') {
        if (input.action==='hit_reply' && input.response==='accepted' && nativeHitPushConfigured()) after(async()=>{
          try { await sendDueNativeHitPush(db,input.id) }
          catch { console.warn('Confirmed hit reminder will retry') }
        })
        return json({ok:true,owner})
      }
      if (typeof data?.code!=='string' || !Object.hasOwn(errors,data.code)) throw Error()
      const [status,message] = errors[data.code as keyof typeof errors]
      return failure(message,status)
    }
    if (input.action === 'practice_edit') {
      const {data,error} = await service().rpc('native_edit_group_practice',{
        p_owner:owner,p_room:input.room,p_id:input.id,p_revision:input.revision,p_request:input.request,
        p_starts_at:input.startsAt,p_court:input.court,p_capacity:input.capacity,
      }).retry(false)
      if (error) throw Error()
      if (data?.code === 'ok') return json({ok:true,owner})
      if (typeof data?.code !== 'string' || !Object.hasOwn(errors,data.code)) throw Error()
      const [status,message] = errors[data.code as keyof typeof errors]
      return failure(message,status)
    }
    if (input.action === 'practice_create' || input.action === 'practice_reply' || input.action === 'practice_cancel') {
      const {data,error} = await service().rpc('native_group_practice_action',{
        p_owner:owner,p_room:input.room,p_id:input.id,p_action:input.action,
        p_starts_at:input.action==='practice_create'?input.startsAt:null,p_court:input.action==='practice_create'?input.court:null,
        p_capacity:input.action==='practice_create'?input.capacity:null,p_response:input.action==='practice_reply'?input.response:null,
      }).retry(false)
      if (error) throw Error()
      if (data?.code === 'ok') return json({ok:true,owner})
      if (data?.code === 'full') return failure('This practice is full. Check back for an opening.',409)
      if (typeof data?.code !== 'string' || !Object.hasOwn(errors,data.code)) throw Error()
      const [status,message] = errors[data.code as keyof typeof errors]
      return failure(message,status)
    }
    const {data,error} = await service().rpc('native_player_chats_action',{
      p_owner:owner,p_action:input.action,p_room:'room' in input?input.room??null:null,
      p_id:'id' in input?input.id:null,p_target:'target' in input?input.target:null,
      p_members:'members' in input?input.members:null,p_text:'text' in input?input.text:null,
      p_token:'token' in input?input.token:null,
    }).retry(false)
    if (error) throw Error()
    if (data?.code !== 'ok') {
      if (typeof data?.code !== 'string' || !Object.hasOwn(errors,data.code)) throw Error()
      const [status,message] = errors[data.code as keyof typeof errors]
      return failure(message,status)
    }
    const reply = {ok:true,owner}
    if (input.action === 'preview') return json({...reply,invite:readPlayerChatInvitation(data)})
    if (input.action === 'invite' && updateTimestamp(data.expiresAt)) return json({...reply,expiresAt:data.expiresAt})
    if (['join','group','direct'].includes(input.action) && teamChatMessageId(data.roomId)) return json({...reply,roomId:data.roomId})
    if (input.action === 'join' && teamChatMessageId(data.contact)) return json({...reply,contact:data.contact})
    if (input.action === 'send' && data.messageId === input.id) return json({...reply,messageId:input.id})
    if (['invite','join','group','direct','send'].includes(input.action)) throw Error()
    return json(reply)
  } catch { return failure('The change couldn’t be confirmed. Try the same action again.',503) }
}
