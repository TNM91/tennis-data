import {getCoachApiAuth} from '@/lib/coach-api-auth'
import {coachId} from '@/lib/native-coach-contract'
import {readCoachInviteIntent} from '@/lib/native-coach-invite-contract'
import {loadCoachInvitations, saveCoachInvitation} from '@/lib/native-coach-invites'
import {NativeCoachFault} from '@/lib/native-coach'

export const runtime = 'nodejs'
export const maxDuration = 30
const json = (body: unknown, status: number) => Response.json(body, {status, headers: {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'}})
async function handle(request: Request, mutation: boolean) {
 const auth = await getCoachApiAuth(request)
 if (!auth.ok) {auth.response.headers.set('Cache-Control', 'private, no-store'); auth.response.headers.set('Referrer-Policy', 'no-referrer'); return auth.response}
 let selected = '', intent
 try {
  const params = new URL(request.url).searchParams
  if (mutation) {
   if ([...params].length) throw Error('Unexpected query')
   const raw = await request.text()
   if (new TextEncoder().encode(raw).byteLength > 4000) return json({ok: false}, 413)
   intent = readCoachInviteIntent(JSON.parse(raw))
  } else {
   if ([...params.keys()].some(k => k !== 'student') || params.getAll('student').length !== 1) throw Error('Missing student')
   selected = coachId(params.get('student'))
  }
 } catch {return json({ok: false, message: 'Check the student and invitation details.'}, 400)}
 try {return json({ok: true, ...(intent ? await saveCoachInvitation(auth.supabase, auth.userId, intent) : await loadCoachInvitations(auth.supabase, auth.userId, selected))}, 200)}
 catch (error) {return error instanceof NativeCoachFault ? json({ok: false, message: error.message}, error.status) : json({ok: false, message: 'Invitations could not be confirmed. Refresh before trying again.'}, 503)}
}
export const GET = (request: Request) => handle(request, false)
export const POST = (request: Request) => handle(request, true)
