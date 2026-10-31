import type {SupabaseClient} from '@supabase/supabase-js'
import {buildCoachStudentLinkPayload, buildCoachAssignmentPayload, buildCoachAssignmentReview, getPlayerAssignmentCheckIn, mapCoachAssignmentRow, type CoachStudentLinkRow, type CoachAssignmentRow} from './coach-storage'
import {readNativeCoach, type NativeCoachStudent, type CoachCreate, type CoachReview} from './native-coach-contract'

const studentFields = 'id,coach_user_id,player_user_id,player_name,identity_slug,level_label,status,notes,updated_at'
const assignmentFields = 'id,coach_user_id,student_link_id,title,focus,due_date,status,assignment_json,updated_at'
export class NativeCoachFault extends Error {
  constructor(public status: number, message: string) {super(message)}
}
function student(row: CoachStudentLinkRow, owner: string): NativeCoachStudent {
  if (row.coach_user_id !== owner) throw Error('Coach ownership mismatch')
  return {id: row.id, name: row.player_name, level: row.level_label, identity: row.identity_slug, status: row.status as NativeCoachStudent['status'], linked: Boolean(row.player_user_id), notes: row.notes, updatedAt: row.updated_at}
}
async function ownStudent(client: SupabaseClient, owner: string, id: string) {
  const {data, error} = await client.from('coach_player_links').select(studentFields).eq('coach_user_id', owner).eq('id', id).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
  if (error) throw Error('Student read failed')
  if (!data) throw new NativeCoachFault(404, 'That student is no longer in your Coach workspace.')
  return student(data as CoachStudentLinkRow, owner)
}
export async function loadNativeCoach(client: SupabaseClient, owner: string, selected = '') {
  const {data, error} = await client.from('coach_player_links').select(studentFields).eq('coach_user_id', owner).order('updated_at', {ascending: false}).limit(101).abortSignal(AbortSignal.timeout(12000))
  if (error) throw Error('Coach students unavailable')
  const students = ((data ?? []) as CoachStudentLinkRow[]).slice(0, 100).map(row => student(row, owner))
  let detail = null
  if (selected) {
    const s = await ownStudent(client, owner, selected)
    const result = await client.from('coach_assignments').select(assignmentFields).eq('coach_user_id', owner).eq('student_link_id', selected).order('updated_at', {ascending: false}).limit(101).abortSignal(AbortSignal.timeout(12000))
    if (result.error) throw Error('Coach assignments unavailable')
    const rows = (result.data ?? []) as (CoachAssignmentRow & {coach_user_id: string})[]
    if (rows.some(row => row.coach_user_id !== owner)) throw Error('Assignment ownership mismatch')
    detail = {student: s, assignments: rows.slice(0, 100).map(mapCoachAssignmentRow), moreAssignments: rows.length > 100}
  }
  return readNativeCoach({ok: true, owner, checkedAt: new Date().toISOString(), students, moreStudents: (data?.length ?? 0) > 100, detail}, owner, selected)
}
export async function createNativeCoach(client: SupabaseClient, owner: string, draft: CoachCreate) {
  if (draft.kind === 'student') {
    const payload = buildCoachStudentLinkPayload({id: draft.id, playerName: draft.name, levelLabel: draft.level, notes: draft.notes, status: 'needs_assignment', setupStatus: 'manual', contactPreference: 'in_app'}, owner)!
    const {error} = await client.from('coach_player_links').insert(payload)
    if (error) throw error.code === '23505' ? new NativeCoachFault(409, 'This record may already be saved. Check the saved record before retrying.') : Error('Student save failed')
    return loadNativeCoach(client, owner, draft.id)
  }
  const s = await ownStudent(client, owner, draft.student)
  if (s.updatedAt !== draft.expectedUpdatedAt || s.status === 'paused') throw new NativeCoachFault(409, 'The student record changed or is paused. Refresh before assigning work.')
  const payload = buildCoachAssignmentPayload({id: draft.id, studentLinkId: draft.student, title: draft.title, focus: draft.focus, dueDate: draft.dueDate, status: draft.status, assignment: {detail: draft.instructions, expectedEvidence: draft.evidence}}, owner)!
  const {error} = await client.from('coach_assignments').insert(payload)
  if (error) throw error.code === '23505' ? new NativeCoachFault(409, 'This assignment may already be saved. Check saved work before retrying.') : Error('Assignment save failed')
  return loadNativeCoach(client, owner, draft.student)
}
export async function reviewNativeCoach(client: SupabaseClient, owner: string, draft: CoachReview) {
  await ownStudent(client, owner, draft.student)
  const result = await client.from('coach_assignments').select(assignmentFields).eq('coach_user_id', owner).eq('student_link_id', draft.student).eq('id', draft.id).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
  if (result.error) throw Error('Assignment read failed')
  if (!result.data) throw new NativeCoachFault(404, 'That assignment is no longer available.')
  const row = result.data as CoachAssignmentRow & {coach_user_id: string}
  if (row.coach_user_id !== owner) throw Error('Assignment ownership mismatch')
  const a = mapCoachAssignmentRow(row)
  if (a.updatedAt !== draft.expectedUpdatedAt || a.status !== 'completed' || !getPlayerAssignmentCheckIn(a.assignment)) throw new NativeCoachFault(409, 'This check-in changed. Refresh and review the latest player update.')
  const update = {assignment_json: buildCoachAssignmentReview(a.assignment, draft), updated_at: new Date(Math.max(Date.now(), Date.parse(a.updatedAt) + 1)).toISOString()}
  const saved = await client.from('coach_assignments').update(update).eq('coach_user_id', owner).eq('student_link_id', draft.student).eq('id', draft.id).eq('updated_at', draft.expectedUpdatedAt).select('id').maybeSingle()
  if (saved.error) throw Error('Coach review save failed')
  if (!saved.data) throw new NativeCoachFault(409, 'A newer check-in arrived. Refresh before saving your feedback.')
  return loadNativeCoach(client, owner, draft.student)
}
