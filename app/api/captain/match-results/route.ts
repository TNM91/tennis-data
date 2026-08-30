import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import {
  buildCaptainScorecardImportRow,
  buildCaptainScorecardObservations,
  buildCaptainScorecardRecap,
  buildCaptainScorecardTeamRoomDraft,
  hasHigherPriorityCaptainScorecardConflict,
  isCaptainScorecardSavedRecap,
  validateCaptainScorecardInput,
  type CaptainScorecardInput,
  type CaptainScorecardSavedRecap,
} from '@/lib/captain-scorecard'
import { getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import { runScorecardImport } from '@/lib/ingestion/runImport'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'
import { sourcePriority } from '@/lib/tennisrecord/reconcile'
import { canManageTeamRoom, normalizeTeamRoomKey } from '@/lib/team-room'
import { announceTeamRoomScorecardResult } from '@/lib/team-room-result-announcement-server'

export const runtime = 'nodejs'
export const maxDuration = 60

type StoredObservation = {
  fingerprint: string
  source: string
  score_text: string | null
  canonical_match_id: string | null
  participants: unknown
}

type ExistingMatch = {
  id: string
  external_match_id: string | null
}

type ReceiptMatch = ExistingMatch & {
  home_team: string | null
}

type ReceiptObservation = {
  raw: unknown
}

type SavedMatchParticipant = {
  match_id: string
  player_id: string
  side: 'A' | 'B'
}

type RatingPlayer = {
  id: string
  name: string | null
  singles_dynamic_rating: number | null
  doubles_dynamic_rating: number | null
}

type DataAssistReferenceRow = {
  submitted_by_user_id: string | null
}

function matchRating(player: RatingPlayer | undefined, matchType: 'singles' | 'doubles') {
  const value = matchType === 'singles' ? player?.singles_dynamic_rating : player?.doubles_dynamic_rating
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null
}

function parseInput(value: unknown): CaptainScorecardInput | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (!Array.isArray(raw.lines)) return null
  const lines = raw.lines.flatMap((line) => {
    if (!line || typeof line !== 'object') return []
    const item = line as Record<string, unknown>
    const courtNumber = typeof item.courtNumber === 'number'
      ? item.courtNumber
      : Number.parseInt(String(item.courtNumber || ''), 10)
    const matchType = item.matchType === 'singles' || item.matchType === 'doubles' ? item.matchType : ''
    const outcome = item.outcome === 'team' || item.outcome === 'opponent' ? item.outcome : ''
    return [{
      courtNumber,
      matchType,
      teamPlayers: Array.isArray(item.teamPlayers) ? item.teamPlayers.filter((name): name is string => typeof name === 'string') : [],
      opponentPlayers: Array.isArray(item.opponentPlayers) ? item.opponentPlayers.filter((name): name is string => typeof name === 'string') : [],
      outcome,
      score: typeof item.score === 'string' ? item.score : '',
    }]
  })
  return {
    teamName: typeof raw.teamName === 'string' ? raw.teamName : '',
    opponentTeam: typeof raw.opponentTeam === 'string' ? raw.opponentTeam : '',
    matchDate: typeof raw.matchDate === 'string' ? raw.matchDate : '',
    matchTime: typeof raw.matchTime === 'string' ? raw.matchTime : null,
    facility: typeof raw.facility === 'string' ? raw.facility : null,
    leagueName: typeof raw.leagueName === 'string' ? raw.leagueName : null,
    flight: typeof raw.flight === 'string' ? raw.flight : null,
    dataAssistBatchId: typeof raw.dataAssistBatchId === 'string' ? raw.dataAssistBatchId : null,
    dataAssistDraftId: typeof raw.dataAssistDraftId === 'string' ? raw.dataAssistDraftId : null,
    lines: lines as CaptainScorecardInput['lines'],
  }
}

function extractParentExternalId(externalMatchId: string | null) {
  const value = externalMatchId?.trim() || ''
  return value.replace(/::line:\d+$/, '')
}

