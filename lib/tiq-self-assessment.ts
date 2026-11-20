import {isValidCalendarDate} from './calendar-date'
import {tiqSkills, type TiqSkillId} from './tiq-assessment-skills'

export type TiqAnswer = 0 | 1 | 2 | 3
export type TiqFormatQuestion = 'singles-build' | 'singles-cover' | 'doubles-coverage' | 'doubles-patterns'
export type TiqAnswers = Record<TiqSkillId, TiqAnswer> & Partial<Record<TiqFormatQuestion, TiqAnswer>>
export type TiqAssessment = {id: string; date: string; answers: TiqAnswers; createdAt: string; version: 1}
export type TiqCursor = Pick<TiqAssessment, 'id' | 'date' | 'createdAt'>
export type TiqCoach = {id: string; name: string; updatedAt: string}
export type TiqShare = {assessment: string; student: string; name: string; operation: string; shared: boolean; active: boolean}
export type TiqHistory = {owner: string; student: string | null; head: TiqAssessment | null; items: TiqAssessment[];
  next: TiqCursor | null; coaches: TiqCoach[]; moreCoaches: boolean; shares: TiqShare[]}
export type TiqWrite =
  | {kind: 'save'; id: string; date: string; answers: TiqAnswers; expectedHead: string | null; version: 1}
  | {kind: 'delete'; id: string}
  | {kind: 'share' | 'revoke'; id: string; student: string; linkUpdatedAt: string; operation: string; expected: string | null}

const pairs = [['singles-build', 'singles-cover'], ['doubles-coverage', 'doubles-patterns']] as const
const ids = [...tiqSkills.map(skill => skill.id), ...pairs.flat()]
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid TiQ record')
  return value as Record<string, unknown>
}
export const tiqUuid = (value: unknown) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw Error('Invalid TiQ ID')
  return value.toLowerCase()
}
const stamp = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw Error('Invalid TiQ time')
  return value
}
const day = (value: unknown) => {
  if (typeof value !== 'string' || !isValidCalendarDate(value)) throw Error('Invalid assessment date')
  return value
}
const link = (value: unknown) => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/.test(value)) throw Error('Invalid coach connection')
  return value
}
const name = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 300) throw Error('Invalid coach name')
  return value
}
const keys = (r: Record<string, unknown>, allowed: string[]) => {
  if (Object.keys(r).some(key => !allowed.includes(key))) throw Error('Unexpected TiQ field')
}
export function readTiqAnswers(value: unknown): TiqAnswers {
  const r = object(value)
  if (Object.keys(r).some(key => !ids.includes(key as typeof ids[number]))) throw Error('Invalid skill')
  for (const {id} of tiqSkills) if (!Object.hasOwn(r, id)) throw Error('Complete all six skills')
  for (const [first, second] of pairs) if (Object.hasOwn(r, first) !== Object.hasOwn(r, second)) throw Error('Complete both format answers')
  const result: Record<string, TiqAnswer> = {}
  for (const [id, answer] of Object.entries(r)) {
    if (answer !== 0 && answer !== 1 && answer !== 2 && answer !== 3) throw Error('Invalid skill level')
    result[id] = answer
  }
  return result as TiqAnswers
}
export function estimateTiqScore(answers: readonly TiqAnswer[]) {
  return 1 + Math.round(3 * answers.reduce<number>((sum, answer) => sum + answer, 0) / answers.length)
}
export function readTiqAssessment(value: unknown): TiqAssessment {
  const r = object(value)
  if (r.version !== 1) throw Error('Unsupported assessment version')
  return {id: tiqUuid(r.id), date: day(r.date), answers: readTiqAnswers(r.answers), createdAt: stamp(r.createdAt), version: 1}
}
export function readTiqCursor(value: unknown): TiqCursor {
  const r = object(value); keys(r, ['id', 'date', 'createdAt'])
  return {id: tiqUuid(r.id), date: day(r.date), createdAt: stamp(r.createdAt)}
}
export function readTiqWrite(value: unknown): TiqWrite {
  const r = object(value), id = tiqUuid(r.id)
  if (r.kind === 'save') {
    keys(r, ['kind', 'id', 'date', 'answers', 'expectedHead', 'version'])
    if (r.version !== 1) throw Error('Unsupported assessment version')
    return {kind: 'save', id, date: day(r.date), answers: readTiqAnswers(r.answers), expectedHead: r.expectedHead === null ? null : tiqUuid(r.expectedHead), version: 1}
  }
  if (r.kind === 'delete') {keys(r, ['kind', 'id']); return {kind: 'delete', id}}
  if (r.kind !== 'share' && r.kind !== 'revoke') throw Error('Invalid TiQ action')
  keys(r, ['kind', 'id', 'student', 'linkUpdatedAt', 'operation', 'expected'])
  return {kind: r.kind, id, student: link(r.student), linkUpdatedAt: stamp(r.linkUpdatedAt), operation: tiqUuid(r.operation), expected: r.expected === null ? null : tiqUuid(r.expected)}
}
export function readTiqHistory(value: unknown, owner: string, student: string | null = null): TiqHistory {
  const r = object(value)
  if (r.ok !== true || r.owner !== owner || r.student !== student || JSON.stringify(r).length > 450000 || !Array.isArray(r.items) || r.items.length > 25
    || !Array.isArray(r.coaches) || r.coaches.length > 50 || !Array.isArray(r.shares) || r.shares.length > 1250 || typeof r.moreCoaches !== 'boolean') throw Error('TiQ account changed')
  const items = r.items.map(readTiqAssessment), head = r.head === null ? null : readTiqAssessment(r.head)
  const coaches = r.coaches.map(value => {const c = object(value); return {id: link(c.id), name: name(c.name), updatedAt: stamp(c.updatedAt)}})
  const shares = r.shares.map(value => {
    const s = object(value)
    if (typeof s.shared !== 'boolean' || typeof s.active !== 'boolean' || (s.active && !s.shared)) throw Error('Invalid sharing status')
    return {assessment: tiqUuid(s.assessment), student: link(s.student), name: name(s.name), operation: tiqUuid(s.operation), shared: s.shared, active: s.active}
  })
  if (new Set(items.map(item => item.id)).size !== items.length || new Set(coaches.map(coach => coach.id)).size !== coaches.length
    || new Set(shares.map(share => share.assessment + ':' + share.student)).size !== shares.length
    || shares.some(share => !items.some(item => item.id === share.assessment)) || (student && (coaches.length || shares.length || r.moreCoaches))) throw Error('Invalid TiQ scope')
  return {owner, student, head, items, coaches, shares, moreCoaches: r.moreCoaches, next: r.next === null ? null : readTiqCursor(r.next)}
}
