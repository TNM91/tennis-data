import type {SupabaseClient} from '@supabase/supabase-js'
import {NativeCoachFault} from './native-coach'
import {isCoachInviteExpired} from './coach-invites'
import {readCoachInvitations, type CoachInviteIntent} from './native-coach-invite-contract'

const inviteFields = 'id,coach_user_id,student_link_id,invite_email,invite_token,status,message,expires_at,updated_at'
async function student(client: SupabaseClient, owner: string, id: string) {
 const {data, error} = await client.from('coach_player_links').select('id,coach_user_id,player_name,player_user_id,status,updated_at').eq('coach_user_id', owner).eq('id', id).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
 if (error) throw Error('Student unavailable')
 if (!data) throw new NativeCoachFault(404, 'That student is no longer available.')
 if (data.coach_user_id !== owner) throw Error('Student owner mismatch')
 return {id: data.id as string, name: data.player_name as string, linked: Boolean(data.player_user_id), paused: data.status === 'paused', updatedAt: data.updated_at as string}
}
export async function loadCoachInvitations(client: SupabaseClient, owner: string, id: string) {
 const s = await student(client, owner, id)
 const {data, error} = await client.from('coach_student_invites').select(inviteFields).eq('coach_user_id', owner).eq('student_link_id', id).order('updated_at', {ascending: false}).limit(101).abortSignal(AbortSignal.timeout(12000))
 if (error) throw Error('Invitations unavailable')
 const invites = (data ?? []).slice(0, 100).map(row => {
  if (row.coach_user_id !== owner) throw Error('Invitation owner mismatch')
  const status = row.status === 'pending' && isCoachInviteExpired(row.expires_at) ? 'expired' : row.status
  const token = typeof row.invite_token === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(row.invite_token) ? row.invite_token : ''
  return {id: row.id, student: id, email: row.invite_email, message: row.message, status, expiresAt: row.expires_at, updatedAt: row.updated_at, href: status === 'pending' && token && !s.linked && !s.paused ? 'https://www.tenaceiq.com/coach/invite/' + token : ''}
 })
 return readCoachInvitations({ok: true, owner, student: s, invites, more: (data?.length ?? 0) > 100}, owner, id)
}
export async function saveCoachInvitation(client: SupabaseClient, owner: string, intent: CoachInviteIntent) {
 const s = await student(client, owner, intent.student)
 if (intent.action === 'create') {
  if (s.linked || s.paused || s.updatedAt !== intent.expectedUpdatedAt) throw new NativeCoachFault(409, 'The student connection changed. Refresh before creating an invitation.')
  const now = Date.now()
  const {error} = await client.from('coach_student_invites').insert({id: intent.id, coach_user_id: owner, student_link_id: intent.student, invite_email: intent.email, invite_token: crypto.randomUUID(), status: 'pending', message: intent.message, expires_at: new Date(now + 7 * 86400000).toISOString(), updated_at: new Date(now).toISOString()})
  if (error) throw error.code === '23505' ? new NativeCoachFault(409, 'This invitation may already be saved. Check invitations before retrying.') : Error('Invitation save failed')
 } else {
  const {data, error} = await client.from('coach_student_invites').update({status: 'revoked', updated_at: new Date(Math.max(Date.now(), Date.parse(intent.expectedUpdatedAt) + 1)).toISOString()}).eq('coach_user_id', owner).eq('student_link_id', intent.student).eq('id', intent.id).eq('status', 'pending').eq('updated_at', intent.expectedUpdatedAt).select('id').maybeSingle()
  if (error) throw Error('Invitation revoke failed')
  if (!data) throw new NativeCoachFault(409, 'This invitation changed. Refresh before trying again.')
 }
 return loadCoachInvitations(client, owner, intent.student)
}
