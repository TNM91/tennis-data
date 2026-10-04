export type PlayerImportFreshness = { status: 'current' | 'overdue' | 'pending' | 'review' | 'unknown'; lastImportedAt: string | null; nextRefreshAt: string | null; pendingPages: number; reviewPages: number }
export type ImportPage = { status: string; current_refreshed_at: string | null; refresh_due_at: string | null }
export const unknownImportFreshness: PlayerImportFreshness = { status: 'unknown', lastImportedAt: null, nextRefreshAt: null, pendingPages: 0, reviewPages: 0 }
/** Conservative coverage: the oldest successful owner-history capture, never a queue attempt or profile observation. */
export function summarizePlayerImportFreshness(rows: ImportPage[], expectedPages: number, now = new Date()): PlayerImportFreshness {
  const valid = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? value : null
  const captures = rows.map(r => valid(r.current_refreshed_at)).filter((v): v is string => Boolean(v)).sort((a,b) => Date.parse(a)-Date.parse(b))
  const dues = rows.map(r => valid(r.refresh_due_at)).filter((v): v is string => Boolean(v)).sort((a,b) => Date.parse(a)-Date.parse(b))
  const reviewPages = rows.filter(r => ['review','error','blocked'].includes(r.status)).length
  const pendingPages = rows.filter(r => ['pending','running'].includes(r.status)).length
  const complete = rows.length === expectedPages && captures.length === expectedPages && dues.length === expectedPages && expectedPages > 0
  const overdue = dues.some(d => Date.parse(d) < now.getTime())
  return { status: reviewPages ? 'review' : !complete ? 'pending' : overdue ? 'overdue' : 'current', lastImportedAt: captures.length === expectedPages ? captures[0] : null, nextRefreshAt: dues[0] ?? null, pendingPages, reviewPages }
}
