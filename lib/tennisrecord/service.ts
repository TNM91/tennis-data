import type { SupabaseClient } from '@supabase/supabase-js'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'
import { fetchTennisRecordPage } from './collector'
import { parseTennisRecordMatchPage, normalizedTennisRecordPlayerName, tennisRecordRecordPageKind } from './parser'
import { canonicalTennisRecordFingerprint, sourcePriority } from './reconcile'
import type { TennisRecordRunSummary } from './types'

type AutomationState = 'manual' | 'bootstrap' | 'weekly'
type Settings = { enabled: boolean; min_request_interval_ms: number; max_requests_per_run: number; weekly_lookback_days: number; automation_state: AutomationState; weekly_refresh_started_at: string | null; active_campaign_id: string | null }
type QueueRow = { id: string; source_url: string; page_kind: string; campaign_id: string | null; retry_count: number }
type SyncTriggerKind = 'manual' | 'bootstrap' | 'weekly'
type SyncInput = { triggerKind: SyncTriggerKind; requestedByUserId?: string; limit?: number; pageKinds?: string[]; campaignId?: string | null }
const SCHEDULED_TENNISRECORD_BATCH_LIMIT = 5
const MAX_TRANSIENT_TENNISRECORD_RETRIES = 3

export function scheduledTennisRecordBatchLimit(maxRequestsPerRun: number) {
  return Math.min(maxRequestsPerRun, SCHEDULED_TENNISRECORD_BATCH_LIMIT)
}

export function tennisRecordFailureDisposition(message: string, retryCount: number) {
  const transient = /(fetch failed|network|timeout|timed out|econn|socket hang up|temporarily unavailable)/i.test(message)
  return transient && retryCount < MAX_TRANSIENT_TENNISRECORD_RETRIES ? 'retry' as const : 'quarantine' as const
}

export function tennisRecordAutomationDecision(state: AutomationState, cadence: 'bootstrap' | 'weekly', pendingPages: number) {
  if (state !== cadence) return 'skip' as const
  if (cadence === 'bootstrap' && pendingPages === 0) return 'complete_bootstrap' as const
  return 'run' as const
}

export function isWeeklyTennisRecordRefreshDue(lastRefreshStartedAt: string | null, now = Date.now()) {
  if (!lastRefreshStartedAt) return true
  const last = Date.parse(lastRefreshStartedAt)
  return !Number.isFinite(last) || now - last >= 7 * 86_400_000
}

