import {
  cleanAvailabilityText,
  getCaptainAvailabilityServiceClient,
} from '@/lib/captain-availability-request-server'
import {
  captainLineupReviewReturnPath,
  countCaptainLineupReviewChanges,
  resolveCaptainLineupReviewToken,
  sanitizeCaptainLineupReviewRoster,
  sanitizeCaptainLineupReviewSlots,
  validateCaptainLineupReviewProposal,
} from '@/lib/captain-lineup-review'

export const runtime = 'nodejs'

const reviewSelect = 'review_token,scenario_id,team_name,league_name,flight,match_date,opponent_team,match_time,facility,slots_json,roster_json,proposed_slots_json,reviewer_name,reviewer_note,status,expires_at,submitted_at'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params
  const token = resolveCaptainLineupReviewToken(rawToken)
  if (!token) return inactiveResponse()

  const service = getCaptainAvailabilityServiceClient()
  const { data, error } = await service
    .from('captain_lineup_reviews')
    .select(reviewSelect)
    .eq('review_token', token)
    .maybeSingle()
  if (error) return Response.json({ ok: false, message: 'This lineup review could not be opened.' }, { status: 500 })
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return inactiveResponse()

  return Response.json({
    ok: true,
    review: {
      token: data.review_token,
      status: data.status,
      teamName: data.team_name,
      leagueName: data.league_name,
      flight: data.flight,
      matchDate: data.match_date || '',
      opponentTeam: data.opponent_team,
      matchTime: data.match_time,
      facility: data.facility,
      scenarioId: data.scenario_id || '',
      slots: sanitizeCaptainLineupReviewSlots(data.slots_json),
      proposedSlots: data.proposed_slots_json ? sanitizeCaptainLineupReviewSlots(data.proposed_slots_json) : null,
      roster: sanitizeCaptainLineupReviewRoster(data.roster_json),
      reviewerName: data.reviewer_name,
      reviewerNote: data.reviewer_note,
      expiresAt: data.expires_at,
      submittedAt: data.submitted_at || '',
    },
  }, { headers: privateLinkHeaders })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params
  const token = resolveCaptainLineupReviewToken(rawToken)
  if (!token) return inactiveResponse()

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const service = getCaptainAvailabilityServiceClient()
  const { data, error } = await service
    .from('captain_lineup_reviews')
    .select(reviewSelect)
    .eq('review_token', token)
    .maybeSingle()
  if (error) return Response.json({ ok: false, message: 'This lineup review could not be updated.' }, { status: 500 })
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return inactiveResponse()
  if (data.status === 'accepted') {
    return Response.json({ ok: false, message: 'The captain already applied this suggestion.' }, { status: 409 })
  }

  const slots = sanitizeCaptainLineupReviewSlots(data.slots_json)
  const roster = sanitizeCaptainLineupReviewRoster(data.roster_json)
  const proposedSlots = validateCaptainLineupReviewProposal(slots, roster, body?.proposedSlots)
  if (!proposedSlots) {
    return Response.json({ ok: false, message: 'Choose each player from the shared roster and use a player only once.' }, { status: 400 })
  }

  const reviewerName = cleanAvailabilityText(body?.reviewerName, 100)
  const reviewerNote = cleanAvailabilityText(body?.reviewerNote, 500)
  const submittedAt = new Date().toISOString()
  const { error: updateError } = await service
    .from('captain_lineup_reviews')
    .update({
      proposed_slots_json: proposedSlots,
      reviewer_name: reviewerName,
      reviewer_note: reviewerNote,
      status: 'submitted',
      submitted_at: submittedAt,
      updated_at: submittedAt,
    })
    .eq('review_token', token)
  if (updateError) {
    return Response.json({ ok: false, message: 'The suggestion could not be saved. Please try again.' }, { status: 500 })
  }

  const origin = new URL(request.url).origin
  return Response.json({
    ok: true,
    changedCourts: countCaptainLineupReviewChanges(slots, proposedSlots),
    captainUrl: `${origin}${captainLineupReviewReturnPath(token)}`,
  }, { headers: privateLinkHeaders })
}

function inactiveResponse() {
  return Response.json(
    { ok: false, message: 'This private lineup review is no longer active. Ask the captain for a fresh link.' },
    { status: 404, headers: privateLinkHeaders },
  )
}

const privateLinkHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}
