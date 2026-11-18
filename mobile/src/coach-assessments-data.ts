import { CapacitorHttp } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { coachRecord } from '../../lib/native-coach-contract'
import { readCoachAssessments, type CoachAssessmentDraft } from '../../lib/native-coach-assessment-contract'
import { scenarioOwner } from './captain-scenarios-data'
import type { CoachSend } from './coach-workspace-data'

const transport: CoachSend = (method, options) => method === 'GET' ? CapacitorHttp.get(options) : CapacitorHttp.post(options)

export class CoachAssessmentError extends Error {
  constructor(public status: number) {
    super(status === 409 ? 'This student connection changed. Close and refresh the student record before sharing.'
      : status === 403 ? 'Coach access is required to share an assessment.'
        : status === 401 ? 'Sign in again to open coach assessments.'
          : 'Coach assessments couldn’t be confirmed. Check your connection and try again.')
  }
}

async function request(client: SupabaseClient, owner: string, current: () => boolean,
  student: string | null, draft: CoachAssessmentDraft | null, send: CoachSend) {
  const session = await scenarioOwner(client, owner, current)
  const search = !draft && student ? '?' + new URLSearchParams({ student }) : ''
  const response = await send(draft ? 'POST' : 'GET', {
    url: 'https://www.tenaceiq.com/api/mobile/coach/assessments' + search,
    headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    webFetchExtra: { cache: 'no-store' }, disableRedirects: true, responseType: 'json', connectTimeout: 12000, readTimeout: 20000,
    ...(draft ? { data: draft } : {}),
  })
  await scenarioOwner(client, owner, current)
  if (response.status !== 200) throw new CoachAssessmentError(response.status)
  const data = coachRecord(response.data)
  if (data.ok !== true || data.owner !== owner || data.student !== student || (draft && data.id !== draft.id)) throw new CoachAssessmentError(503)
  return data
}

export async function loadCoachAssessments(client: SupabaseClient, owner: string, current: () => boolean, student: string | null, send = transport) {
  return readCoachAssessments((await request(client, owner, current, student, null, send)).assessments)
}

export async function shareCoachAssessment(client: SupabaseClient, owner: string, current: () => boolean, draft: CoachAssessmentDraft, send = transport) {
  await request(client, owner, current, draft.student, draft, send)
}
