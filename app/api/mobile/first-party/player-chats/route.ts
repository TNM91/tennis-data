import { accountClient,accountResponse,readAccountJson,verifiedAccount } from '@/lib/mobile-account-auth'
import {
  playerChatAction,playerChatReadParams,readPlayerChatInbox,readPlayerChatInvitation,readPlayerChatRoom,type PlayerChatAction,
} from '@/lib/player-chats-contract'
import { teamChatMessageId } from '@/lib/team-chat-cursor'
import { updateTimestamp } from '@/lib/native-updates-contract'

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
    const {room,before} = selection
    const {data,error} = await service().rpc('native_player_chats_read',{
      p_owner:owner,p_room:room,p_before_at:before?.createdAt??null,p_before_id:before?.id??null,
    }).retry(false)
    if (error) throw Error()
    if (data?.code === 'forbidden') return failure(errors.forbidden[1],errors.forbidden[0])
    if (data?.code !== 'ok') throw Error()
    return room ? json({ok:true,owner,room:readPlayerChatRoom(data.room,room)}) : json({ok:true,owner,...readPlayerChatInbox(data)})
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
