import {CapacitorHttp, type HttpOptions, type HttpResponse} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner} from './captain-scenarios-data'
import {readNativeCoach, type NativeCoachSnapshot, type CoachCreate, type CoachReview} from '../../lib/native-coach-contract'
import {getCoachAssignmentReview} from '../../lib/coach-storage'

export type CoachSend = (method: 'GET' | 'POST' | 'PATCH', options: HttpOptions) => Promise<HttpResponse>
const transport: CoachSend = (method, options) => method === 'GET' ? CapacitorHttp.get(options) : method === 'POST' ? CapacitorHttp.post(options) : CapacitorHttp.patch(options)
export class CoachWorkspaceError extends Error {
  constructor(public status: number) {super(status === 403 ? 'Coach access is required for this account.' : status === 401 ? 'Sign in again to open Coach.' : status === 409 ? 'This record changed. Check saved work before trying again.' : status === 404 ? 'That student is no longer available.' : 'Coach records could not be confirmed. Check your connection and try again.')}
}
async function request(client: SupabaseClient, owner: string, current: () => boolean, method: 'GET' | 'POST' | 'PATCH', selected: string, data: CoachCreate | CoachReview | undefined, send: CoachSend) {
  const session = await scenarioOwner(client, owner, current)
  const response = await send(method, {url: 'https://www.tenaceiq.com/api/mobile/coach' + (method === 'GET' && selected ? '?' + new URLSearchParams({student: selected}) : ''), headers: {Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json', 'Cache-Control': 'no-store'}, webFetchExtra: {cache: 'no-store'}, disableRedirects: true, responseType: 'json', connectTimeout: 12000, readTimeout: 30000, ...(data ? {data} : {})})
  await scenarioOwner(client, owner, current)
  if (response.status !== 200) throw new CoachWorkspaceError(response.status)
  return readNativeCoach(response.data, owner, selected)
}
export function loadCoachWorkspace(client: SupabaseClient, owner: string, current: () => boolean, selected = '', send: CoachSend = transport) {return request(client, owner, current, 'GET', selected, undefined, send)}
export function coachWriteMatches(snapshot: NativeCoachSnapshot, draft: CoachCreate | CoachReview): boolean {
  const detail = snapshot.detail
  if (!detail) return false
  if ('kind' in draft && draft.kind === 'student') return detail.student.id === draft.id && detail.student.name === draft.name && detail.student.level === draft.level && detail.student.notes === draft.notes
  const assignment = detail.assignments.find(a => a.id === draft.id)
  if (!assignment || detail.student.id !== draft.student || assignment.studentLinkId !== draft.student) return false
  if ('kind' in draft) return assignment.title === draft.title && assignment.focus === draft.focus && assignment.dueDate === draft.dueDate && (assignment.status === draft.status || draft.status === 'assigned' && assignment.status === 'completed') && assignment.assignment.detail === draft.instructions && assignment.assignment.expectedEvidence === draft.evidence
  const review = getCoachAssignmentReview(assignment.assignment)
  return assignment.updatedAt !== draft.expectedUpdatedAt && review?.note === draft.note && review.nextFocus === draft.nextFocus
}
export async function saveCoachWorkspace(client: SupabaseClient, owner: string, current: () => boolean, draft: CoachCreate | CoachReview, lookup = false, send: CoachSend = transport) {
  const selected = 'kind' in draft && draft.kind === 'student' ? draft.id : draft.student
  const snapshot = await request(client, owner, current, lookup ? 'GET' : 'kind' in draft ? 'POST' : 'PATCH', selected, lookup ? undefined : draft, send)
  if (!lookup && !coachWriteMatches(snapshot, draft)) throw new CoachWorkspaceError(503)
  return {snapshot, confirmed: coachWriteMatches(snapshot, draft)}
}
