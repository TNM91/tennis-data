import {accountClient, accountResponse, readAccountJson, verifiedAccount} from '@/lib/mobile-account-auth'
import {getCoachApiAuth} from '@/lib/coach-api-auth'
import {coachId} from '@/lib/native-coach-contract'
import {readTiqCursor, readTiqHistory, readTiqWrite} from '@/lib/tiq-self-assessment'

export const runtime = 'nodejs'
export const maxDuration = 30
const json = (body: unknown, status = 200) => accountResponse(body, status, {'Referrer-Policy': 'no-referrer'})
const unavailable = () => json({ok: false, message: 'Your account rating couldn’t be confirmed. Try again.'}, 503)

export async function GET(request: Request) {
  let student: string | null = null, cursor = null
  try {
    const params = new URL(request.url).searchParams
    if ([...params.keys()].some(key => !['student', 'cursor'].includes(key)) || [...params.keys()].some(key => params.getAll(key).length !== 1)) throw Error()
    if (params.has('student')) student = coachId(params.get('student'))
    if (params.has('cursor')) {
      const value = params.get('cursor')!
      if (value.length > 400) throw Error()
      cursor = readTiqCursor(JSON.parse(value))
    }
  } catch {return json({ok: false}, 400)}
  let owner: string
  if (student) {
    const auth = await getCoachApiAuth(request)
    if (!auth.ok) return json({ok: false}, auth.response.status)
    owner = auth.userId
  } else {
    const auth = await verifiedAccount(request)
    if (!auth) return json({ok: false}, 401)
    owner = auth.user.id
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return unavailable()
  try {
    const {data, error} = await accountClient(key).rpc('native_tiq_assessment_history', {p_owner: owner, p_cursor: cursor, p_student: student})
    if (error) return unavailable()
    if (data?.ok !== true) return json({ok: false}, data?.status === 403 ? 403 : 503)
    return json({ok: true, ...readTiqHistory(data, owner, student), releaseScope: 'first-party'})
  } catch {return unavailable()}
}

export async function POST(request: Request) {
  if (new URL(request.url).search) return json({ok: false}, 400)
  const auth = await verifiedAccount(request)
  if (!auth) return json({ok: false}, 401)
  let write
  try {write = readTiqWrite(await readAccountJson(request, 4096))}
  catch {return json({ok: false, message: 'Review your assessment and try again.'}, 400)}
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return unavailable()
  try {
    const {data, error} = await accountClient(key).rpc('write_native_tiq_assessment', {p_owner: auth.user.id, p_write: write})
    if (error) return unavailable()
    if (data !== 200) return json({ok: false}, [400,403,404,409].includes(data) ? data : 503)
    return json({ok: true, owner: auth.user.id, id: write.id, releaseScope: 'first-party'})
  } catch {return unavailable()}
}
