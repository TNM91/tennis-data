import {
  playerChatEndpoint,readPlayerChatInbox,readPlayerChatInvitation,readPlayerChatRematch,readPlayerChatRoom,type PlayerChatAction,
} from './player-chats-contract'
import { teamChatMessageId } from './team-chat-cursor'
import { updateTimestamp } from './native-updates-contract'

type ChatCall = (input: { query?: URLSearchParams; action?: PlayerChatAction }) => Promise<{ status: number; data: unknown }>

export const playerChatApiUrl = (query?: URLSearchParams) => playerChatEndpoint + (query?.size ? '?' + query : '')

export class PlayerChatError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export function playerChatTransport(owner: string, call: ChatCall) {
  async function request(input: Parameters<ChatCall>[0]) {
    const {data,status} = await call(input)
    const row = data as Record<string,unknown> | null
    if (status !== 200 || row?.ok !== true || row?.releaseScope !== 'first-party' || row?.owner !== owner) {
      const message = status === 401 ? 'Confirm your email and sign in again to continue.' :
        typeof row?.message === 'string' && row.releaseScope === 'first-party' ? row.message : 'Chats are unavailable. Try again.'
      throw new PlayerChatError(message,status)
    }
    return row
  }
  return {
    inbox: async () => readPlayerChatInbox(await request({})),
    rematch: async (hit: string) => readPlayerChatRematch((await request({query:new URLSearchParams({rematch:hit})})).rematch),
    room: async (id: string,before = '') => {
      const query = new URLSearchParams({room:id})
      if (before) query.set('before',before)
      return readPlayerChatRoom((await request({ query })).room,id)
    },
    preview: async (token: string) => readPlayerChatInvitation((await request({action:{action:'preview',token}})).invite),
    act: async (action: PlayerChatAction) => {
      const row = await request({action})
      if (action.action === 'send' && row.messageId !== action.id) throw new PlayerChatError('The send couldn’t be confirmed.',503)
      return { roomId:teamChatMessageId(row.roomId)?row.roomId:undefined,
        contact:teamChatMessageId(row.contact)?row.contact:undefined,
        expiresAt:updateTimestamp(row.expiresAt)?row.expiresAt:undefined }
    },
  }
}
