import type {TeamRoomScope} from './team-room'
export type TeamFixture={id:string;date:string;time:string;home:string;away:string;facility:string;status:string;score:string}
export type TeamFixtures={scope:TeamRoomScope;today:string;from:string;until:string;upcoming:TeamFixture[];earlier:TeamFixture[];moreUpcoming:boolean;moreEarlier:boolean}
export const fixtureId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
export function fixtureDate(value:unknown):value is string{if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value}
export type ReviewedNextMatch = { opponent: string; date: string; time: string; facility: string; timeZone: string }
export type TeamNextMatchChange = { revision: string; expected: string | null; nextMatch: ReviewedNextMatch | null }
export function readReviewedNextMatch(value: unknown): ReviewedNextMatch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const { opponent, date, time, facility, timeZone } = value as Record<string, unknown>
  if (typeof opponent !== 'string' || !opponent.trim() || opponent.length > 240 || !fixtureDate(date) ||
      typeof time !== 'string' || time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      typeof facility !== 'string' || facility.length > 240 ||
      typeof timeZone !== 'string' || !timeZone || timeZone.length > 80) return null
  try { new Intl.DateTimeFormat('en', { timeZone }) } catch { return null }
  return { opponent, date, time, facility, timeZone }
}
export function readTeamNextMatchChange(value: Record<string, unknown>): TeamNextMatchChange | null {
  const { revision, expected } = value
  if (!fixtureId(revision) || expected !== null && !fixtureId(expected) || revision === expected) return null
  if (value.nextMatch === null) return expected ? { revision, expected, nextMatch: null } : null
  const match = readReviewedNextMatch(value.nextMatch)
  if (!match || /\p{Cc}/u.test(match.opponent + match.facility) ||
      match.opponent.length > 120 || match.facility.length > 160) return null
  return { revision, expected, nextMatch: { ...match, opponent: match.opponent.trim(), facility: match.facility.trim() } }
}
export const fixtureCancelled=(fixture:TeamFixture)=>/cancel|postpon/i.test(fixture.status)
export const fixtureSide=(fixture:TeamFixture,scope:TeamRoomScope)=>fixture.home===scope.teamName?'Home':'Away'
export const fixtureOpponent=(fixture:TeamFixture,scope:TeamRoomScope)=>fixture.home===scope.teamName?fixture.away:fixture.home

export function fixtureWindow(today:string){if(!fixtureDate(today))throw Error('Invalid schedule date');const shift=(days:number)=>{const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10)};return {from:shift(-365),until:shift(180)}}

export const fixtureSignature=(item:TeamFixture)=>JSON.stringify([item.id,item.date,item.time,item.home,item.away,item.facility,item.status,item.score])
