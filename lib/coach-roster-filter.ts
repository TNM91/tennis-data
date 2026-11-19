export const coachRosterStatuses = ['all', 'active', 'needs_assignment', 'review_notes', 'paused'] as const
export const coachRosterConnections = ['all', 'connected', 'roster'] as const
export type CoachRosterFilter = {q: string; status: typeof coachRosterStatuses[number]; connection: typeof coachRosterConnections[number]}
export const emptyCoachRosterFilter = (): CoachRosterFilter => ({q: '', status: 'all', connection: 'all'})
export function readCoachRosterFilter(params: URLSearchParams): CoachRosterFilter {
  const q = (params.get('q') ?? '').trim(), status = params.get('status') ?? 'all', connection = params.get('connection') ?? 'all'
  if (q.length > 100 || /[\u0000-\u001f\u007f]/.test(q) || !coachRosterStatuses.some(s => s === status) || !coachRosterConnections.some(s => s === connection)) throw Error('Invalid roster filter')
  return {q, status: status as CoachRosterFilter['status'], connection: connection as CoachRosterFilter['connection']}
}
export function coachRosterParams(filter: CoachRosterFilter) {
  return new URLSearchParams({...(filter.q ? {q: filter.q} : {}), ...(filter.status !== 'all' ? {status: filter.status} : {}), ...(filter.connection !== 'all' ? {connection: filter.connection} : {})})
}
export const coachRosterPattern = (query: string) => '%' + query.replace(/[\\%_]/g, '\\$&') + '%'
