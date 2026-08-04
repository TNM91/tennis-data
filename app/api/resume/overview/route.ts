import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { sanitizeCaptainResumeState } from '@/lib/captain-memory'
import { sanitizeCoachResumeState } from '@/lib/coach-memory'
import { sanitizeCompeteResumeState } from '@/lib/compete-memory'
import { sanitizeExploreResumeState } from '@/lib/explore-memory'
import { sanitizeLeagueCoordinatorResumeState } from '@/lib/league-coordinator-memory'
import { buildPlatformResumeCandidates, type PlatformResumeStates } from '@/lib/platform-resume'
import { sanitizePlayerImproveResumeState } from '@/lib/player-improve-memory'
import {
  applyAutomaticCaptainNextMatch,
  captainResumeHasCurrentMatch,
  loadCaptainResumeNextMatch,
} from '@/lib/platform-resume-next-match'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type ResumeRow = { resume_state?: unknown; updated_at?: string | null }

const sources = [
  ['captain', 'captain_workspace_preferences'],
  ['coach', 'coach_workspace_preferences'],
  ['improve', 'player_improve_workspace_preferences'],
  ['compete', 'compete_workspace_preferences'],
  ['explore', 'explore_workspace_preferences'],
  ['league', 'league_coordinator_workspace_preferences'],
] as const

export async function GET(request: Request) {
  const auth = await getResumeOverviewAuth(request)
  if (!auth.ok) return auth.response

  const results = await Promise.all(
    sources.map(async ([id, table]) => {
      const { data, error } = await auth.service
        .from(table)
        .select('resume_state,updated_at')
        .eq('user_id', auth.userId)
        .maybeSingle()

      return { id, row: data as ResumeRow | null, failed: Boolean(error) }
    }),
  )

  const states: PlatformResumeStates = {}
  let cloudAvailable = true

  for (const result of results) {
    if (result.failed) {
      cloudAvailable = false
      continue
    }

    const resumeState = result.row?.resume_state
    if (result.id === 'captain') states.captain = withUpdatedAt(sanitizeCaptainResumeState(resumeState), result.row)
    if (result.id === 'coach') states.coach = withUpdatedAt(sanitizeCoachResumeState(resumeState), result.row)
    if (result.id === 'improve') states.improve = withUpdatedAt(sanitizePlayerImproveResumeState(resumeState), result.row)
    if (result.id === 'compete') states.compete = withUpdatedAt(sanitizeCompeteResumeState(resumeState), result.row)
    if (result.id === 'explore') states.explore = withUpdatedAt(sanitizeExploreResumeState(resumeState), result.row)
    if (result.id === 'league') states.league = withUpdatedAt(sanitizeLeagueCoordinatorResumeState(resumeState), result.row)
  }

  const today = new Date().toISOString().slice(0, 10)
  if (!captainResumeHasCurrentMatch(states.captain, today)) {
    const nextMatch = await loadCaptainResumeNextMatch(auth.service, auth.userId, today)
    states.captain = applyAutomaticCaptainNextMatch(states.captain, nextMatch, today)
  }

  return Response.json({
    ok: true,
    candidates: buildPlatformResumeCandidates(states).slice(0, 6),
    cloudAvailable,
  })
}

function withUpdatedAt<T extends { lastVisitedAt?: string }>(resume: T, row: ResumeRow | null) {
  if (row?.updated_at && !resume.lastVisitedAt) resume.lastVisitedAt = row.updated_at
  return Object.keys(resume).length ? resume : null
}

async function getResumeOverviewAuth(request: Request): Promise<
  | { ok: true; userId: string; service: SupabaseClient }
  | { ok: false; response: Response }
> {
  const token = getBearerToken(request)
  if (!token) {
    return { ok: false, response: Response.json({ ok: false, message: 'Sign in to continue your work.' }, { status: 401 }) }
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false, response: Response.json({ ok: false, message: 'Sign in to continue your work.' }, { status: 401 }) }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return { ok: false, response: Response.json({ ok: false, message: 'Saved work is not configured.' }, { status: 503 }) }
  }

  return {
    ok: true,
    userId: data.user.id,
    service: createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  }
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}
