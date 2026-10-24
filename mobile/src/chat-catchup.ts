import {newerChatTime} from './team-chat-read'
import type {TeamMessage} from './team-room-data'
/** Counts only the bounded loaded page, never a claim about the entire room. */
export function unreadChatIds(messages:TeamMessage[],through:string){return new Set(messages.filter(message=>!message.isMine&&!message.deletedAt&&newerChatTime(message.createdAt,through)).map(message=>message.id))}
export function firstUnreadChat(messages:TeamMessage[],unread:Set<string>){return messages.find(message=>unread.has(message.id))?.id||''}
