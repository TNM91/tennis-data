import {coachId, coachRecord} from './native-coach-contract'
import {isValidCalendarDate} from './calendar-date'
export type CoachGrowthOverview = {owner: string; day: string; checkedAt: string; more: boolean; limited: boolean;
  counts: Record<'feedback' | 'plan' | 'reassess', number>;
  rows: {kind: 'feedback' | 'plan' | 'reassess'; student: string; name: string; assignment: string | null; title: string; since: string}[]}
export function readCoachGrowthOverview(value: unknown, owner: string, day: string): CoachGrowthOverview {
  const r = coachRecord(value), c = coachRecord(r.counts)
  if (r.ok !== true || r.owner !== owner || r.day !== day || !isValidCalendarDate(day) || typeof r.more !== 'boolean' || typeof r.limited !== 'boolean'
    || typeof r.checkedAt !== 'string' || !Number.isFinite(Date.parse(r.checkedAt)) || !Array.isArray(r.rows) || r.rows.length > 25) throw Error('Coach overview unavailable.')
  const counts = {feedback: Number(c.feedback), plan: Number(c.plan), reassess: Number(c.reassess)}
  if (['feedback','plan','reassess'].some(key=>typeof c[key]!=='number') || Object.values(counts).some(n => !Number.isSafeInteger(n) || n < 0 || n > 3000)) throw Error('Coach counts unavailable.')
  const rows = r.rows.map(value => {
    const row = coachRecord(value)
    if (!['feedback', 'plan', 'reassess'].includes(String(row.kind)) || typeof row.name !== 'string' || row.name.length > 300
      || typeof row.title !== 'string' || row.title.length > 300 || typeof row.since !== 'string' || !Number.isFinite(Date.parse(row.since))) throw Error('Coach attention unavailable.')
    return {kind: row.kind as CoachGrowthOverview['rows'][number]['kind'], student: coachId(row.student), name: row.name,
      assignment: row.assignment === null ? null : coachId(row.assignment), title: row.title, since: row.since}
  })
  if (new Set(rows.map(row => [row.kind, row.student, row.assignment].join(':'))).size !== rows.length) throw Error('Refresh coach attention.')
  return {owner, day, checkedAt: r.checkedAt, counts, rows, more: r.more, limited: r.limited}
}
