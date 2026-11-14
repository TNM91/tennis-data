import { lineupRecord } from './native-captain-lineup-contract'
import { readTeamChatCursor, teamChatMessageId } from './team-chat-cursor'
import { updateTimestamp } from './native-updates-contract'
import { readChatIconUrl } from './chat-icon-url'
import { parseGroupPracticeAction,readGroupPractice,type GroupPractice,type GroupPracticeAction } from './group-practice-contract'

export const playerChatInvitePath = '/chats/join'
export const playerChatPath = '/chats'
const origin = 'https://www.tenaceiq.com'
export const playerChatEndpoint = '/api/mobile/first-party/player-chats'
export const playerChatAppDownload = 'https://apps.apple.com/app/id6826324431'

export const validPlayerChatInvite = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)

export function playerChatInviteToken(value: unknown) {
  if (typeof value !== 'string' || value.length > 500) return ''
  if (validPlayerChatInvite(value.trim())) return value.trim()
  try {
    const u = new URL(value.trim())
    const token = u.searchParams.get('invite')
    return u.protocol === 'https:' && ['www.tenaceiq.com','tenaceiq.com'].includes(u.hostname) &&
      !u.username && !u.password && !u.port && !u.hash && u.pathname === playerChatInvitePath &&
      u.searchParams.size === 1 && validPlayerChatInvite(token) ? token : ''
  } catch { return '' }
}
export const playerChatInviteHref = (token: string) => origin + playerChatInvitePath + '?invite=' + token
export const isPlayerChatInviteNext = (href: string) =>
  href.startsWith(playerChatInvitePath+'?') && Boolean(playerChatInviteToken(origin+href))
export function newPlayerChatInvite() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2,'0')).join('')
}

const id = (value: unknown) => {
  if (!teamChatMessageId(value)) throw Error('Choose a player or chat.')
  return value.toLowerCase()
}
const text = (value: unknown, max: number, multiline = false) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
      (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /\p{Cc}/u).test(value)) {
    throw Error('Check the chat details.')
  }
  return value.trim()
}

export type PlayerChatAction =
  | GroupPracticeAction
  | { action: 'invite'|'revoke'; room?: string; token: string }
  | { action: 'preview'|'join'; token: string }
  | { action: 'direct'|'forget'; target: string }
  | { action: 'group'; id: string; text: string; members: string[] }
  | { action: 'add'|'remove'|'block'; room: string; target: string }
  | { action: 'read'; room: string; id: string }
  | { action: 'leave'|'revoke_links'; room: string }
  | { action: 'report'|'send'; room: string; id: string; text: string }

export function playerChatAction(value: unknown): PlayerChatAction {
  const row = lineupRecord(value), action = row.action
  const practice = parseGroupPracticeAction(row)
  if (practice) return practice
  const exact = (...keys: string[]) => {
    if (Object.keys(row).length !== keys.length + 1 || keys.some(key => !Object.hasOwn(row,key))) {
      throw Error('Check the chat details.')
    }
  }
  if (action === 'invite' || action === 'revoke' || action === 'preview' || action === 'join') {
    const withRoom = (action === 'invite' || action === 'revoke') && row.room !== undefined
    exact('token', ...(withRoom ? ['room'] : []))
    if (!validPlayerChatInvite(row.token)) throw Error('Use the invite link you received.')
    return { action, token: row.token, ...(withRoom ? { room: id(row.room) } : {}) }
  }
  if (action === 'direct' || action === 'forget') {
    exact('target')
    return { action, target: id(row.target) }
  }
  if (action === 'group') {
    exact('id','text','members')
    if (!Array.isArray(row.members) || row.members.length > 20) throw Error('Choose up to 20 contacts.')
    const members = row.members.map(id)
    if (new Set(members).size !== members.length) throw Error('Choose each contact once.')
    return { action, id: id(row.id), text: text(row.text,80), members }
  }
  if (action === 'add' || action === 'remove' || action === 'block') {
    exact('room','target')
    return { action, room: id(row.room), target: id(row.target) }
  }
  if (action === 'leave' || action === 'revoke_links') {
    exact('room')
    return { action, room: id(row.room) }
  }
  if (action === 'read') {
    exact('room','id')
    return { action, room: id(row.room), id: id(row.id) }
  }
  if (action === 'send' || action === 'report') {
    exact('room','id','text')
    const message = text(row.text,action === 'send' ? 2400 : 25,action === 'send')
    if (action === 'report' && !['harassment','spam','inappropriate','other'].includes(message)) throw Error('Choose why you’re reporting this message.')
    return { action, room: id(row.room), id: id(row.id), text: message }
  }
  throw Error('Choose a chat action.')
}

export function playerChatReadParams(params: URLSearchParams) {
  if ([...params.keys()].some(key => !['room','before'].includes(key) || params.getAll(key).length !== 1)) {
    throw Error('Choose a chat.')
  }
  const room = params.has('room') ? id(params.get('room')) : null
  const before = params.has('before') ? readTeamChatCursor(params.get('before')) : null
  if (params.has('before') && (!room || !before)) throw Error('Choose a chat.')
  return { room, before }
}

export type PlayerContact = { id: string; name: string }
export type PlayerChatMessage = { id: string; author: string; name: string; body: string; createdAt: string }
export type PlayerChatSummary = { id: string; title: string; group: boolean; unread: boolean; logo?: string; activityAt?: string }
export type PlayerChatRoom = Omit<PlayerChatSummary,'unread'> & {
  manage: boolean; messages: PlayerChatMessage[]; more: boolean; members: PlayerContact[]; practice?: GroupPractice | null
}
export type PlayerChatInbox = { contacts: PlayerContact[]; rooms: PlayerChatSummary[] }
const flag = (value: unknown) => {
  if (typeof value !== 'boolean') throw Error('Chat access changed.')
  return value
}
function list<T extends {id: string}>(value: unknown, limit: number, read: (row: Record<string, unknown>) => T) {
  if (!Array.isArray(value) || value.length > limit) throw Error('Chat access changed.')
  const rows = value.map(row => read(lineupRecord(row)))
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw Error('Chat access changed.')
  return rows
}
const contact = (row: Record<string, unknown>): PlayerContact => ({ id:id(row.id),name:text(row.name,100) })
export function readPlayerChatInbox(value: unknown): PlayerChatInbox {
  const row = lineupRecord(value)
  return { contacts:list(row.contacts,100,contact), rooms:list(row.rooms,100,r=>({
    id:id(r.id),title:text(r.title,100),group:flag(r.group),unread:flag(r.unread),logo:readChatIconUrl(r.logo),
    activityAt:updateTimestamp(r.activityAt)?r.activityAt:undefined,
  })) }
}
export function readPlayerChatRoom(value: unknown, room: string): PlayerChatRoom {
  const row = lineupRecord(value)
  if (row.id !== room) throw Error('Chat access changed.')
  return { id:room,title:text(row.title,100),group:flag(row.group),manage:flag(row.manage),more:flag(row.more),logo:readChatIconUrl(row.logo),
    ...(Object.hasOwn(row,'practice') && row.group === true ? {practice:readGroupPractice(row.practice)} : {}),
    members:list(row.members,31,contact),messages:list(row.messages,40,m=>{
      if (!updateTimestamp(m.createdAt)) throw Error('Chat messages changed.')
      return { id:id(m.id),author:id(m.author),name:text(m.name,100),body:text(m.body,2400,true),createdAt:m.createdAt }
    }) }
}
export function readPlayerChatInvitation(value: unknown) {
  const row = lineupRecord(value)
  return { group:flag(row.group),title:text(row.title,100) }
}