export async function GET(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const externalMatchId = url.searchParams.get('externalMatchId')?.trim() || ''
  const teamName = url.searchParams.get('team')?.trim() || ''
  if (!externalMatchId || !teamName) {
    return Response.json({ ok: false, message: 'Choose the saved team result to reopen its recap.' }, { status: 400 })
  }

  const service = getCaptainAvailabilityServiceClient()
  const { data: teamLinks, error: teamLinksError } = await service
    .from('team_profile_links')
    .select('team_role,team_roles')
    .eq('profile_user_id', auth.userId)
    .eq('normalized_team_name', normalizeTeamRoomKey(teamName))
    .eq('status', 'accepted')
    .limit(10)
  if (teamLinksError) return Response.json({ ok: false, message: 'Captain access could not be checked.' }, { status: 500 })
  const hasTeamAccess = (teamLinks || []).some((link) => {
    const roles = Array.isArray(link.team_roles) && link.team_roles.length
      ? link.team_roles.map(String)
      : [String(link.team_role || 'player')]
    return canManageTeamRoom(roles)
  })
  if (!auth.isAdmin && !hasTeamAccess) {
    return Response.json({ ok: false, message: 'Captain access is required for this team.' }, { status: 403 })
  }

  const { data: savedLineData, error: savedLineError } = await service
    .from('matches')
    .select('id,external_match_id,home_team')
    .like('external_match_id', `${externalMatchId}::line:%`)
  if (savedLineError) return Response.json({ ok: false, message: 'The saved result could not be reopened.' }, { status: 500 })
  const savedLines = (savedLineData || []) as ReceiptMatch[]
  if (!savedLines.length || (!auth.isAdmin && !savedLines.every((line) => normalizeTeamRoomKey(line.home_team || '') === normalizeTeamRoomKey(teamName)))) {
    return Response.json({ ok: false, message: 'That saved result is not available for this team.' }, { status: 404 })
  }

  const { data: observationData, error: observationError } = await service
    .from('tennisrecord_match_observations')
    .select('raw')
    .eq('source', 'captain_upload')
    .in('canonical_match_id', savedLines.map((line) => line.id))
    .order('last_seen_at', { ascending: false })
  if (observationError) return Response.json({ ok: false, message: 'The saved scorecard receipt could not be reopened.' }, { status: 500 })
  const recap = ((observationData || []) as ReceiptObservation[])
    .map((observation) => (
      observation.raw && typeof observation.raw === 'object'
        ? (observation.raw as { recap?: unknown }).recap
        : null
    ))
    .find(isCaptainScorecardSavedRecap)
  if (!recap) {
    return Response.json({ ok: false, message: 'This scorecard is saved, but its recap is still being prepared.' }, { status: 404 })
  }

  return Response.json({ ok: true, externalMatchId, recap })
}

