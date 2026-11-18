import { getCoachApiAuth } from '@/lib/coach-api-auth'
import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { readCoachAssessmentDraft, readCoachAssessments } from '@/lib/native-coach-assessment-contract'
import { coachId } from '@/lib/native-coach-contract'

export const runtime = 'nodejs'
export const maxDuration = 30

const json = (body: unknown, status = 200) => accountResponse(body, status, { 'Referrer-Policy': 'no-referrer' })
const unavailable = () => json({ ok: false, message: 'Coach assessments are temporarily unavailable. Try again.' }, 503)

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  let student: string | null = null
  try {
    if ([...params.keys()].some(key => key !== 'student') || params.getAll('student').length > 1) throw Error('Invalid selection')
    if (params.has('student')) student = coachId(params.get('student'))
  } catch { return json({ ok: false }, 400) }

  let owner: string
  if (student) {
    const access = await getCoachApiAuth(request)
    if (!access.ok) return json({ ok: false }, access.response.status)
    owner = access.userId
  } else {
    const account = await verifiedAccount(request)
    if (!account) return json({ ok: false }, 401)
    owner = account.user.id
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return unavailable()
  try {
    const { data, error } = await accountClient(key).rpc('native_coach_assessments', { p_owner: owner, p_student: student })
    if (error) return unavailable()
    return json({ ok: true, owner, student, assessments: readCoachAssessments(data) })
  } catch { return unavailable() }
}

export async function POST(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return json({ ok: false }, auth.response.status)
  let draft
  try { draft = readCoachAssessmentDraft(await readAccountJson(request, 4096)) }
  catch { return json({ ok: false, message: 'Review the skills and coaching note before sharing.' }, 400) }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return unavailable()
  try {
    const { data, error } = await accountClient(key).rpc('share_native_coach_assessment', {
      p_owner: auth.userId, p_student: draft.student, p_link_updated_at: draft.linkUpdatedAt,
      p_id: draft.id, p_observation: draft.observation,
    })
    if (error) return unavailable()
    if (data !== true) return json({ ok: false, message: 'This student connection changed. Refresh the student record before sharing.' }, 409)
    return json({ ok: true, owner: auth.userId, student: draft.student, id: draft.id })
  } catch { return unavailable() }
}
