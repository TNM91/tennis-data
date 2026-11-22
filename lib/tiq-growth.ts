import {isValidCalendarDate} from './calendar-date'
import {tiqSkills, type TiqSkillId} from './tiq-assessment-skills'
import {readTiqAssessment, tiqUuid, type TiqAssessment} from './tiq-self-assessment'

export type PracticeBlock = {version: 1; skill: TiqSkillId; target: string; sessions: number; reviewDate: string}
export function practiceBlockTiming(block:Pick<PracticeBlock,'reviewDate'>,now=new Date()):'ready'|'past'|'future'|'unavailable'{
  const today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())
  if(!Number.isFinite(today)||!isValidCalendarDate(block.reviewDate))return 'unavailable'
  const days=(Date.parse(block.reviewDate+'T00:00:00Z')-today)/86400000
  return days < -1?'past':days > 366?'future':'ready'
}
export type GrowthSession = {id: string; date: string; note: string}
export type GrowthPlan = PracticeBlock & {id: string; baseline: string; sourceAssignment: string | null;
  state: 'active' | 'reviewed' | 'archived'; logs: GrowthSession[]; assessment: string | null;
  revision: string; createdAt: string; updatedAt: string}
export type GrowthSummary = Omit<GrowthPlan, 'logs'> & {completed: number}
export type GrowthSnapshot = {owner: string; plans: GrowthSummary[]; more: boolean; selected: GrowthPlan | null;
  baseline: TiqAssessment | null; reassessment: TiqAssessment | null}
