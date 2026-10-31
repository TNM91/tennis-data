import {CapacitorHttp} from '@capacitor/core'
import {Share} from '@capacitor/share'
import {Clipboard} from '@capacitor/clipboard'
import type {SupabaseClient} from '@supabase/supabase-js'
import {scenarioOwner} from './captain-scenarios-data'
import {CoachWorkspaceError, type CoachSend} from './coach-workspace-data'
import {readCoachInvitations, coachInviteShareable, coachInviteMatches, type CoachInviteIntent, type CoachInvitations, type CoachInvitation} from '../../lib/native-coach-invite-contract'
const transport: CoachSend = (method, options) => method === 'GET' ? CapacitorHttp.get(options) : CapacitorHttp.post(options)
export async function coachInvitationsRequest(client: SupabaseClient, owner: string, current: () => boolean, student: string, intent: CoachInviteIntent | null, send: CoachSend = transport) {
 const session = await scenarioOwner(client, owner, current)
 const result = await send(intent ? 'POST' : 'GET', {url: 'https://www.tenaceiq.com/api/mobile/coach/invites' + (intent ? '' : '?' + new URLSearchParams({student})), headers: {Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json', 'Cache-Control': 'no-store'}, disableRedirects: true, webFetchExtra: {cache: 'no-store'}, responseType: 'json', connectTimeout: 12000, readTimeout: 30000, ...(intent ? {data: intent} : {})})
 await scenarioOwner(client, owner, current)
 if (result.status !== 200) throw new CoachWorkspaceError(result.status)
 const snapshot = readCoachInvitations(result.data, owner, student)
 if (intent && !coachInviteMatches(snapshot, intent)) throw new CoachWorkspaceError(503)
 return snapshot
}
export async function shareCoachInvitation(invite: CoachInvitation, read: () => Promise<CoachInvitations>, current: () => boolean, copy: boolean, share: typeof Share.share = options => Share.share(options), write: typeof Clipboard.write = options => Clipboard.write(options)) {
 const fresh = await read(), found = fresh.invites.find(i => i.id === invite.id)
 if (!current()) throw Error('Coach account changed')
 if (!found || fresh.student.linked || fresh.student.paused || !coachInviteShareable(found) || found.updatedAt !== invite.updatedAt || found.href !== invite.href || found.email !== invite.email || found.message !== invite.message) return {snapshot: fresh, done: false}
 if (copy) await write({string: found.href})
 else await share({title: 'Connect on TenAceIQ', text: 'Open this invitation and sign in with ' + found.email + ' to connect with your coach.', url: found.href, dialogTitle: 'Share Coach invitation'})
 return {snapshot: fresh, done: true}
}
