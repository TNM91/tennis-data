import 'server-only'
import {after} from 'next/server'
import type {SupabaseClient} from '@supabase/supabase-js'
import {accountClient} from './mobile-account-auth'
import {coachId} from './native-coach-contract'
import {coachActivityPushHref, readCoachActivityPush, type CoachActivity} from './coach-activity'
import {updateId, updateTimestamp} from './native-updates-contract'
import {deliverAppleNotifications, nativePushConfiguration} from './native-chat-push-server'

type Input = {actor: string; assignment: string; kind: CoachActivity['kind']}
type Device = {installation_id: string; profile_id: string; device_token: string; updated_at: string}
export function nativeCoachActivityPayload(recipient: string, href: string) {
  if (!readCoachActivityPush({recipient, href}, recipient)) throw Error('Invalid coaching update')
  return {aps: {alert: {title: 'TenAceIQ', body: 'You have a coaching update.'}, sound: 'default'}, recipient, href}
}
/** Inbox delivery is transactional. Optional pushes are one bounded, at-most-once attempt. */
export async function sendNativeCoachActivityPush(service: SupabaseClient, input: Input) {
  const config = nativePushConfiguration()
  if (!config) return {attempted: 0, failed: 0}
  try {
    if (!updateId(input.actor) || coachId(input.assignment) !== input.assignment || !['assignment','checkin','feedback'].includes(input.kind)) throw Error('Invalid activity')
    const claim = await service.rpc('claim_native_coach_activity_push', {p_actor: input.actor, p_assignment: input.assignment, p_kind: input.kind}).abortSignal(AbortSignal.timeout(4000)).retry(false)
    if (claim.error || !Array.isArray(claim.data) || claim.data.length > 1) throw Error('Activity claim unavailable')
    if (!claim.data.length) return {attempted: 0, failed: 0}
    const notice = claim.data[0]?.notification_id
    if (!updateId(notice)) throw Error('Invalid activity claim')
    const result = await service.rpc('native_coach_activity_push_devices', {p_notice: notice}).abortSignal(AbortSignal.timeout(4000)).retry(false)
    if (result.error || !Array.isArray(result.data) || result.data.length > 3) throw Error('Activity devices unavailable')
    const devices = result.data as Device[]
    if (devices.some(d => !d || !updateId(d.installation_id) || !updateId(d.profile_id) || !/^[a-f0-9]{64,256}$/.test(d.device_token) || !updateTimestamp(d.updated_at)) ||
      new Set(devices.map(d => d.installation_id)).size !== devices.length || new Set(devices.map(d => d.device_token)).size !== devices.length || new Set(devices.map(d => d.profile_id)).size > 1) throw Error('Invalid activity devices')
    const outcomes = await deliverAppleNotifications(devices.map(device => ({device, href: coachActivityPushHref(notice), collapseId: notice, expiresAt: 0})), config, nativeCoachActivityPayload)
    await Promise.all(outcomes.filter(o => o.expired).map(({device}) => service.rpc('expire_native_coach_activity_device', {p_notice: notice, p_installation: device.installation_id, p_version: device.updated_at}).abortSignal(AbortSignal.timeout(3000)).retry(false)))
    const failed = outcomes.filter(o => o.result.status !== 200).length
    if (failed) console.warn('native_coach_activity_delivery_incomplete')
    return {attempted: outcomes.length, failed}
  } catch { console.warn('native_coach_activity_push_unavailable'); return {attempted: 0, failed: 1} }
}
export function scheduleCoachActivityPush(input: Input) {
  after(async () => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key || !nativePushConfiguration()) return
    await sendNativeCoachActivityPush(accountClient(key), input)
  })
}
