import { teamChatMessageId } from './team-chat-cursor'
import { updateTimestamp } from './native-updates-contract'

export type GroupPracticeReply = 'in' | 'out'
export type GroupPracticeAction =
  | { action: 'practice_create'; room: string; id: string; startsAt: string; court: string; capacity: number }
  | { action: 'practice_reply'; room: string; id: string; response: GroupPracticeReply }
  | { action: 'practice_cancel'; room: string; id: string }
export type GroupPractice = {
  id: string
  startsAt: string
  court: string
  capacity: number
  mine: GroupPracticeReply | null
  inCount: number
  players: { id: string; name: string }[]
}

export function parseGroupPracticeAction(row: Record<string, unknown>): GroupPracticeAction | null {
  const action = row.action
  if (action !== 'practice_create' && action !== 'practice_reply' && action !== 'practice_cancel') return null
  if (!teamChatMessageId(row.id) || !teamChatMessageId(row.room)) throw Error('Choose a group practice.')
  const target = { room: row.room.toLowerCase(), id: row.id.toLowerCase() }
  if (action === 'practice_cancel' && Object.keys(row).length === 3) return {action,...target}
  if (action === 'practice_reply' && Object.keys(row).length === 4 && (row.response === 'in' || row.response === 'out')) {
    return {action,...target,response:row.response}
  }
  if (action === 'practice_create' && Object.keys(row).length === 6) {
    const {startsAt,court,capacity} = row
    if (updateTimestamp(startsAt) && typeof court === 'string' && court.trim() &&
      court.trim().length <= 120 && !/\p{Cc}/u.test(court) && typeof capacity === 'number' &&
      Number.isInteger(capacity) && capacity >= 2 && capacity <= 32) {
      return {action,...target,startsAt,court:court.trim(),capacity}
    }
  }
  throw Error('Check the time, court, and number of spots.')
}

export function groupPracticeStart(date: string,time: string) {
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || !/^\d\d:\d\d$/.test(time)) throw Error('Choose a date and time.')
  const local = new Date(date+'T'+time)
  const pad = (value: number) => String(value).padStart(2,'0')
  const roundTrip = `${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`
  if (roundTrip !== date+'T'+time || local.getTime() <= Date.now()) throw Error('Choose an upcoming date and time.')
  return local.toISOString()
}

export function readGroupPractice(value: unknown): GroupPractice | null {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) throw Error('Practice details changed.')
  const row = value as Record<string, unknown>
  const {id,startsAt,court,capacity,mine,inCount,players} = row
  if (!teamChatMessageId(id) || !updateTimestamp(startsAt) || typeof court !== 'string' || !court.trim() ||
    court.length > 120 || typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 2 || capacity > 32 ||
    (mine !== 'in' && mine !== 'out' && mine !== null) ||
    typeof inCount !== 'number' || !Number.isInteger(inCount) || inCount < 0 || inCount > capacity ||
    !Array.isArray(players) || players.length > inCount ||
    players.some(player => !teamChatMessageId(player?.id) || typeof player?.name !== 'string' || !player.name.trim() ||
      player.name.length > 100) || new Set(players.map(player=>player.id)).size !== players.length) {
    throw Error('Practice details changed.')
  }
  return {id,startsAt,court,capacity,mine,inCount,players:players.map(player=>({id:player.id,name:player.name}))}
}
