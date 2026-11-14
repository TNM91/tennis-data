import { hittingPlanStart, hittingPlanTimeZone } from './hitting-plan'
import { listedHittingClub } from './hitting-clubs'
import { updateTimestamp } from './native-updates-contract'
import { teamChatMessageId } from './team-chat-cursor'

type HitTime = { date: string; time: string; clubId: string }
export type ChatHitAction =
  | ({ action: 'hit_propose'; room: string; id: string } & HitTime)
  | ({ action: 'hit_suggest'; room: string; id: string; replaces: string } & HitTime)
  | { action: 'hit_reply'; room: string; id: string; response: 'accepted' | 'declined' }
  | { action: 'hit_cancel'; room: string; id: string }

const hitStatuses = ['proposed', 'accepted', 'declined', 'cancelled'] as const
export type ChatHit = HitTime & {
  room: string; id: string; startsAt: string; proposedBy: string; status: typeof hitStatuses[number]
}
export type CalendarChatHit = ChatHit & { partner: string }
export const chatHitsHeader = 'X-TenAceIQ-Chat-Hits'
export const chatHitChangesHeader = 'X-TenAceIQ-Chat-Hit-Changes'

export function readHitTime(value: Record<string, unknown>): HitTime {
  const { date, time, clubId } = value
  const club = listedHittingClub(clubId)
  if (!club || typeof date !== 'string' || typeof time !== 'string' || !hittingPlanStart({date,time})) {
    throw Error('Choose a listed club and a valid Central start time.')
  }
  return { date, time, clubId: club.id }
}

export function parseChatHitAction(value: Record<string, unknown>): ChatHitAction | null {
  const { action, room, id, response } = value
  if (action!=='hit_propose' && action!=='hit_suggest' && action!=='hit_reply' && action!=='hit_cancel') return null
  if (!teamChatMessageId(room) || !teamChatMessageId(id)) throw Error('Open the hitting plan again.')
  const target = { room: room.toLowerCase(), id: id.toLowerCase() }
  const size = Object.keys(value).length
  if (action==='hit_propose' && size===6) return { action, ...target, ...readHitTime(value) }
  if (action==='hit_suggest' && size===7 && teamChatMessageId(value.replaces) && value.replaces.toLowerCase()!==target.id) {
    return { action, ...target, replaces:value.replaces.toLowerCase(), ...readHitTime(value) }
  }
  if (action==='hit_reply' && size===4 && (response==='accepted' || response==='declined')) return { action, ...target, response }
  if (action==='hit_cancel' && size===3) return { action, ...target }
  throw Error('Review the hitting plan before trying again.')
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw Error('Hitting plans couldn’t load.')
  return value as Record<string, unknown>
}

export function readChatHit(value: unknown): ChatHit {
  const row = record(value)
  const { id, room, startsAt, proposedBy, status } = row
  const time = readHitTime(row)
  if (!teamChatMessageId(id) || !teamChatMessageId(room) || !teamChatMessageId(proposedBy) ||
      !hitStatuses.some(candidate=>candidate===status) || !updateTimestamp(startsAt)) throw Error('Hitting plans couldn’t load.')
  const wall = new Intl.DateTimeFormat('en-CA',{
    timeZone:hittingPlanTimeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',
  })
  const fields = Object.fromEntries(wall.formatToParts(new Date(startsAt)).map(part=>[part.type,part.value]))
  if (`${fields.year}-${fields.month}-${fields.day}`!==time.date || `${fields.hour}:${fields.minute}`!==time.time) throw Error('Hitting plan time changed.')
  return { ...time, id, room, startsAt, proposedBy, status:status as ChatHit['status'] }
}

export function readCalendarChatHits(value: unknown, from: string, to: string): CalendarChatHit[] {
  if (!Array.isArray(value) || value.length>100) throw Error('Hitting plans couldn’t load.')
  const seen = new Set<string>()
  return value.map(raw=>{
    const row = record(raw), plan = readChatHit(row), partner = row.partner
    if (plan.status!=='accepted' || plan.date<from || plan.date>to || seen.has(plan.id) ||
        typeof partner!=='string' || !partner.trim() || partner.length>100 || /\p{Cc}/u.test(partner)) throw Error('Hitting plans couldn’t load.')
    seen.add(plan.id)
    return {...plan,partner}
  })
}
