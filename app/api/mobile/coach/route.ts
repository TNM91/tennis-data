import {getCoachApiAuth} from '@/lib/coach-api-auth'
import {coachId, coachRecord, readCoachCreate, readCoachReview,readCoachEdit} from '@/lib/native-coach-contract'
import {createNativeCoach, loadNativeCoach, NativeCoachFault, reviewNativeCoach,editNativeCoach} from '@/lib/native-coach'

export const runtime = 'nodejs'
export const maxDuration = 30
const json = (body: unknown, status: number) => Response.json(body, {status, headers: {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'}})
async function handle(request: Request, method: 'GET' | 'POST' | 'PATCH') {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) {
    auth.response.headers.set('Cache-Control', 'private, no-store')
    auth.response.headers.set('Referrer-Policy', 'no-referrer')
    return auth.response
  }
  let selected = '', body: unknown
  try {
    const params = new URL(request.url).searchParams
    if ([...params.keys()].some(k => k !== 'student' || params.getAll(k).length !== 1) || (method !== 'GET' && [...params].length)) throw Error('Invalid selection')
    if (params.has('student')) selected = coachId(params.get('student'))
    if (method !== 'GET') {
      const raw = await request.text()
      const bytes=new TextEncoder().encode(raw).byteLength
      if (bytes > (method==='PATCH'?48000:8000)) return json({ok: false, message: 'Use a shorter coach note.'}, 413)
      const parsed=coachRecord(JSON.parse(raw))
      if(method==='PATCH'&&!('kind' in parsed)&&bytes>8000)return json({ok:false,message:'Use a shorter coach note.'},413)
      body = method === 'POST' ? readCoachCreate(parsed) : 'kind' in parsed?readCoachEdit(parsed):readCoachReview(parsed)
    }
  } catch {return json({ok: false, message: 'Review the student and coach details, then try again.'}, 400)}
  try {
    const data = method === 'GET' ? await loadNativeCoach(auth.supabase, auth.userId, selected)
      : method === 'POST' ? await createNativeCoach(auth.supabase, auth.userId, readCoachCreate(body))
        : 'kind' in coachRecord(body)?await editNativeCoach(auth.supabase,auth.userId,readCoachEdit(body)):await reviewNativeCoach(auth.supabase, auth.userId, readCoachReview(body))
    return json({ok: true, ...data}, 200)
  } catch (error) {
    return error instanceof NativeCoachFault ? json({ok: false, message: error.message}, error.status)
      : json({ok: false, message: method === 'GET' ? 'Coach records are unavailable. Try again when connected.' : 'The save could not be confirmed. Check saved work before trying again.'}, 503)
  }
}
export const GET = (request: Request) => handle(request, 'GET')
export const POST = (request: Request) => handle(request, 'POST')
export const PATCH = (request: Request) => handle(request, 'PATCH')