export type GrowthWrite = {id: string; operation: string; expected: string | null} & (
  | {kind: 'new'; baseline: string; block: PracticeBlock; sourceAssignment: string | null}
  | {kind: 'log'; session: GrowthSession}
  | {kind: 'review'; assessment: string}
  | {kind: 'archive'})
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Review your practice plan.')
  return value as Record<string, unknown>
}
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw Error('Unexpected practice field.')
}
const text = (value: unknown, max: number, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw Error('Use a shorter practice target or note.')
  return value.trim()
}
const day = (value: unknown) => {
  if (typeof value !== 'string' || !isValidCalendarDate(value)) throw Error('Choose a valid review date.')
  return value
}
const stamp = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw Error('Practice date unavailable.')
  return value
}
export function readPracticeBlock(value: unknown): PracticeBlock {
  const r = object(value); keys(r, ['version', 'skill', 'target', 'sessions', 'reviewDate'])
  const skill = tiqSkills.find(skill => skill.id === r.skill)
  if (r.version !== 1 || !skill || !Number.isInteger(r.sessions) || Number(r.sessions) < 1 || Number(r.sessions) > 12) throw Error('Choose one skill and 1–12 practices.')
  return {version: 1, skill: skill.id, target: text(r.target, 240, true), sessions: Number(r.sessions), reviewDate: day(r.reviewDate)}
}
const readLog = (value: unknown): GrowthSession => {
  const r = object(value); keys(r, ['id', 'date', 'note'])
  return {id: tiqUuid(r.id), date: day(r.date), note: text(r.note, 160)}
}
export function readGrowthPlan(value: unknown): GrowthPlan {
  const r = object(value), block = readPracticeBlock(r.block)
  if (!['active', 'reviewed', 'archived'].includes(String(r.state)) || !Array.isArray(r.logs) || r.logs.length > 24) throw Error('Practice plan unavailable.')
  const logs = r.logs.map(readLog)
  if (new Set(logs.map(log => log.id)).size !== logs.length) throw Error('Practice log unavailable.')
  if (r.state === 'reviewed' && r.assessment === null || r.state === 'active' && r.assessment !== null) throw Error('Practice review unavailable.')
  const source = r.sourceAssignment === null ? null : text(r.sourceAssignment, 120, true)
  if (source && !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(source)) throw Error('Coach assignment unavailable.')
  return {...block, id: tiqUuid(r.id), baseline: tiqUuid(r.baseline), sourceAssignment: source,
    state: r.state as GrowthPlan['state'], logs, assessment: r.assessment === null ? null : tiqUuid(r.assessment),
    revision: tiqUuid(r.revision), createdAt: stamp(r.createdAt), updatedAt: stamp(r.updatedAt)}
}
export function readGrowthSnapshot(value: unknown, owner: string): GrowthSnapshot {
  const r = object(value)
  if (r.ok !== true || r.owner !== owner || !Array.isArray(r.plans) || r.plans.length > 25 || typeof r.more !== 'boolean') throw Error('Your practice account changed.')
  const plans = r.plans.map(value => {
    const raw = object(value), {logs: _logs, ...plan} = readGrowthPlan({...raw, logs: []})
    void _logs
    if (!Number.isInteger(raw.completed) || Number(raw.completed) < 0 || Number(raw.completed) > 24) throw Error('Practice count unavailable.')
    return {...plan, completed: Number(raw.completed)}
  }), selected = r.selected === null ? null : readGrowthPlan(r.selected)
  if (new Set(plans.map(plan => plan.id)).size !== plans.length || plans.filter(plan => plan.state === 'active').length > 1) throw Error('Refresh your practice plans.')
  const baseline = r.baseline === null ? null : readTiqAssessment(r.baseline)
  const reassessment = r.reassessment === null ? null : readTiqAssessment(r.reassessment)
  if (baseline && baseline.id !== selected?.baseline || reassessment && reassessment.id !== selected?.assessment || !selected && (baseline || reassessment)) throw Error('Practice assessment changed.')
  return {owner, plans, more: r.more, selected, baseline, reassessment}
}
export function readGrowthWrite(value: unknown): GrowthWrite {
  const r = object(value), base = {id: tiqUuid(r.id), operation: tiqUuid(r.operation), expected: r.expected === null ? null : tiqUuid(r.expected)}
  const common = ['kind', 'id', 'operation', 'expected']
  if (r.kind === 'new') {
    keys(r, [...common, 'baseline', 'block', 'sourceAssignment'])
    const source = r.sourceAssignment === null ? null : text(r.sourceAssignment, 120, true)
    if (base.expected !== null || source && !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(source)) throw Error('Review the new practice plan.')
    return {...base, kind: 'new', baseline: tiqUuid(r.baseline), block: readPracticeBlock(r.block), sourceAssignment: source}
  }
  if (!base.expected) throw Error('Refresh before changing this plan.')
  if (r.kind === 'log') {keys(r, [...common, 'session']); return {...base, kind: 'log', session: readLog(r.session)}}
  if (r.kind === 'review') {keys(r, [...common, 'assessment']); return {...base, kind: 'review', assessment: tiqUuid(r.assessment)}}
  if (r.kind === 'archive') {keys(r, common); return {...base, kind: 'archive'}}
  throw Error('Choose a practice action.')
}
export function growthReady(plan: GrowthPlan, today: string) {
  return plan.state === 'active' && (plan.logs.length >= plan.sessions || plan.reviewDate <= today)
}
export function growthSnapshotWire(snapshot: GrowthSnapshot) {
  const wire = (plan: GrowthPlan | GrowthSummary) => {
    const {version, skill, target, sessions, reviewDate, ...rest} = plan
    return {...rest, block: {version, skill, target, sessions, reviewDate}}
  }
  return {...snapshot, ok: true, plans: snapshot.plans.map(wire), selected: snapshot.selected ? wire(snapshot.selected) : null}
}
export function growthCheckIn(plan: GrowthPlan) {
  return {recap: `${plan.logs.length} of ${plan.sessions} planned practices completed. Target: ${plan.target}`.slice(0, 700),
    evidence: plan.logs.slice(-3).map(log => `${log.date}: ${log.note || 'Practice completed'}`).join('\n').slice(0, 300)}
}

// One stable event per plan. Export is deliberate; calendar apps control their alerts.
export function growthReminderCalendar(plan: GrowthPlan, time: string, owner: string, now = new Date()) {
  if (!/^\d\d:\d\d$/.test(time) || !Number.isFinite(now.getTime())) throw Error('Choose a reminder time.')
  const [y, m, d] = plan.reviewDate.split('-').map(Number), [h, minute] = time.split(':').map(Number)
  const date = new Date(y, m - 1, d, h, minute)
  if (h > 23 || minute > 59 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d || date.getHours() !== h || date.getMinutes() !== minute || date <= now) throw Error('Choose a future time that exists in your time zone.')
  const utc = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const uid = `${tiqUuid(owner)}.${plan.id}@review.tenaceiq.com`
  const sequence = Math.floor(Date.parse(plan.updatedAt) / 1000)
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TenAceIQ//TiQ Review//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${uid}`, `SEQUENCE:${sequence}`, `DTSTAMP:${utc(now)}`, `DTSTART:${utc(date)}`, `DTEND:${utc(new Date(date.getTime() + 15 * 60_000))}`,
    'SUMMARY:TiQ progress review', 'DESCRIPTION:Open TenAceIQ to review your practice and retake your self-assessment.',
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:TiQ progress review', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', '']
    .map(line => line.match(/.{1,74}/g)?.join('\r\n ') ?? '').join('\r\n')
}