export async function getTennisRecordOperationalStatus(service: SupabaseClient) {
  const [settings, lastRun, pending, conflicts, identities, campaigns] = await Promise.all([
    service.from('tennisrecord_collector_settings').select('*').eq('id', true).maybeSingle(),
    service.from('tennisrecord_sync_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    service.from('tennisrecord_canonical_matches').select('fingerprint', { count: 'exact', head: true }).eq('has_conflict', true),
    service.from('tennisrecord_player_identities').select('staged_player_id,status,confidence,tennisrecord_staged_players(name,city,state,ntrp_label,source_url)').in('status', ['pending', 'ambiguous']).order('updated_at').limit(50),
    service.from('tennisrecord_campaigns').select('id,slug,name,region_label,starts_on,ends_on,status,seed_provenance').order('created_at'),
  ])
  if (settings.error || lastRun.error || pending.error || conflicts.error || identities.error || campaigns.error) throw new Error('TennisRecord operations status is unavailable.')
  return { settings: settings.data, lastRun: lastRun.data, pendingPages: pending.count || 0, conflicts: conflicts.count || 0, identityReview: identities.data || [], campaigns: campaigns.data || [] }
}

export async function enqueueTennisRecordUrls(service: SupabaseClient, urls: string[], campaignId?: string | null) {
  const cleaned = [...new Set(urls.map((url) => url.trim()).filter(Boolean))]
  const supported = cleaned.flatMap((sourceUrl) => {
    const pageKind = tennisRecordRecordPageKind(sourceUrl)
    return pageKind ? [{ source_url: sourceUrl, page_kind: pageKind, status: 'pending', campaign_id: campaignId || null, last_seen_at: new Date().toISOString() }] : []
  })
  if (!supported.length) return 0
  const { error } = await service.from('tennisrecord_crawl_queue').upsert(supported, { onConflict: 'source_url' })
  if (error) throw new Error(error.message)
  return supported.length
}

export async function runTennisRecordSync(service: SupabaseClient, input: SyncInput): Promise<TennisRecordRunSummary> {
  const { data: rawSettings, error: settingsError } = await service.from('tennisrecord_collector_settings').select('*').eq('id', true).single()
  if (settingsError) throw new Error(settingsError.message)
  const settings = rawSettings as Settings
  if (!settings.enabled || process.env.TENNISRECORD_COLLECTOR_ENABLED !== 'true') return emptySummary('disabled')
  const { data: run, error: runError } = await service.from('tennisrecord_sync_runs').insert({ trigger_kind: input.triggerKind, requested_by_user_id: input.requestedByUserId || null }).select('id').single()
  if (runError && isActiveRunLockError(runError)) return emptySummary('skipped')
  if (runError || !run?.id) throw new Error(runError?.message || 'Could not create TennisRecord sync run.')
  const runId = run.id as string
  const summary = emptySummary('completed')
  try {
    let jobsQuery = service.from('tennisrecord_crawl_queue').select('id,source_url,page_kind,campaign_id,retry_count').eq('status', 'pending')
    if (input.pageKinds?.length) jobsQuery = jobsQuery.in('page_kind', input.pageKinds)
    if (input.campaignId) jobsQuery = jobsQuery.eq('campaign_id', input.campaignId)
    const { data: jobs, error: jobsError } = await jobsQuery.order('page_kind').order('first_seen_at').limit(Math.min(input.limit || settings.max_requests_per_run, settings.max_requests_per_run))
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
        await stageParsedPage(service, parsed, pageUpsert.data?.id as string | undefined, job.campaign_id)
        summary.pagesProcessed += 1; summary.playersDiscovered += parsed.players.length; summary.teamsDiscovered += parsed.teams.length; summary.matchesStaged += parsed.matches.length
        await service.from('tennisrecord_crawl_queue').update({ status: 'done', retry_count: 0, failure_reason: '', completed_at: new Date().toISOString() }).eq('id', job.id)
      } catch (error) {
        summary.parserFailures += 1
        const failureReason = error instanceof Error ? error.message : 'Unknown collector failure'
        const disposition = tennisRecordFailureDisposition(failureReason, job.retry_count || 0)
        await service.from('tennisrecord_crawl_queue').update({
          status: disposition === 'retry' ? 'pending' : 'error',
          retry_count: disposition === 'retry' ? (job.retry_count || 0) + 1 : job.retry_count || 0,
          failure_reason: failureReason,
          last_error_at: new Date().toISOString(),
        }).eq('id', job.id)
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

/**
 * Runs a small checkpointed batch per scheduled invocation. The cap is based
 * on observed Pro runtime headroom and stays below the Admin-configured limit.
 */
export async function runScheduledTennisRecordSync(service: SupabaseClient, cadence: 'bootstrap' | 'weekly') {
  const { data: rawSettings, error } = await service.from('tennisrecord_collector_settings').select('*').eq('id', true).single()
  if (error) throw new Error(error.message)
  const settings = rawSettings as Settings
  if (!settings.enabled || process.env.TENNISRECORD_COLLECTOR_ENABLED !== 'true') return emptySummary('disabled')
  const scheduledBatchLimit = scheduledTennisRecordBatchLimit(settings.max_requests_per_run)

  if (cadence === 'bootstrap') {
    let pendingQuery = service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('page_kind', ['match', 'team', 'history'])
    if (settings.active_campaign_id) pendingQuery = pendingQuery.eq('campaign_id', settings.active_campaign_id)
    const { count, error: countError } = await pendingQuery
    if (countError) throw new Error(countError.message)
    const decision = tennisRecordAutomationDecision(settings.automation_state, cadence, count || 0)
    if (decision === 'skip') return emptySummary('skipped')
    if (decision === 'complete_bootstrap') {
      const { error: finishError } = await service.from('tennisrecord_collector_settings').update({ automation_state: 'weekly', bootstrap_completed_at: new Date().toISOString() }).eq('id', true).eq('automation_state', 'bootstrap')
      if (finishError) throw new Error(finishError.message)
      return emptySummary('completed')
    }
    const summary = await runTennisRecordSync(service, { triggerKind: 'bootstrap', limit: scheduledBatchLimit, pageKinds: ['match', 'team', 'history'], campaignId: settings.active_campaign_id })
    if (summary.status !== 'completed' && summary.status !== 'blocked') return summary
    let remainingQuery = service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('page_kind', ['match', 'team', 'history'])
    if (settings.active_campaign_id) remainingQuery = remainingQuery.eq('campaign_id', settings.active_campaign_id)
    const { count: remaining, error: remainingError } = await remainingQuery
    if (remainingError) throw new Error(remainingError.message)
    if (!remaining) {
      const { error: finishError } = await service.from('tennisrecord_collector_settings').update({ automation_state: 'weekly', bootstrap_completed_at: new Date().toISOString() }).eq('id', true).eq('automation_state', 'bootstrap')
      if (finishError) throw new Error(finishError.message)
    }
    return summary
  }

  if (tennisRecordAutomationDecision(settings.automation_state, cadence, 1) === 'skip') return emptySummary('skipped')
  let weeklyPendingQuery = service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('page_kind', 'match')
  if (settings.active_campaign_id) weeklyPendingQuery = weeklyPendingQuery.eq('campaign_id', settings.active_campaign_id)
  const { count: pending, error: pendingError } = await weeklyPendingQuery
  if (pendingError) throw new Error(pendingError.message)
  if (!pending) {
    if (!isWeeklyTennisRecordRefreshDue(settings.weekly_refresh_started_at)) return emptySummary('skipped')
    await queueRecentWeeklyMatchPages(service, settings.weekly_lookback_days, settings.active_campaign_id)
    const { error: refreshError } = await service.from('tennisrecord_collector_settings').update({ weekly_refresh_started_at: new Date().toISOString() }).eq('id', true).eq('automation_state', 'weekly')
    if (refreshError) throw new Error(refreshError.message)
  }
  return runTennisRecordSync(service, { triggerKind: 'weekly', limit: scheduledBatchLimit, pageKinds: ['match'], campaignId: settings.active_campaign_id })
}

/** The single plan-safe cron route picks the Admin-selected cadence. */
export async function runAutomaticTennisRecordSync(service: SupabaseClient) {
  const { data, error } = await service.from('tennisrecord_collector_settings').select('automation_state').eq('id', true).single()
  if (error) throw new Error(error.message)
  if (data?.automation_state !== 'bootstrap' && data?.automation_state !== 'weekly') return emptySummary('skipped')
  return runScheduledTennisRecordSync(service, data.automation_state)
}

async function queueRecentWeeklyMatchPages(service: SupabaseClient, lookbackDays: number, campaignId?: string | null) {
  const cutoff = new Date(Date.now() - lookbackDays * 86_400_000).toISOString().slice(0, 10)
  const { data: recent, error } = await service.from('tennisrecord_staged_matches').select('source_url').gte('played_on', cutoff).limit(100)
  if (error) throw new Error(error.message)
  const urls = [...new Set((recent || []).map((match) => match.source_url as string).filter(Boolean))]
  if (!urls.length) return 0
  let requeue = service.from('tennisrecord_crawl_queue').update({ status: 'pending', failure_reason: '', completed_at: null }).eq('status', 'done').eq('page_kind', 'match').in('source_url', urls)
  if (campaignId) requeue = requeue.eq('campaign_id', campaignId)
  const { error: updateError } = await requeue
  if (updateError) throw new Error(updateError.message)
  return urls.length
}

function isActiveRunLockError(error: { code?: string; message?: string }) {
  return error.code === '23505' && /tennisrecord_sync_runs_one_active_idx/i.test(error.message || '')
}

async function stageParsedPage(service: SupabaseClient, parsed: ReturnType<typeof parseTennisRecordMatchPage>, pageId?: string, campaignId?: string | null) {
  if (parsed.players.length) {
    const { data: staged, error } = await service.from('tennisrecord_staged_players').upsert(parsed.players.map((player) => ({ source_player_key: player.sourcePlayerKey, name: player.name, normalized_name: normalizedTennisRecordPlayerName(player), city: player.city || null, state: player.state || null, ntrp_label: player.ntrpLabel || null, published_rating: player.publishedRating || null, source_url: player.sourceUrl, raw: player, last_seen_at: new Date().toISOString() })), { onConflict: 'source_player_key' }).select('id,source_player_key,name,normalized_name,city,state')
    if (error) throw new Error(error.message)
    if (staged?.length) {
      const identityInsert = await service.from('tennisrecord_player_identities').upsert(staged.map((player) => ({ staged_player_id: player.id })), { onConflict: 'staged_player_id', ignoreDuplicates: true })
      if (identityInsert.error) throw new Error(identityInsert.error.message)
      const existing = await service.from('tennisrecord_player_identities').select('staged_player_id,canonical_player_id,status').in('staged_player_id', staged.map((player) => player.id))
      if (existing.error) throw new Error(existing.error.message)
      const alreadyMapped = new Set((existing.data || []).filter((row) => row.canonical_player_id || row.status === 'rejected').map((row) => row.staged_player_id))
      const local = await service.from('players').select('id,normalized_name,name').in('normalized_name', staged.map((player) => player.normalized_name))
      if (local.error) throw new Error(local.error.message)
      const localByName = new Map<string, string[]>()
      for (const player of local.data || []) {
        const name = player.normalized_name || normalizedTennisRecordPlayerName({ name: player.name } as Parameters<typeof normalizedTennisRecordPlayerName>[0])
        localByName.set(name, [...(localByName.get(name) || []), player.id])
      }
      const collisions = staged.filter((player) => !alreadyMapped.has(player.id) && (localByName.get(player.normalized_name)?.length || 0) > 1)
      const uniqueLocal = staged.filter((player) => !alreadyMapped.has(player.id) && (localByName.get(player.normalized_name)?.length || 0) === 1)
      const provisional = staged.filter((player) => !alreadyMapped.has(player.id) && !localByName.has(player.normalized_name))
      if (collisions.length) {
        const review = await service.from('tennisrecord_player_identities').upsert(collisions.map((player) => ({ staged_player_id: player.id, status: 'ambiguous', confidence: 0, signals: ['same_name_local_player_requires_review'] })), { onConflict: 'staged_player_id' })
        if (review.error) throw new Error(review.error.message)
      }
      if (uniqueLocal.length) {
        const linked = await service.from('tennisrecord_player_identities').upsert(uniqueLocal.map((player) => ({ staged_player_id: player.id, canonical_player_id: localByName.get(player.normalized_name)?.[0], status: 'matched', confidence: 0.75, signals: ['unique_local_name_match', 'tennisrecord_low_authority_evidence'] })), { onConflict: 'staged_player_id' })
        if (linked.error) throw new Error(linked.error.message)
      }
      if (provisional.length) {
        const created = await service.from('players').upsert(provisional.map((player) => ({ name: player.name, normalized_name: player.normalized_name, location: [player.city, player.state].filter(Boolean).join(', ') || null, rating_source: 'self', external_source: 'tennisrecord', external_source_key: player.source_player_key, is_external_provisional: true })), { onConflict: 'external_source,external_source_key' }).select('id,external_source_key')
        if (created.error) throw new Error(created.error.message)
        const playerIdByKey = new Map((created.data || []).map((player) => [player.external_source_key as string, player.id as string]))
        const mappings = provisional.flatMap((player) => {
          const canonicalPlayerId = playerIdByKey.get(player.source_player_key)
          return canonicalPlayerId ? [{ staged_player_id: player.id, canonical_player_id: canonicalPlayerId, status: 'matched', confidence: 0.9, signals: ['tennisrecord_source_id', 'provisional_external_player'], reviewed_at: null, reviewed_by_user_id: null }] : []
        })
        if (mappings.length) {
          const mapped = await service.from('tennisrecord_player_identities').upsert(mappings, { onConflict: 'staged_player_id' })
          if (mapped.error) throw new Error(mapped.error.message)
        }
      }
    }
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
  if (parsed.discoveredUrls.length) await enqueueTennisRecordUrls(service, parsed.discoveredUrls, campaignId)
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
