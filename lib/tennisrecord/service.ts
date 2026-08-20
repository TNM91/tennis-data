import type { SupabaseClient } from '@supabase/supabase-js'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'
import { fetchTennisRecordPage } from './collector'
import { parseTennisRecordMatchPage, normalizedTennisRecordPlayerName } from './parser'
import { canonicalTennisRecordFingerprint, sourcePriority } from './reconcile'
import type { TennisRecordRunSummary } from './types'

type Settings = { enabled: boolean; min_request_interval_ms: number; max_requests_per_run: number; weekly_lookback_days: number }
type QueueRow = { id: string; source_url: string; page_kind: string }

export async function getTennisRecordOperationalStatus(service: SupabaseClient) {
  const [settings, lastRun, pending, conflicts] = await Promise.all([
    service.from('tennisrecord_collector_settings').select('*').eq('id', true).maybeSingle(),
    service.from('tennisrecord_sync_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    service.from('tennisrecord_canonical_matches').select('fingerprint', { count: 'exact', head: true }).eq('has_conflict', true),
  ])
  if (settings.error || lastRun.error || pending.error || conflicts.error) throw new Error('TennisRecord operations status is unavailable.')
  return { settings: settings.data, lastRun: lastRun.data, pendingPages: pending.count || 0, conflicts: conflicts.count || 0 }
}

export async function enqueueTennisRecordUrls(service: SupabaseClient, urls: string[]) {
  const cleaned = [...new Set(urls.map((url) => url.trim()).filter(Boolean))]
  if (!cleaned.length) return 0
  const { error } = await service.from('tennisrecord_crawl_queue').upsert(cleaned.map((source_url) => ({ source_url, page_kind: source_url.includes('matchresults') ? 'match' : 'unknown', status: 'pending', last_seen_at: new Date().toISOString() })), { onConflict: 'source_url' })
  if (error) throw new Error(error.message)
  return cleaned.length
}

export async function runTennisRecordSync(service: SupabaseClient, input: { triggerKind: 'manual' | 'weekly'; requestedByUserId?: string; limit?: number }): Promise<TennisRecordRunSummary> {
  const { data: rawSettings, error: settingsError } = await service.from('tennisrecord_collector_settings').select('*').eq('id', true).single()
  if (settingsError) throw new Error(settingsError.message)
  const settings = rawSettings as Settings
  if (!settings.enabled || process.env.TENNISRECORD_COLLECTOR_ENABLED !== 'true') return emptySummary('disabled')
  const { data: run, error: runError } = await service.from('tennisrecord_sync_runs').insert({ trigger_kind: input.triggerKind, requested_by_user_id: input.requestedByUserId || null }).select('id').single()
  if (runError || !run?.id) throw new Error(runError?.message || 'Could not create TennisRecord sync run.')
  const runId = run.id as string
  const summary = emptySummary('completed')
  try {
    const { data: jobs, error: jobsError } = await service.from('tennisrecord_crawl_queue').select('id,source_url,page_kind').eq('status', 'pending').order('first_seen_at').limit(Math.min(input.limit || settings.max_requests_per_run, settings.max_requests_per_run))
    if (jobsError) throw new Error(jobsError.message)
    for (const job of (jobs || []) as QueueRow[]) {
      summary.pagesAttempted += 1
      await service.from('tennisrecord_crawl_queue').update({ status: 'running', attempted_at: new Date().toISOString(), last_run_id: runId }).eq('id', job.id).eq('status', 'pending')
      try {
        const page = await fetchTennisRecordPage(job.source_url, settings.min_request_interval_ms)
        const pageUpsert = await service.from('tennisrecord_source_pages').upsert({ source_url: page.url, content_hash: page.contentHash, http_status: page.status, captured_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), blocked: Boolean(page.blockReason), block_reason: page.blockReason, raw_html: page.html || null, sync_run_id: runId }, { onConflict: 'source_url,content_hash' }).select('id').single()
        if (pageUpsert.error) throw new Error(pageUpsert.error.message)
        if (page.blockReason) {
          summary.blockedRequests += 1; summary.status = 'blocked'
          await service.from('tennisrecord_crawl_queue').update({ status: 'blocked', failure_reason: page.blockReason, completed_at: new Date().toISOString() }).eq('id', job.id)
          continue
        }
        const parsed = parseTennisRecordMatchPage(page.html, page.url)
        await stageParsedPage(service, parsed, pageUpsert.data?.id as string | undefined)
        summary.pagesProcessed += 1; summary.playersDiscovered += parsed.players.length; summary.teamsDiscovered += parsed.teams.length; summary.matchesStaged += parsed.matches.length
        await service.from('tennisrecord_crawl_queue').update({ status: 'done', failure_reason: '', completed_at: new Date().toISOString() }).eq('id', job.id)
      } catch (error) {
        summary.parserFailures += 1
        await service.from('tennisrecord_crawl_queue').update({ status: 'error', failure_reason: error instanceof Error ? error.message : 'Unknown collector failure' }).eq('id', job.id)
      }
    }
    const reconciled = await reconcileTennisRecordMatches(service)
    summary.canonicalMatchesCreated = reconciled.created; summary.duplicatesDetected = reconciled.duplicates; summary.conflictsFound = reconciled.conflicts
    await service.from('tennisrecord_sync_runs').update({ status: summary.status, completed_at: new Date().toISOString(), pages_attempted: summary.pagesAttempted, pages_processed: summary.pagesProcessed, players_discovered: summary.playersDiscovered, teams_discovered: summary.teamsDiscovered, matches_staged: summary.matchesStaged, canonical_matches_created: summary.canonicalMatchesCreated, duplicates_detected: summary.duplicatesDetected, conflicts_found: summary.conflictsFound, blocked_requests: summary.blockedRequests, parser_failures: summary.parserFailures }).eq('id', runId)
    return summary
  } catch (error) {
    await service.from('tennisrecord_sync_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: error instanceof Error ? error.message : 'Unknown sync failure' }).eq('id', runId)
    throw error
  }
}

async function stageParsedPage(service: SupabaseClient, parsed: ReturnType<typeof parseTennisRecordMatchPage>, pageId?: string) {
  if (parsed.players.length) {
    const { data: staged, error } = await service.from('tennisrecord_staged_players').upsert(parsed.players.map((player) => ({ source_player_key: player.sourcePlayerKey, name: player.name, normalized_name: normalizedTennisRecordPlayerName(player), city: player.city || null, state: player.state || null, ntrp_label: player.ntrpLabel || null, published_rating: player.publishedRating || null, source_url: player.sourceUrl, raw: player, last_seen_at: new Date().toISOString() })), { onConflict: 'source_player_key' }).select('id')
    if (error) throw new Error(error.message)
    if (staged?.length) await service.from('tennisrecord_player_identities').upsert(staged.map((player) => ({ staged_player_id: player.id })), { onConflict: 'staged_player_id', ignoreDuplicates: true })
  }
  if (parsed.leagues.length) {
    const { error } = await service.from('tennisrecord_staged_leagues').upsert(parsed.leagues.map((league) => ({ source_league_key: league.sourceLeagueKey, name: league.name, flight: league.flight || null, season_year: league.seasonYear, source_url: league.sourceUrl, raw: league, last_seen_at: new Date().toISOString() })), { onConflict: 'source_league_key' })
    if (error) throw new Error(error.message)
  }
  if (parsed.teams.length) {
    const { error } = await service.from('tennisrecord_staged_teams').upsert(parsed.teams.map((team) => ({ source_team_key: team.sourceTeamKey, name: team.name, league_name: team.leagueName || null, flight: team.flight || null, season_year: team.seasonYear, source_url: team.sourceUrl, raw: team, last_seen_at: new Date().toISOString() })), { onConflict: 'source_team_key' })
    if (error) throw new Error(error.message)
  }
  if (parsed.matches.length) {
    const now = new Date().toISOString()
    const rows = parsed.matches.map((match) => ({ source_match_key: match.sourceMatchKey, source_url: match.sourceUrl, page_id: pageId || null, played_on: match.playedOn || null, league_name: match.leagueName || null, flight: match.flight || null, home_team: match.homeTeam || null, away_team: match.awayTeam || null, discipline: match.discipline, court_number: match.courtNumber, score_text: match.scoreText || null, winner_side: match.winnerSide, participants: match.participants, fingerprint: canonicalTennisRecordFingerprint(match), raw: match, last_seen_at: now }))
    const { data: saved, error } = await service.from('tennisrecord_staged_matches').upsert(rows, { onConflict: 'source_match_key' }).select('id,fingerprint,source_match_key,source_url,score_text,winner_side,participants')
    if (error) throw new Error(error.message)
    if (saved?.length) {
      const observationRows = saved.map((match) => ({ fingerprint: match.fingerprint, source: 'tennisrecord', source_priority: sourcePriority('tennisrecord'), source_record_id: match.source_match_key, source_url: match.source_url, staged_match_id: match.id, score_text: match.score_text, winner_side: match.winner_side, participants: match.participants, raw: { stagedMatchId: match.id }, confidence: 0.55, captured_at: now, last_seen_at: now }))
      const observation = await service.from('tennisrecord_match_observations').upsert(observationRows, { onConflict: 'fingerprint,source,source_record_id' })
      if (observation.error) throw new Error(observation.error.message)
    }
  }
  if (parsed.discoveredUrls.length) await enqueueTennisRecordUrls(service, parsed.discoveredUrls)
}

async function reconcileTennisRecordMatches(service: SupabaseClient) {
  const { data: staged, error } = await service.from('tennisrecord_staged_matches').select('id,source_match_key,source_url,fingerprint,played_on,league_name,flight,home_team,away_team,discipline,court_number,score_text,winner_side,participants').order('last_seen_at', { ascending: false }).limit(500)
  if (error) throw new Error(error.message)
  let created = 0; let duplicates = 0; let conflicts = 0
  let ratingChanged = false
  for (const item of staged || []) {
    const identities = await resolveMatchedParticipants(service, item.participants)
    if (identities) {
      const existing = await findExistingProductionMatch(service, item, identities)
      if (existing) {
        const localSource = classifyLocalSource(existing.source)
        const { error: localObservationError } = await service.from('tennisrecord_match_observations').upsert({
          fingerprint: item.fingerprint,
          source: localSource,
          source_priority: sourcePriority(localSource),
          source_record_id: existing.id,
          canonical_match_id: existing.id,
          score_text: existing.score || '',
          winner_side: existing.winner_side,
          participants: item.participants,
          raw: { canonicalMatchId: existing.id, source: existing.source },
          confidence: 1,
          verified_at: localSource === 'tenaceiq' ? null : new Date().toISOString(),
          captured_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        }, { onConflict: 'fingerprint,source,source_record_id' })
        if (localObservationError) throw new Error(localObservationError.message)
      }
    }
    const { data: observations, error: observationsError } = await service.from('tennisrecord_match_observations').select('id,source,source_priority,canonical_match_id,score_text,participants,last_seen_at').eq('fingerprint', item.fingerprint).order('source_priority', { ascending: false }).order('last_seen_at', { ascending: false })
    if (observationsError || !observations?.length) continue
    const winner = observations[0]
    const conflicting = observations.slice(1).filter((value) => value.score_text !== winner.score_text || JSON.stringify(value.participants) !== JSON.stringify(winner.participants))
    const canonicalMatchId = winner.canonical_match_id || null
    const existing = await service.from('tennisrecord_canonical_matches').select('fingerprint,canonical_match_id').eq('fingerprint', item.fingerprint).maybeSingle()
    const result = await service.from('tennisrecord_canonical_matches').upsert({ fingerprint: item.fingerprint, winning_observation_id: winner.id, canonical_match_id: canonicalMatchId, winning_source: winner.source, has_conflict: conflicting.length > 0, conflict_count: conflicting.length, reconciled_at: new Date().toISOString() }, { onConflict: 'fingerprint' })
    if (result.error) throw new Error(result.error.message)
    if (existing.data) duplicates += 1; else created += 1
    conflicts += conflicting.length
    if (!canonicalMatchId && winner.source === 'tennisrecord' && identities && item.winner_side) {
      const promoted = await promoteTennisRecordMatch(service, item, identities)
      if (promoted) {
        ratingChanged = true
        await service.from('tennisrecord_canonical_matches').update({ canonical_match_id: promoted, promoted_at: new Date().toISOString(), rating_processed_at: new Date().toISOString() }).eq('fingerprint', item.fingerprint)
      }
    }
  }
  if (ratingChanged) await recalculateDynamicRatings(undefined, service)
  return { created, duplicates, conflicts }
}

type ProductionMatch = { id: string; source: string | null; score: string | null; winner_side: 'A' | 'B' | null }
type CanonicalParticipant = { playerId: string; side: 'A' | 'B'; seat: number }

async function resolveMatchedParticipants(service: SupabaseClient, rawParticipants: unknown): Promise<CanonicalParticipant[] | null> {
  const participants = Array.isArray(rawParticipants) ? rawParticipants as Array<{ sourcePlayerKey?: unknown; side?: unknown; seat?: unknown }> : []
  if (!participants.length) return null
  const sourceKeys = participants.map((participant) => typeof participant.sourcePlayerKey === 'string' ? participant.sourcePlayerKey : '').filter(Boolean)
  if (sourceKeys.length !== participants.length) return null
  const staged = await service.from('tennisrecord_staged_players').select('id,source_player_key').in('source_player_key', sourceKeys)
  if (staged.error || (staged.data || []).length !== sourceKeys.length) return null
  const stagedByKey = new Map((staged.data || []).map((player) => [player.source_player_key as string, player.id as string]))
  const identity = await service.from('tennisrecord_player_identities').select('staged_player_id,canonical_player_id,status').in('staged_player_id', [...stagedByKey.values()])
  if (identity.error) return null
  const identityByStagedId = new Map((identity.data || []).map((row) => [row.staged_player_id as string, row]))
  const resolved: CanonicalParticipant[] = []
  for (const participant of participants) {
    const stagedId = stagedByKey.get(participant.sourcePlayerKey as string)
    const mapping = stagedId ? identityByStagedId.get(stagedId) as { canonical_player_id?: string | null; status?: string } | undefined : undefined
    const side = participant.side === 'A' || participant.side === 'B' ? participant.side : null
    const seat = typeof participant.seat === 'number' && participant.seat > 0 ? participant.seat : 0
    if (!mapping?.canonical_player_id || mapping.status !== 'matched' || !side || !seat) return null
    resolved.push({ playerId: mapping.canonical_player_id, side, seat })
  }
  return resolved
}

async function findExistingProductionMatch(service: SupabaseClient, staged: Record<string, unknown>, participants: CanonicalParticipant[]): Promise<ProductionMatch | null> {
  const candidates = await service.from('matches').select('id,source,score,winner_side').eq('match_date', staged.played_on).eq('match_type', staged.discipline).eq('status', 'completed').limit(200)
  if (candidates.error || !candidates.data?.length) return null
  const candidateIds = candidates.data.map((candidate) => candidate.id as string)
  const links = await service.from('match_players').select('match_id,player_id,side,seat').in('match_id', candidateIds)
  if (links.error) return null
  const expected = new Set(participants.map((participant) => `${participant.playerId}:${participant.side}:${participant.seat}`))
  for (const candidate of candidates.data) {
    const actual = new Set((links.data || []).filter((link) => link.match_id === candidate.id).map((link) => `${link.player_id}:${link.side}:${link.seat}`))
    if (actual.size === expected.size && [...expected].every((value) => actual.has(value))) return candidate as ProductionMatch
  }
  return null
}

function classifyLocalSource(source: string | null): 'admin_verified' | 'captain_upload' | 'player_upload' | 'tenaceiq' {
  const value = (source || '').toLowerCase()
  if (value.includes('admin')) return 'admin_verified'
  if (value.includes('captain') || value.includes('data_assist')) return 'captain_upload'
  if (value.includes('player_upload')) return 'player_upload'
  return 'tenaceiq'
}

async function promoteTennisRecordMatch(service: SupabaseClient, staged: Record<string, unknown>, participants: CanonicalParticipant[]) {
  const fingerprint = staged.fingerprint as string
  const externalMatchId = `tennisrecord:${fingerprint}`
  const parent = await service.from('matches').upsert({ external_match_id: externalMatchId, match_date: staged.played_on, home_team: staged.home_team, away_team: staged.away_team, league_name: staged.league_name, flight: staged.flight, source: 'tennisrecord', status: 'completed', match_source: 'usta', winner_side: staged.winner_side, score: staged.score_text, rating_eligible: false }, { onConflict: 'external_match_id' }).select('id').single()
  if (parent.error || !parent.data?.id) throw new Error(parent.error?.message || 'Could not promote TennisRecord match event.')
  const line = await service.from('matches').upsert({ external_match_id: `${externalMatchId}::line:${staged.court_number}`, match_date: staged.played_on, league_name: staged.league_name, flight: staged.flight, source: 'tennisrecord', status: 'completed', match_source: 'usta', match_type: staged.discipline, line_number: String(staged.court_number), winner_side: staged.winner_side, score: staged.score_text, rating_eligible: true }, { onConflict: 'external_match_id' }).select('id').single()
  if (line.error || !line.data?.id) throw new Error(line.error?.message || 'Could not promote TennisRecord court match.')
  const remove = await service.from('match_players').delete().eq('match_id', line.data.id)
  if (remove.error) throw new Error(remove.error.message)
  const insert = await service.from('match_players').insert(participants.map((participant) => ({ match_id: line.data.id, player_id: participant.playerId, side: participant.side, seat: participant.seat })))
  if (insert.error) throw new Error(insert.error.message)
  return line.data.id as string
}

function emptySummary(status: TennisRecordRunSummary['status']): TennisRecordRunSummary {
  return { status, pagesAttempted: 0, pagesProcessed: 0, playersDiscovered: 0, teamsDiscovered: 0, matchesStaged: 0, canonicalMatchesCreated: 0, duplicatesDetected: 0, conflictsFound: 0, blockedRequests: 0, parserFailures: 0 }
}