export async function POST(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, message: 'The scorecard could not be read. Try again.' }, { status: 400 })
  }
  const input = parseInput(body)
  if (!input) return Response.json({ ok: false, message: 'Add the match and court details before saving.' }, { status: 400 })
  const validationError = validateCaptainScorecardInput(input)
  if (validationError) return Response.json({ ok: false, message: validationError }, { status: 400 })

  const service = getCaptainAvailabilityServiceClient()
  const { data: teamLinks, error: teamLinksError } = await service
    .from('team_profile_links')
    .select('team_role,team_roles')
    .eq('profile_user_id', auth.userId)
    .eq('normalized_team_name', normalizeTeamRoomKey(input.teamName))
    .eq('status', 'accepted')
    .limit(10)
  if (teamLinksError) return Response.json({ ok: false, message: 'Captain access could not be checked.' }, { status: 500 })
  const hasTeamAccess = (teamLinks || []).some((link) => {
    const roles = Array.isArray(link.team_roles) && link.team_roles.length
      ? link.team_roles.map(String)
      : [String(link.team_role || 'player')]
    return canManageTeamRoom(roles)
  })
  if (!auth.isAdmin && !hasTeamAccess) {
    return Response.json({ ok: false, message: 'Captain access is required for this team.' }, { status: 403 })
  }

  const dataAssistBatchId = input.dataAssistBatchId?.trim() || ''
  const dataAssistDraftId = input.dataAssistDraftId?.trim() || ''
  if (dataAssistBatchId && dataAssistDraftId) {
    const [batchReference, draftReference] = await Promise.all([
      service
        .from('data_assist_batches')
        .select('submitted_by_user_id')
        .eq('id', dataAssistBatchId)
        .maybeSingle(),
      service
        .from('data_assist_drafts')
        .select('submitted_by_user_id')
        .eq('id', dataAssistDraftId)
        .eq('batch_id', dataAssistBatchId)
        .maybeSingle(),
    ])
    if (batchReference.error || draftReference.error) {
      return Response.json({ ok: false, message: 'The scorecard photo reference could not be checked. Reopen the photo read and try again.' }, { status: 500 })
    }
    const batchOwner = (batchReference.data as DataAssistReferenceRow | null)?.submitted_by_user_id || ''
    const draftOwner = (draftReference.data as DataAssistReferenceRow | null)?.submitted_by_user_id || ''
    if (!batchOwner || !draftOwner || batchOwner !== auth.userId || draftOwner !== auth.userId) {
      return Response.json({ ok: false, message: 'That scorecard photo is not available for this account.' }, { status: 403 })
    }
  }

  const localObservations = buildCaptainScorecardObservations(input)
  const fingerprints = localObservations.map((item) => item.fingerprint)
  const { data: existingObservationRows, error: observationReadError } = await service
    .from('tennisrecord_match_observations')
    .select('fingerprint,source,score_text,canonical_match_id,participants')
    .in('fingerprint', fingerprints)
  if (observationReadError) return Response.json({ ok: false, message: 'Existing match evidence could not be checked.' }, { status: 500 })

  const existingObservations = (existingObservationRows || []) as StoredObservation[]
  const observationsByFingerprint = new Map<string, StoredObservation[]>()
  for (const row of existingObservations) {
    const rows = observationsByFingerprint.get(row.fingerprint) || []
    rows.push(row)
    observationsByFingerprint.set(row.fingerprint, rows)
  }
  const adminConflict = localObservations.find((observation) => (
    (observationsByFingerprint.get(observation.fingerprint) || [])
      .some((existing) => hasHigherPriorityCaptainScorecardConflict(existing, observation))
  ))
  if (adminConflict) {
    return Response.json({
      ok: false,
      needsReview: true,
      message: `Court ${localObservations.indexOf(adminConflict) + 1} conflicts with an admin-verified result. It was not changed.`,
    }, { status: 409 })
  }

  const existingCanonicalIds = [...new Set(existingObservations
    .map((row) => row.canonical_match_id)
    .filter((id): id is string => Boolean(id)))]
  const existingMatches = existingCanonicalIds.length
    ? await service.from('matches').select('id,external_match_id').in('id', existingCanonicalIds)
    : { data: [], error: null }
  if (existingMatches.error) return Response.json({ ok: false, message: 'Existing match context could not be checked.' }, { status: 500 })
  const existingParentIds = [...new Set((existingMatches.data as ExistingMatch[] || [])
    .map((match) => extractParentExternalId(match.external_match_id))
    .filter(Boolean))]
  // Reuse the existing canonical event whenever the captain is correcting a
  // previously imported court. That prevents a second production match from
  // being created just because the stronger local score arrived later.
  const externalMatchId = existingParentIds.length === 1 ? existingParentIds[0] : undefined
  const scorecard = buildCaptainScorecardImportRow(input, externalMatchId)
  const importResult = await runScorecardImport(service, scorecard, 'commit', {
    hasNormalizedPlayerNameColumn: true,
    matchPlayersDeleteBeforeInsert: true,
    scorecardLinesTable: null,
    scorecardReviewTable: null,
  })
  if (!importResult.ok || importResult.kind !== 'scorecard') {
    return Response.json({ ok: false, message: importResult.ok ? 'The scorecard could not be saved.' : importResult.error }, { status: 500 })
  }
  if (importResult.result.failedCount || importResult.result.successCount + importResult.result.updatedCount === 0) {
    return Response.json({ ok: false, message: importResult.result.errors[0]?.message || 'The scorecard could not be saved.' }, { status: 500 })
  }

  const lineExternalIds = input.lines.map((line) => `${scorecard.externalMatchId}::line:${line.courtNumber}`)
  const { data: savedLines, error: savedLinesError } = await service
    .from('matches')
    .select('id,external_match_id')
    .in('external_match_id', lineExternalIds)
  if (savedLinesError) return Response.json({ ok: false, message: 'The saved court results could not be confirmed.' }, { status: 500 })
  const lineIdByExternalId = new Map(((savedLines || []) as ExistingMatch[]).map((line) => [line.external_match_id || '', line.id]))
  const savedLineIds = [...lineIdByExternalId.values()]
  const matchTypeById = new Map(input.lines.flatMap((line) => {
    const lineId = lineIdByExternalId.get(`${scorecard.externalMatchId}::line:${line.courtNumber}`)
    return lineId ? [[lineId, line.matchType] as const] : []
  }))
  const { data: participantData } = savedLineIds.length
    ? await service.from('match_players').select('match_id,player_id,side').in('match_id', savedLineIds)
    : { data: [] }
  const savedParticipants = (participantData || []) as SavedMatchParticipant[]
  const participantIds = [...new Set(savedParticipants.map((participant) => participant.player_id).filter(Boolean))]
  const { data: beforeRatingData } = participantIds.length
    ? await service
      .from('players')
      .select('id,name,singles_dynamic_rating,doubles_dynamic_rating')
      .in('id', participantIds)
    : { data: [] }
  const beforeRatings = new Map(((beforeRatingData || []) as RatingPlayer[]).map((player) => [player.id, player]))
  const observedAt = new Date().toISOString()
  const observationPayload = localObservations.flatMap((observation, index) => {
    const lineId = lineIdByExternalId.get(`${scorecard.externalMatchId}::line:${input.lines[index].courtNumber}`)
    if (!lineId) return []
    const matchingExisting = observationsByFingerprint.get(observation.fingerprint) || []
    const existingParticipants = matchingExisting.find((item) => item.participants)?.participants
    return [{
      fingerprint: observation.fingerprint,
      source: 'captain_upload',
      source_priority: sourcePriority('captain_upload'),
      source_record_id: lineId,
      source_url: null,
      canonical_match_id: lineId,
      score_text: observation.scoreText,
      winner_side: observation.winnerSide,
      // Match the source representation already captured when possible. This
      // distinguishes a real correction from a harmless difference in how
      // participant evidence was encoded by the source.
      participants: existingParticipants || observation.participants,
      raw: { source: 'captain_scorecard', submitted_by: auth.userId, input },
      confidence: 1,
      verified_at: observedAt,
      captured_at: observedAt,
      last_seen_at: observedAt,
    }]
  })
  const { data: savedObservations, error: observationWriteError } = observationPayload.length
    ? await service
      .from('tennisrecord_match_observations')
      .upsert(observationPayload, { onConflict: 'fingerprint,source,source_record_id' })
      .select('id,fingerprint,score_text,participants')
    : { data: [], error: null }
  if (observationWriteError) return Response.json({ ok: false, message: 'The result evidence could not be saved.' }, { status: 500 })

  const savedObservationByFingerprint = new Map((savedObservations || []).map((item) => [item.fingerprint as string, item]))
  const canonicalRows = localObservations.flatMap((observation, index) => {
    const savedObservation = savedObservationByFingerprint.get(observation.fingerprint)
    const lineId = lineIdByExternalId.get(`${scorecard.externalMatchId}::line:${input.lines[index].courtNumber}`)
    if (!savedObservation || !lineId) return []
    const conflicts = (observationsByFingerprint.get(observation.fingerprint) || [])
      .filter((existing) => sourcePriority(existing.source) < sourcePriority('captain_upload'))
      .filter((existing) => existing.score_text !== observation.scoreText)
    return [{
      fingerprint: observation.fingerprint,
      winning_observation_id: savedObservation.id,
      canonical_match_id: lineId,
      winning_source: 'captain_upload',
      has_conflict: conflicts.length > 0,
      conflict_count: conflicts.length,
      reconciled_at: observedAt,
      promoted_at: observedAt,
      rating_processed_at: observedAt,
    }]
  })
  if (canonicalRows.length) {
    const { error: canonicalError } = await service
      .from('tennisrecord_canonical_matches')
      .upsert(canonicalRows, { onConflict: 'fingerprint' })
    if (canonicalError) return Response.json({ ok: false, message: 'The result reconciliation could not be saved.' }, { status: 500 })
  }

  await recalculateDynamicRatings(undefined, service)
  const { data: afterRatingData } = participantIds.length
    ? await service
      .from('players')
      .select('id,name,singles_dynamic_rating,doubles_dynamic_rating')
      .in('id', participantIds)
    : { data: [] }
  const afterRatings = new Map(((afterRatingData || []) as RatingPlayer[]).map((player) => [player.id, player]))
  const ratingChanges = [...new Map(savedParticipants.map((participant) => [participant.player_id, participant])).values()]
    .map((participant) => {
      const matchType = matchTypeById.get(participant.match_id) || 'doubles'
      const before = matchRating(beforeRatings.get(participant.player_id), matchType)
      const after = matchRating(afterRatings.get(participant.player_id), matchType)
      return {
        playerId: participant.player_id,
        playerName: afterRatings.get(participant.player_id)?.name || beforeRatings.get(participant.player_id)?.name || 'Player',
        side: participant.side === 'A' ? 'team' as const : 'opponent' as const,
        matchType,
        before,
        after,
        delta: before !== null && after !== null ? Math.round((after - before) * 1000) / 1000 : null,
      }
    })
  const sourceConflictCount = canonicalRows.reduce((total, row) => total + row.conflict_count, 0)
  const recap: CaptainScorecardSavedRecap = {
    ...buildCaptainScorecardRecap(input),
    ratingChanges,
    sourceConflictCount,
  }
  const { error: receiptError } = savedLineIds.length
    ? await service
      .from('tennisrecord_match_observations')
      .update({ raw: { source: 'captain_scorecard', submitted_by: auth.userId, input, recap } })
      .eq('source', 'captain_upload')
      .in('canonical_match_id', savedLineIds)
    : { error: null }
  if (receiptError) console.error('Could not persist captain scorecard recap', receiptError)

  if (dataAssistBatchId && dataAssistDraftId) {
    const reviewedAt = new Date().toISOString()
    const reviewNote = 'Verified through the captain scorecard.'
    const [batchPhotoUpdate, draftPhotoUpdate] = await Promise.all([
      service
        .from('data_assist_batches')
        .update({
          status: 'verified',
          review_note: reviewNote,
          reviewed_by_user_id: auth.userId,
          reviewed_at: reviewedAt,
        })
        .eq('id', dataAssistBatchId),
      service
        .from('data_assist_drafts')
        .update({
          status: 'verified',
          review_note: reviewNote,
          reviewed_by_user_id: auth.userId,
          reviewed_at: reviewedAt,
        })
        .eq('id', dataAssistDraftId)
        .eq('batch_id', dataAssistBatchId),
    ])
    if (batchPhotoUpdate.error || draftPhotoUpdate.error) {
      console.error('Could not mark the scorecard photo as captain verified', batchPhotoUpdate.error || draftPhotoUpdate.error)
    }
  }

  // Captain scorecards are already verified local records. Send the final
  // result to the matching Team Chat in the same save, while the announcement
  // helper keeps repeat saves and later corrections idempotent.
  let teamAnnouncementUpdated = false
  try {
    const announcement = await announceTeamRoomScorecardResult({
      service,
      userId: auth.userId,
      draft: buildCaptainScorecardTeamRoomDraft(input, scorecard.externalMatchId),
    })
    teamAnnouncementUpdated = announcement.inserted > 0 || announcement.updated > 0
  } catch (announcementError) {
    // Team Chat availability never blocks the verified match and rating save.
    console.error('Could not announce captain scorecard result in Team Chat', announcementError)
  }
  return Response.json({
    ok: true,
    externalMatchId: scorecard.externalMatchId,
    linesRecorded: observationPayload.length,
    recap,
    teamAnnouncementUpdated,
    message: teamAnnouncementUpdated
      ? `Saved ${observationPayload.length} court result${observationPayload.length === 1 ? '' : 's'}, refreshed TiQ ratings, and updated Team Chat.`
      : `Saved ${observationPayload.length} court result${observationPayload.length === 1 ? '' : 's'} and refreshed TiQ ratings.`,
  })
}
