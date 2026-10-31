import type {SupabaseClient} from '@supabase/supabase-js'
import {canAcceptCoachInviteEmail, isCoachInviteExpired} from './coach-invites'

export class CoachInviteAcceptanceFault extends Error {constructor(public status: number, message: string) {super(message)}}
const unavailable = () => new CoachInviteAcceptanceFault(409, 'This invitation or student connection changed. Refresh before trying again.')
export async function acceptCoachInvitation(service: SupabaseClient, token: string, user: {id: string; email?: string | null}) {
 const {data: invite, error} = await service.from('coach_student_invites').select('id,coach_user_id,student_link_id,invite_email,status,expires_at,updated_at,accepted_by_user_id').eq('invite_token', token).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
 if (error) throw Error('Invitation read failed')
 if (!invite) throw new CoachInviteAcceptanceFault(404, 'Coach invitation was not found.')
 if (!canAcceptCoachInviteEmail(invite.invite_email, user.email)) throw new CoachInviteAcceptanceFault(403, 'Sign in with the email address this coach invited.')
 const resuming = invite.status === 'accepted' && invite.accepted_by_user_id === user.id
 if (!resuming && invite.status !== 'pending') throw unavailable()
 if (!resuming && isCoachInviteExpired(invite.expires_at)) throw new CoachInviteAcceptanceFault(410, 'This coach invitation has expired.')
 if (invite.coach_user_id === user.id) throw new CoachInviteAcceptanceFault(409, 'Use your student’s account to accept this invitation.')
 const readLink = () => service.from('coach_player_links').select('id,coach_user_id,player_user_id,status,updated_at').eq('coach_user_id', invite.coach_user_id).eq('id', invite.student_link_id).abortSignal(AbortSignal.timeout(12000)).maybeSingle()
 const link = invite.student_link_id ? await readLink() : null
 if (link?.error) throw Error('Student read failed')
 if (invite.student_link_id && (!link?.data || link.data.coach_user_id !== invite.coach_user_id || link.data.status === 'paused' || link.data.player_user_id && link.data.player_user_id !== user.id)) throw unavailable()
 if (!resuming) {
  // Reserve acceptance before connecting. A concurrent revoke or another acceptance wins at most once.
  const now = new Date().toISOString()
  const claimed = await service.from('coach_student_invites').update({status: 'accepted', accepted_by_user_id: user.id, accepted_at: now, updated_at: now}).eq('id', invite.id).eq('coach_user_id', invite.coach_user_id).eq('status', 'pending').eq('updated_at', invite.updated_at).select('id').abortSignal(AbortSignal.timeout(12000)).maybeSingle()
  if (claimed.error) throw Error('Invitation acceptance failed')
  if (!claimed.data) throw unavailable()
 }
 if (link?.data && !link.data.player_user_id) {
  // Never replace a player, re-enable a paused connection, or overwrite a newer coach edit.
  const saved = await service.from('coach_player_links').update({player_user_id: user.id, setup_status: 'linked', status: 'active', updated_at: new Date().toISOString()}).eq('coach_user_id', invite.coach_user_id).eq('id', invite.student_link_id).is('player_user_id', null).eq('updated_at', link.data.updated_at).neq('status', 'paused').select('id').abortSignal(AbortSignal.timeout(12000)).maybeSingle()
  if (saved.error) throw Error('Student connection not confirmed')
  if (!saved.data) {const latest = await readLink(); if (latest.error) throw Error('Student connection not confirmed'); if (latest.data?.player_user_id !== user.id || latest.data?.status === 'paused') throw unavailable()}
 }
}
