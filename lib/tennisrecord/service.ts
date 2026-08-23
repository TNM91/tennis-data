import type { SupabaseClient } from '@supabase/supabase-js'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'
import { fetchTennisRecordPage } from './collector'
import { parseTennisRecordMatchPage, normalizedTennisRecordPlayerName, tennisRecordRecordPageKind } from './parser'
import { canonicalTennisRecordFingerprint, normalizeTennisIdentity, sourcePriority } from './reconcile'
import { getTennisRecordCampaignPlayerHistoryUrls, getTennisRecordCampaignSeedUrls, isTennisRecordCampaignDiscoveryAllowed, tennisRecordFrontierStatus } from './frontier'
import type { TennisRecordRunSummary } from './types'

type AutomationState = 'manual' | 'bootstrap' | 'weekly'
type Settings = { enabled: boolean; min_request_interval_ms: number; max_requests_per_run: number; weekly_lookback_days: number; automation_state: AutomationState; bootstrap_started_at: string | null; bootstrap_completed_at: string | null; weekly_refresh_started_at: string | null; active_campaign_id: string | null }
type QueueRow = { id: string; source_url: string; page_kind: string; campaign_id: string | null; retry_count: number; deferred_retry_count: number; deferred_retry_at: string | null }
type SyncTriggerKind = 'manual' | 'bootstrap' | 'weekly'
type SyncInput = { triggerKind: SyncTriggerKind; requestedByUserId?: string; limit?: number; pageKinds?: string[]; pageKindPlan?: readonly (readonly string[])[]; campaignId?: string | null }
type CoverageSummary = {
  staged_player_count: number
  filterable_team_count: number
  filterable_league_count: number
  filterable_flight_count: number
  source_roster_listing_count: number
  source_team_history_count: number
  unpromoted_team_history_count: number
  promoted_match_count: number
}
// Historical backfill uses the Admin-configured safe ceiling. Requests remain
// sequentially paced, while the bounded batch keeps the checkpoint resumable
// and within the cron runtime.
const BOOTSTRAP_TENNISRECORD_BATCH_LIMIT = 8
const WEEKLY_TENNISRECORD_BATCH_LIMIT = 8
const SCHEDULED_TENNISRECORD_REPLAY_BATCH_LIMIT = 1
const MAX_TRANSIENT_TENNISRECORD_RETRIES = 3
const MAX_DEFERRED_TENNISRECORD_RETRIES = 2
const DEFERRED_TENNISRECORD_RETRY_DELAYS_MS = [6 * 60 * 60_000, 24 * 60 * 60_000] as const
const DEFERRED_TENNISRECORD_RETRY_BATCH_LIMIT = 4
const STALE_TENNISRECORD_RUN_MS = 10 * 60_000
export const TENNISRECORD_AUTOMATION_INTERVAL_MINUTES = 5
const TENNISRECORD_SOURCE_BLOCK_BACKOFF_MS = 30 * 60_000
const TENNISRECORD_CHECKPOINT_PRESSURE_BACKOFF_MS = 15 * 60_000
const TENNISRECORD_LONG_CHECKPOINT_MS = 3 * 60_000
// Profiles and team pages carry factual location and roster context. They
// must travel with match/history pages, otherwise the campaign cannot safely
// grow from its own verified source graph.
export const TENNISRECORD_BOOTSTRAP_PAGE_KINDS = ['history', 'league', 'match', 'player', 'team'] as const
export const TENNISRECORD_WEEKLY_PAGE_KINDS = ['history', 'match', 'player', 'team'] as const

/**
 * Keep bounded checkpoints balanced. A profile carries explicit location
 * evidence, while a history/match/team page carries result and roster
 * evidence. Without this plan, alphabetical queue ordering can let one page
 * type monopolize a long-running bootstrap.
 */
export function tennisRecordScheduledPageKindPlan(cadence: 'bootstrap' | 'weekly', limit: number) {
  const cycle = cadence === 'bootstrap'
    ? [['league'], ['player'], ['history', 'match', 'team']]
    : [['match', 'history'], ['match', 'history'], ['player', 'team'], ['match', 'history']]
  return Array.from({ length: Math.max(0, limit) }, (_, index) => cycle[index % cycle.length])
}
// Revision 3 adds source roster observations from explicitly-labelled team
// roster tables. Captured public pages replay gradually through the existing
// bounded checkpoint, so historical team pages benefit without a re-crawl.
const TENNISRECORD_PARSER_REVISION = 3

export function scheduledTennisRecordBatchLimit(maxRequestsPerRun: number, cadence: 'bootstrap' | 'weekly' = 'bootstrap') {
  const ceiling = cadence === 'weekly' ? WEEKLY_TENNISRECORD_BATCH_LIMIT : BOOTSTRAP_TENNISRECORD_BATCH_LIMIT
  return Math.min(maxRequestsPerRun, ceiling)
}

/**
 * A transparent projection for the currently known queue. Public source pages
 * can discover more eligible pages, so this is deliberately a queue estimate,
 * not a promise that a historical campaign is fully exhausted.
 */
export function tennisRecordCheckpointForecast(pendingPages: number, runningPages: number, maxRequestsPerRun: number, cadence: 'bootstrap' | 'weekly' = 'bootstrap') {
  const pagesPerCheckpoint = Math.max(1, scheduledTennisRecordBatchLimit(maxRequestsPerRun, cadence))
  const checkpointsRemaining = Math.ceil(Math.max(0, pendingPages + runningPages) / pagesPerCheckpoint)
  return {
    pagesPerCheckpoint,
    checkpointsRemaining,
    estimatedMinutesRemaining: checkpointsRemaining * TENNISRECORD_AUTOMATION_INTERVAL_MINUTES,
  }
}

type TennisRecordRunSafetySample = {
  started_at?: string | null
  completed_at?: string | null
  blocked_requests?: number | null
  parser_failures?: number | null
  source_failures?: number | null
}

export type TennisRecordCadenceSafety = {
  active: boolean
  reason: string | null
  resumesAt: string | null
}

/**
 * Keep the faster schedule polite. This never changes source pacing or opens
 * parallel fetches: it simply holds the next checkpoints when the last run
 * reports a block, repeated failures, or unexpected runtime pressure.
 */
export function tennisRecordCadenceSafetyStatus(lastRun: TennisRecordRunSafetySample | null | undefined, now = Date.now()): TennisRecordCadenceSafety {
  const completedAt = Date.parse(lastRun?.completed_at || '')
  if (!lastRun || !Number.isFinite(completedAt)) return { active: false, reason: null, resumesAt: null }

  const startedAt = Date.parse(lastRun.started_at || '')
  const durationMs = Number.isFinite(startedAt) ? Math.max(0, completedAt - startedAt) : 0
  const hasBlock = Number(lastRun.blocked_requests || 0) > 0
  const hasRepeatedFailures = Number(lastRun.parser_failures || 0) >= 2 || Number(lastRun.source_failures || 0) >= 2
  const ranLong = durationMs >= TENNISRECORD_LONG_CHECKPOINT_MS
  const backoffMs = hasBlock ? TENNISRECORD_SOURCE_BLOCK_BACKOFF_MS : hasRepeatedFailures || ranLong ? TENNISRECORD_CHECKPOINT_PRESSURE_BACKOFF_MS : 0
  if (!backoffMs) return { active: false, reason: null, resumesAt: null }

  const resumesAtMs = completedAt + backoffMs
  const reason = hasBlock
    ? 'A source access block was observed.'
    : hasRepeatedFailures
      ? 'The latest checkpoint reported repeated source or parser failures.'
      : 'The latest checkpoint ran longer than expected.'
  return { active: now < resumesAtMs, reason, resumesAt: new Date(resumesAtMs).toISOString() }
}

export function tennisRecordFailureDisposition(message: string, retryCount: number) {
  const transient = isTennisRecordTransientFailure(message)
  return transient && retryCount < MAX_TRANSIENT_TENNISRECORD_RETRIES ? 'retry' as const : 'quarantine' as const
}

export function isTennisRecordTransientFailure(message: string) {
  return /(fetch failed|network|timeout|timed out|econn|socket hang up|temporarily unavailable)/i.test(message)
}

/**
 * Transport failures get two later, rate-limited attempts after the normal
 * retry budget. Blocks, malformed pages, and access restrictions remain
 * terminal and are never requeued by this path.
 */
export function tennisRecordDeferredRetryAt(message: string, deferredRetryCount: number, now = Date.now()) {
  if (!isTennisRecordTransientFailure(message) || deferredRetryCount >= MAX_DEFERRED_TENNISRECORD_RETRIES) return null
  const delay = DEFERRED_TENNISRECORD_RETRY_DELAYS_MS[deferredRetryCount]
  return new Date(now + delay).toISOString()
}

export function isTennisRecordRunStale(startedAt: string, now = Date.now()) {
  const started = Date.parse(startedAt)
  return !Number.isFinite(started) || now - started >= STALE_TENNISRECORD_RUN_MS
}

export function buildTennisRecordQueueDiscoveryPlan(
  urls: string[],
  existingSourceUrls: Iterable<string>,
  campaignId?: string | null,
  observedAt = new Date().toISOString(),
) {
  const existing = new Set(existingSourceUrls)
  const cleaned = [...new Set(urls.map((url) => url.trim()).filter(Boolean))]
  const supported = cleaned.flatMap((sourceUrl) => {
    const pageKind = tennisRecordRecordPageKind(sourceUrl)
    return pageKind ? [{ source_url: sourceUrl, page_kind: pageKind, status: 'pending' as const, campaign_id: campaignId || null, last_seen_at: observedAt }] : []
  })
  return {
    newRows: supported.filter((row) => !existing.has(row.source_url)),
    rediscoveredUrls: supported.filter((row) => existing.has(row.source_url)).map((row) => row.source_url),
  }
}

export function tennisRecordAutomationDecision(state: AutomationState, cadence: 'bootstrap' | 'weekly', pendingPages: number, knownPages = pendingPages) {
  if (state !== cadence) return 'skip' as const
  if (cadence === 'bootstrap' && pendingPages === 0) return knownPages === 0 ? 'awaiting_seed' as const : 'complete_bootstrap' as const
  return 'run' as const
}

export function tennisRecordCampaignCompletionAction(hasPlannedCampaign: boolean) {
  return hasPlannedCampaign ? 'advance_campaign' as const : 'start_weekly' as const
}

export function isWeeklyTennisRecordRefreshDue(lastRefreshStartedAt: string | null, now = Date.now()) {
  if (!lastRefreshStartedAt) return true
  const last = Date.parse(lastRefreshStartedAt)
  return !Number.isFinite(last) || now - last >= 7 * 86_400_000
}

/**
 * The recurring sync starts on Wednesday morning in the league's home time
 * zone. The scheduled checkpoints keep draining that same weekly queue until
 * it is clear, rather than waiting another week after history pages discover
 * new match-result links.
 */
export function isTennisRecordWeeklyWindowOpen(now = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short' }).format(now)
  return weekday === 'Wed'
}

/** Start once for a newly provisioned collector; later Admin pauses stay paused. */
export function shouldSelfStartTennisRecordBootstrap(settings: Pick<Settings, 'automation_state' | 'bootstrap_started_at' | 'bootstrap_completed_at'> | null) {
  return settings?.automation_state === 'manual' && !settings.bootstrap_started_at && !settings.bootstrap_completed_at
}

export async function getTennisRecordOperationalStatus(service: SupabaseClient) {
  const [settings, lastRun, pending, conflicts, identities, campaigns, coverage] = await Promise.all([
    service.from('tennisrecord_collector_settings').select('*').eq('id', true).maybeSingle(),
    service.from('tennisrecord_sync_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    service.from('tennisrecord_canonical_matches').select('fingerprint', { count: 'exact', head: true }).eq('has_conflict', true),
    service.from('tennisrecord_player_identities').select('staged_player_id,status,confidence,tennisrecord_staged_players(name,city,state,ntrp_label,source_url)').in('status', ['pending', 'ambiguous']).order('updated_at').limit(50),
    service.from('tennisrecord_campaigns').select('id,slug,name,region_label,starts_on,ends_on,status,seed_provenance').order('created_at'),
    service.from('tennisrecord_admin_coverage_summary').select('*').maybeSingle(),
  ])
  if (settings.error || lastRun.error || pending.error || conflicts.error || identities.error || campaigns.error || coverage.error) throw new Error('TennisRecord operations status is unavailable.')
  const activeCampaignId = (settings.data as Settings | null)?.active_campaign_id || null
  const countCampaignPages = (status: string) => {
    let query = service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('status', status)
    if (activeCampaignId) query = query.eq('campaign_id', activeCampaignId)
    return query
  }
  const [campaignPending, campaignCompleted, campaignRunning, campaignBlocked, campaignErrors] = await Promise.all([
    countCampaignPages('pending'),
    countCampaignPages('done'),
    countCampaignPages('running'),
    countCampaignPages('blocked'),
    countCampaignPages('error'),
  ])
  if (campaignPending.error || campaignCompleted.error || campaignRunning.error || campaignBlocked.error || campaignErrors.error) throw new Error('TennisRecord campaign progress is unavailable.')
  const weeklyStartedAt = (settings.data as Settings | null)?.weekly_refresh_started_at || null
  const countWeeklyPages = (status: string, timestampColumn: 'last_seen_at' | 'completed_at') => {
    let query = service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('status', status).in('page_kind', TENNISRECORD_WEEKLY_PAGE_KINDS)
    if (activeCampaignId) query = query.eq('campaign_id', activeCampaignId)
    if (weeklyStartedAt) query = query.gte(timestampColumn, weeklyStartedAt)
    return query
  }
  const emptyWeeklyCount = { count: 0, error: null }
  const [weeklyPending, weeklyCompleted, weeklyRunning, weeklyBlocked, weeklyErrors] = weeklyStartedAt
    ? await Promise.all([
      countWeeklyPages('pending', 'last_seen_at'),
      countWeeklyPages('done', 'completed_at'),
      countWeeklyPages('running', 'last_seen_at'),
      countWeeklyPages('blocked', 'completed_at'),
      countWeeklyPages('error', 'completed_at'),
    ])
    : [emptyWeeklyCount, emptyWeeklyCount, emptyWeeklyCount, emptyWeeklyCount, emptyWeeklyCount]
  if (weeklyPending.error || weeklyCompleted.error || weeklyRunning.error || weeklyBlocked.error || weeklyErrors.error) throw new Error('TennisRecord weekly progress is unavailable.')
  const campaignRows = campaigns.data || []
  const activeCampaign = campaignRows.find((campaign) => campaign.id === activeCampaignId)
  const nextCampaign = campaignRows.find((campaign) => campaign.status === 'planned') || null
  const activeSeedUrls = activeCampaign
    ? getTennisRecordCampaignSeedUrls({ slug: activeCampaign.slug, startsOn: activeCampaign.starts_on, endsOn: activeCampaign.ends_on })
    : []
  const knownCampaignPages = (campaignPending.count || 0) + (campaignCompleted.count || 0) + (campaignRunning.count || 0) + (campaignBlocked.count || 0) + (campaignErrors.count || 0)
  const campaignForecast = tennisRecordCheckpointForecast(
    campaignPending.count || 0,
    campaignRunning.count || 0,
    (settings.data as Settings | null)?.max_requests_per_run || BOOTSTRAP_TENNISRECORD_BATCH_LIMIT,
  )
  return {
    settings: settings.data,
    lastRun: lastRun.data,
    automationCadenceMinutes: TENNISRECORD_AUTOMATION_INTERVAL_MINUTES,
    safetyThrottle: tennisRecordCadenceSafetyStatus(lastRun.data as TennisRecordRunSafetySample | null),
    pendingPages: activeCampaignId ? campaignPending.count || 0 : pending.count || 0,
    campaignProgress: {
      pending: campaignPending.count || 0,
      completed: campaignCompleted.count || 0,
      running: campaignRunning.count || 0,
      blocked: campaignBlocked.count || 0,
      errors: campaignErrors.count || 0,
    },
    campaignForecast: {
      ...campaignForecast,
      estimateBasis: 'known_queue' as const,
    },
    nextCampaign: nextCampaign ? {
      id: nextCampaign.id,
      name: nextCampaign.name,
      region_label: nextCampaign.region_label,
      starts_on: nextCampaign.starts_on,
      ends_on: nextCampaign.ends_on,
      status: nextCampaign.status,
    } : null,
    weeklyProgress: {
      startedAt: weeklyStartedAt,
      pending: weeklyPending.count || 0,
      completed: weeklyCompleted.count || 0,
      running: weeklyRunning.count || 0,
      blocked: weeklyBlocked.count || 0,
      errors: weeklyErrors.count || 0,
    },
    conflicts: conflicts.count || 0,
    coverage: (coverage.data as CoverageSummary | null) || {
      staged_player_count: 0,
      filterable_team_count: 0,
      filterable_league_count: 0,
      filterable_flight_count: 0,
      source_roster_listing_count: 0,
      source_team_history_count: 0,
      unpromoted_team_history_count: 0,
      promoted_match_count: 0,
    },
    identityReview: identities.data || [],
    campaigns: campaignRows.map((campaign) => ({
      ...campaign,
      availableSeedPages: getTennisRecordCampaignSeedUrls({ slug: campaign.slug, startsOn: campaign.starts_on, endsOn: campaign.ends_on }).length,
    })),
    frontier: { status: tennisRecordFrontierStatus(knownCampaignPages, activeSeedUrls.length) },
  }
}

export async function enqueueTennisRecordUrls(service: SupabaseClient, urls: string[], campaignId?: string | null) {
  const observedAt = new Date().toISOString()
  const candidates = buildTennisRecordQueueDiscoveryPlan(urls, [], campaignId, observedAt)
  if (!candidates.newRows.length) return 0
  const sourceUrls = candidates.newRows.map((row) => row.source_url)
  const { data: existing, error: existingError } = await service
    .from('tennisrecord_crawl_queue')
    .select('source_url')
    .in('source_url', sourceUrls)
  if (existingError) throw new Error(existingError.message)
  const plan = buildTennisRecordQueueDiscoveryPlan(
    urls,
    (existing || []).map((row) => row.source_url as string),
    campaignId,
    observedAt,
  )

  // Discovery refreshes provenance only. Reopening a completed, blocked, or
  // quarantined page here would create an endless crawl loop and corrupt the
  // queue-progress estimate. Explicit weekly refresh logic is the only path
  // allowed to return a completed page to pending.
  if (plan.rediscoveredUrls.length) {
    const { error } = await service
      .from('tennisrecord_crawl_queue')
      .update({ last_seen_at: observedAt })
      .in('source_url', plan.rediscoveredUrls)
    if (error) throw new Error(error.message)
  }
  if (plan.newRows.length) {
    const { error } = await service
      .from('tennisrecord_crawl_queue')
      .upsert(plan.newRows, { onConflict: 'source_url', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  }
  return plan.newRows.length
}

export async function seedTennisRecordCampaignFrontier(service: SupabaseClient, campaignId: string) {
  const { data: campaign, error } = await service.from('tennisrecord_campaigns').select('id,slug,starts_on,ends_on,status').eq('id', campaignId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!campaign || campaign.status === 'completed') throw new Error('Choose an active historical campaign before seeding its public frontier.')
  const urls = getTennisRecordCampaignSeedUrls({ slug: campaign.slug, startsOn: campaign.starts_on, endsOn: campaign.ends_on })
  return enqueueTennisRecordUrls(service, urls, campaign.id)
}

export async function runTennisRecordSync(service: SupabaseClient, input: SyncInput): Promise<TennisRecordRunSummary> {
  const { data: rawSettings, error: settingsError } = await service.from('tennisrecord_collector_settings').select('*').eq('id', true).single()
  if (settingsError) throw new Error(settingsError.message)
  const settings = rawSettings as Settings
  if (!settings.enabled) return emptySummary('disabled')
  await reclaimStaleTennisRecordRuns(service)
  const { data: run, error: runError } = await service.from('tennisrecord_sync_runs').insert({ trigger_kind: input.triggerKind, requested_by_user_id: input.requestedByUserId || null }).select('id').single()
  if (runError && isActiveRunLockError(runError)) return emptySummary('skipped')
  if (runError || !run?.id) throw new Error(runError?.message || 'Could not create TennisRecord sync run.')
  const runId = run.id as string
  const summary = emptySummary('completed')
  try {
    summary.transientRetries += await requeueDueDeferredTennisRecordRetries(service, input.campaignId)
    const campaign = input.campaignId
      ? await service.from('tennisrecord_campaigns').select('slug').eq('id', input.campaignId).maybeSingle()
      : { data: null, error: null }
    if (campaign.error) throw new Error(campaign.error.message)
    const campaignSlug = campaign.data?.slug as string | undefined
    const replay = await reparseCapturedTennisRecordMatchPages(service, runId, input.campaignId, campaignSlug)
    const touchedSourceMatchKeys = new Set<string>()
    summary.pagesProcessed += replay.pagesProcessed
    summary.playersDiscovered += replay.playersDiscovered
    summary.teamsDiscovered += replay.teamsDiscovered
    summary.matchesStaged += replay.matchesStaged
    summary.parserFailures += replay.parserFailures
    const requestedLimit = Math.min(input.limit || settings.max_requests_per_run, settings.max_requests_per_run)
    for (let index = 0; index < requestedLimit; index += 1) {
      const preferredKinds = input.pageKindPlan?.[index] || input.pageKinds || []
      const job = await selectNextTennisRecordQueueJob(service, input, preferredKinds)
        || (input.pageKindPlan ? await selectNextTennisRecordQueueJob(service, input, input.pageKinds || []) : null)
      if (!job) break
      summary.pagesAttempted += 1
      await service.from('tennisrecord_crawl_queue').update({ status: 'running', attempted_at: new Date().toISOString(), last_run_id: runId }).eq('id', job.id).eq('status', 'pending')
      try {
        const page = await fetchTennisRecordPage(job.source_url, settings.min_request_interval_ms)
        summary.transientRetries += page.transientRetries
        const pageUpsert = await service.from('tennisrecord_source_pages').upsert({ source_url: page.url, content_hash: page.contentHash, http_status: page.status, captured_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), blocked: Boolean(page.blockReason), block_reason: page.blockReason, raw_html: page.html || null, sync_run_id: runId, parser_revision: TENNISRECORD_PARSER_REVISION }, { onConflict: 'source_url,content_hash' }).select('id').single()
        if (pageUpsert.error) throw new Error(pageUpsert.error.message)
        if (page.blockReason) {
          summary.blockedRequests += 1; summary.status = 'blocked'
          await service.from('tennisrecord_crawl_queue').update({ status: 'blocked', failure_reason: page.blockReason, completed_at: new Date().toISOString() }).eq('id', job.id)
          continue
        }
        const parsed = parseTennisRecordMatchPage(page.html, page.url)
        if (job.page_kind === 'match' && parsed.matches.length === 0) {
          summary.parserFailures += 1
          await service.from('tennisrecord_crawl_queue').update({
            status: 'error',
            failure_reason: 'No complete TennisRecord court results were parsed; page evidence was retained for review.',
            last_error_at: new Date().toISOString(),
          }).eq('id', job.id)
          continue
        }
        for (const sourceMatchKey of await stageParsedPage(service, parsed, page.url, pageUpsert.data?.id as string | undefined, job.campaign_id, campaignSlug, TENNISRECORD_PARSER_REVISION)) {
          touchedSourceMatchKeys.add(sourceMatchKey)
        }
        summary.pagesProcessed += 1; summary.playersDiscovered += parsed.players.length; summary.teamsDiscovered += parsed.teams.length; summary.matchesStaged += parsed.matches.length
        await service.from('tennisrecord_crawl_queue').update({ status: 'done', retry_count: 0, failure_reason: '', completed_at: new Date().toISOString() }).eq('id', job.id)
      } catch (error) {
        const failureReason = error instanceof Error ? error.message : 'Unknown collector failure'
        const disposition = tennisRecordFailureDisposition(failureReason, job.retry_count || 0)
        const deferredRetryAt = disposition === 'quarantine'
          ? tennisRecordDeferredRetryAt(failureReason, job.deferred_retry_count || 0)
          : null
        if (disposition === 'retry') summary.transientRetries += 1
        else if (deferredRetryAt) summary.transientRetries += 1
        else summary.sourceFailures += 1
        await service.from('tennisrecord_crawl_queue').update({
          status: disposition === 'retry' ? 'pending' : 'error',
          retry_count: disposition === 'retry' ? (job.retry_count || 0) + 1 : job.retry_count || 0,
          failure_reason: failureReason,
          last_error_at: new Date().toISOString(),
          deferred_retry_at: deferredRetryAt,
        }).eq('id', job.id)
      }
    }
    const reconciled = await reconcileTennisRecordMatches(service, [...replay.sourceMatchKeys, ...touchedSourceMatchKeys])
    summary.canonicalMatchesCreated = reconciled.created; summary.duplicatesDetected = reconciled.duplicates; summary.conflictsFound = reconciled.conflicts
    await service.from('tennisrecord_sync_runs').update({ status: summary.status, completed_at: new Date().toISOString(), pages_attempted: summary.pagesAttempted, pages_processed: summary.pagesProcessed, players_discovered: summary.playersDiscovered, teams_discovered: summary.teamsDiscovered, matches_staged: summary.matchesStaged, canonical_matches_created: summary.canonicalMatchesCreated, duplicates_detected: summary.duplicatesDetected, conflicts_found: summary.conflictsFound, blocked_requests: summary.blockedRequests, parser_failures: summary.parserFailures, transient_retries: summary.transientRetries, source_failures: summary.sourceFailures }).eq('id', runId)
    return summary
  } catch (error) {
    await service.from('tennisrecord_sync_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: error instanceof Error ? error.message : 'Unknown sync failure' }).eq('id', runId)
    throw error
  }
}

/**
 * A serverless interruption must not hold the partial unique run lock forever.
 * Ten minutes is safely beyond the route's five-minute runtime allowance.
 */
async function reclaimStaleTennisRecordRuns(service: SupabaseClient) {
  const staleBefore = new Date(Date.now() - STALE_TENNISRECORD_RUN_MS).toISOString()
  const { data: staleRuns, error } = await service
    .from('tennisrecord_sync_runs')
    .select('id')
    .eq('status', 'running')
    .lt('started_at', staleBefore)
  if (error) throw new Error(error.message)
  const runIds = (staleRuns || []).map((run) => run.id as string).filter(Boolean)
  if (!runIds.length) return 0
  const reclaimedAt = new Date().toISOString()
  const [queueResult, runResult] = await Promise.all([
    service
      .from('tennisrecord_crawl_queue')
      .update({ status: 'pending', failure_reason: 'Interrupted checkpoint reclaimed for retry.', last_error_at: reclaimedAt })
      .in('last_run_id', runIds)
      .eq('status', 'running'),
    service
      .from('tennisrecord_sync_runs')
      .update({ status: 'failed', completed_at: reclaimedAt, error_message: 'Interrupted checkpoint reclaimed for retry.' })
      .in('id', runIds)
      .eq('status', 'running'),
  ])
  if (queueResult.error || runResult.error) throw new Error(queueResult.error?.message || runResult.error?.message || 'Could not reclaim an interrupted TennisRecord run.')
  return runIds.length
}

/**
 * Runs a small checkpointed batch per scheduled invocation. The cap is based
 * on observed Pro runtime headroom and stays below the Admin-configured limit.
 */
export async function runScheduledTennisRecordSync(service: SupabaseClient, cadence: 'bootstrap' | 'weekly') {
  const { data: rawSettings, error } = await service.from('tennisrecord_collector_settings').select('*').eq('id', true).single()
  if (error) throw new Error(error.message)
  const settings = rawSettings as Settings
  if (!settings.enabled) return emptySummary('disabled')
  const scheduledBatchLimit = scheduledTennisRecordBatchLimit(settings.max_requests_per_run, cadence)

  if (cadence === 'bootstrap') {
    let pendingQuery = service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('page_kind', TENNISRECORD_BOOTSTRAP_PAGE_KINDS)
    if (settings.active_campaign_id) pendingQuery = pendingQuery.eq('campaign_id', settings.active_campaign_id)
    const { count, error: countError } = await pendingQuery
    if (countError) throw new Error(countError.message)
    let knownPages = count || 0
    if (settings.active_campaign_id) {
      const allCampaignPages = await service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('campaign_id', settings.active_campaign_id)
      if (allCampaignPages.error) throw new Error(allCampaignPages.error.message)
      knownPages = allCampaignPages.count || 0
      // Seed discovery is idempotent: every checkpoint can safely introduce a
      // newly approved frontier URL without reopening completed queue rows.
      // This lets a running Missouri mission gain its bounded league path
      // rather than waiting for the old player-only queue to exhaust.
      await seedTennisRecordCampaignFrontier(service, settings.active_campaign_id)
      const seededPages = await service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('campaign_id', settings.active_campaign_id)
      if (seededPages.error) throw new Error(seededPages.error.message)
      knownPages = seededPages.count || 0
    }
    const refreshedPending = settings.active_campaign_id
      ? await service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('campaign_id', settings.active_campaign_id).in('page_kind', TENNISRECORD_BOOTSTRAP_PAGE_KINDS)
      : { count, error: null }
    if (refreshedPending.error) throw new Error(refreshedPending.error.message)
    const decision = tennisRecordAutomationDecision(settings.automation_state, cadence, refreshedPending.count || 0, knownPages)
    if (decision === 'skip') return emptySummary('skipped')
    if (decision === 'awaiting_seed') return emptySummary('awaiting_seed')
    if (decision === 'complete_bootstrap') {
      await completeActiveTennisRecordCampaign(service, settings.active_campaign_id)
      return emptySummary('completed')
    }
    const summary = await runTennisRecordSync(service, {
      triggerKind: 'bootstrap',
      limit: scheduledBatchLimit,
      pageKinds: [...TENNISRECORD_BOOTSTRAP_PAGE_KINDS],
      pageKindPlan: tennisRecordScheduledPageKindPlan('bootstrap', scheduledBatchLimit),
      campaignId: settings.active_campaign_id,
    })
    if (summary.status !== 'completed' && summary.status !== 'blocked') return summary
    let remainingQuery = service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('page_kind', TENNISRECORD_BOOTSTRAP_PAGE_KINDS)
    if (settings.active_campaign_id) remainingQuery = remainingQuery.eq('campaign_id', settings.active_campaign_id)
    const { count: remaining, error: remainingError } = await remainingQuery
    if (remainingError) throw new Error(remainingError.message)
    if (!remaining) await completeActiveTennisRecordCampaign(service, settings.active_campaign_id)
    return summary
  }

  if (tennisRecordAutomationDecision(settings.automation_state, cadence, 1) === 'skip') return emptySummary('skipped')
  let weeklyPendingQuery = service.from('tennisrecord_crawl_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('page_kind', TENNISRECORD_WEEKLY_PAGE_KINDS)
  if (settings.active_campaign_id) weeklyPendingQuery = weeklyPendingQuery.eq('campaign_id', settings.active_campaign_id)
  const { count: pending, error: pendingError } = await weeklyPendingQuery
  if (pendingError) throw new Error(pendingError.message)
  if (!pending) {
    if (!isTennisRecordWeeklyWindowOpen() || !isWeeklyTennisRecordRefreshDue(settings.weekly_refresh_started_at)) return emptySummary('skipped')
    await queueRecentWeeklyMatchPages(service, settings.weekly_lookback_days, settings.active_campaign_id)
    const { error: refreshError } = await service.from('tennisrecord_collector_settings').update({ weekly_refresh_started_at: new Date().toISOString() }).eq('id', true).eq('automation_state', 'weekly')
    if (refreshError) throw new Error(refreshError.message)
  }
  return runTennisRecordSync(service, {
    triggerKind: 'weekly',
    limit: scheduledBatchLimit,
    pageKinds: [...TENNISRECORD_WEEKLY_PAGE_KINDS],
    pageKindPlan: tennisRecordScheduledPageKindPlan('weekly', scheduledBatchLimit),
    campaignId: settings.active_campaign_id,
  })
}

/** Advance only after a campaign queue is exhausted; never replace an active frontier mid-run. */
async function completeActiveTennisRecordCampaign(service: SupabaseClient, activeCampaignId?: string | null) {
  const now = new Date().toISOString()
  const planned = await service.from('tennisrecord_campaigns').select('id').eq('status', 'planned').order('starts_on').order('created_at').limit(1).maybeSingle()
  if (planned.error) throw new Error(planned.error.message)
  const action = tennisRecordCampaignCompletionAction(Boolean(planned.data?.id))

  if (action === 'advance_campaign' && planned.data?.id) {
    let settingsUpdate = service.from('tennisrecord_collector_settings')
      .update({ active_campaign_id: planned.data.id, automation_state: 'bootstrap', bootstrap_started_at: now, bootstrap_completed_at: null })
      .eq('id', true).eq('automation_state', 'bootstrap')
    settingsUpdate = activeCampaignId
      ? settingsUpdate.eq('active_campaign_id', activeCampaignId)
      : settingsUpdate.is('active_campaign_id', null)
    const { data: switched, error: settingsError } = await settingsUpdate.select('id').maybeSingle()
    if (settingsError) throw new Error(settingsError.message)
    if (!switched) return
    if (activeCampaignId) {
      const { error: currentError } = await service.from('tennisrecord_campaigns').update({ status: 'completed' }).eq('id', activeCampaignId)
      if (currentError) throw new Error(currentError.message)
    }
    const { error: nextError } = await service.from('tennisrecord_campaigns').update({ status: 'active' }).eq('id', planned.data.id)
    if (nextError) throw new Error(nextError.message)
    return
  }

  if (activeCampaignId) {
    const { error: currentError } = await service.from('tennisrecord_campaigns').update({ status: 'completed' }).eq('id', activeCampaignId)
    if (currentError) throw new Error(currentError.message)
  }
  const { error: settingsError } = await service.from('tennisrecord_collector_settings')
    .update({ automation_state: 'weekly', bootstrap_completed_at: now }).eq('id', true).eq('automation_state', 'bootstrap')
  if (settingsError) throw new Error(settingsError.message)
}

async function selectNextTennisRecordQueueJob(service: SupabaseClient, input: SyncInput, pageKinds: readonly string[]) {
  let query = service.from('tennisrecord_crawl_queue').select('id,source_url,page_kind,campaign_id,retry_count,deferred_retry_count,deferred_retry_at').eq('status', 'pending')
  if (pageKinds.length) query = query.in('page_kind', pageKinds)
  if (input.campaignId) query = query.eq('campaign_id', input.campaignId)
  const { data, error } = await query.order('first_seen_at').limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return data as QueueRow | null
}

async function requeueDueDeferredTennisRecordRetries(service: SupabaseClient, campaignId?: string | null) {
  let dueQuery = service
    .from('tennisrecord_crawl_queue')
    .select('id,deferred_retry_count')
    .eq('status', 'error')
    .not('deferred_retry_at', 'is', null)
    .lte('deferred_retry_at', new Date().toISOString())
    .lt('deferred_retry_count', MAX_DEFERRED_TENNISRECORD_RETRIES)
    .order('deferred_retry_at')
    .limit(DEFERRED_TENNISRECORD_RETRY_BATCH_LIMIT)
  if (campaignId) dueQuery = dueQuery.eq('campaign_id', campaignId)
  const { data: dueRows, error } = await dueQuery
  if (error) throw new Error(error.message)

  for (const row of dueRows || []) {
    const { error: updateError } = await service
      .from('tennisrecord_crawl_queue')
      .update({
        status: 'pending',
        retry_count: 0,
        deferred_retry_count: (row.deferred_retry_count || 0) + 1,
        deferred_retry_at: null,
        failure_reason: 'Deferred transient retry scheduled.',
      })
      .eq('id', row.id)
      .eq('status', 'error')
    if (updateError) throw new Error(updateError.message)
  }

  return (dueRows || []).length
}

/** The single Pro cron route picks the automatic bootstrap or weekly cadence. */
export async function runAutomaticTennisRecordSync(service: SupabaseClient) {
  const [settingsResult, recentRunResult] = await Promise.all([
    service.from('tennisrecord_collector_settings').select('automation_state,bootstrap_started_at,bootstrap_completed_at').eq('id', true).single(),
    service.from('tennisrecord_sync_runs').select('started_at,completed_at,blocked_requests,parser_failures,source_failures').not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (settingsResult.error || recentRunResult.error) throw new Error(settingsResult.error?.message || recentRunResult.error?.message || 'TennisRecord automation status is unavailable.')
  const data = settingsResult.data
  let automationState = data?.automation_state as AutomationState | undefined
  if (shouldSelfStartTennisRecordBootstrap(data as Pick<Settings, 'automation_state' | 'bootstrap_started_at' | 'bootstrap_completed_at'> | null)) {
    const { data: activated, error: activationError } = await service.from('tennisrecord_collector_settings')
      .update({ enabled: true, automation_state: 'bootstrap', bootstrap_started_at: new Date().toISOString(), bootstrap_completed_at: null })
      .eq('id', true)
      .eq('automation_state', 'manual')
      .is('bootstrap_started_at', null)
      .is('bootstrap_completed_at', null)
      .select('automation_state')
      .maybeSingle()
    if (activationError) throw new Error(activationError.message)
    automationState = activated?.automation_state as AutomationState | undefined
  }
  if (automationState !== 'bootstrap' && automationState !== 'weekly') return emptySummary('skipped')
  if (tennisRecordCadenceSafetyStatus(recentRunResult.data as TennisRecordRunSafetySample | null).active) return emptySummary('skipped')
  return runScheduledTennisRecordSync(service, automationState)
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
  if (!campaignId) return urls.length

  const { data: campaign, error: campaignError } = await service.from('tennisrecord_campaigns').select('slug,starts_on,ends_on').eq('id', campaignId).maybeSingle()
  if (campaignError) throw new Error(campaignError.message)
  if (!campaign) return urls.length
  const currentYear = String(new Date().getFullYear())
  const discoveryUrls = getTennisRecordCampaignSeedUrls({ slug: campaign.slug, startsOn: campaign.starts_on, endsOn: campaign.ends_on })
    .filter((url) => new URL(url).searchParams.get('year') === currentYear)
  const queuedHistory = await enqueueTennisRecordUrls(service, discoveryUrls, campaignId)
  return urls.length + queuedHistory
}

function isActiveRunLockError(error: { code?: string; message?: string }) {
  return error.code === '23505' && /tennisrecord_sync_runs_one_active_idx/i.test(error.message || '')
}

type ParserReplaySummary = Pick<TennisRecordRunSummary, 'pagesProcessed' | 'playersDiscovered' | 'teamsDiscovered' | 'matchesStaged' | 'parserFailures'> & { sourceMatchKeys: string[] }

async function reparseCapturedTennisRecordMatchPages(service: SupabaseClient, runId: string, campaignId?: string | null, campaignSlug?: string): Promise<ParserReplaySummary> {
  const summary: ParserReplaySummary = { pagesProcessed: 0, playersDiscovered: 0, teamsDiscovered: 0, matchesStaged: 0, parserFailures: 0, sourceMatchKeys: [] }
  const { data: pages, error } = await service
    .from('tennisrecord_source_pages')
    .select('id,source_url,raw_html')
    .eq('blocked', false)
    .lt('parser_revision', TENNISRECORD_PARSER_REVISION)
    .not('raw_html', 'is', null)
    .order('last_seen_at', { ascending: false })
    .limit(SCHEDULED_TENNISRECORD_REPLAY_BATCH_LIMIT)
  if (error) throw new Error(error.message)

  for (const page of pages || []) {
    const sourceUrl = page.source_url as string
    const html = page.raw_html as string
    const parsed = parseTennisRecordMatchPage(html, sourceUrl)
    const isMatchPage = tennisRecordRecordPageKind(sourceUrl) === 'match'
    const hasCompleteMatches = parsed.matches.length > 0
    const now = new Date().toISOString()

    const quarantine = await service.from('tennisrecord_staged_matches').update({
      parse_status: hasCompleteMatches ? 'superseded' : 'quarantined',
      parse_failure_reason: hasCompleteMatches ? 'Superseded by a newer validated parser revision.' : 'No complete court result with trustworthy team context was parsed.',
      parser_revision: TENNISRECORD_PARSER_REVISION,
      last_seen_at: now,
    }).eq('source_url', sourceUrl).lt('parser_revision', TENNISRECORD_PARSER_REVISION)
    if (quarantine.error) throw new Error(quarantine.error.message)

    if (isMatchPage && !hasCompleteMatches) {
      summary.parserFailures += 1
    } else {
      summary.sourceMatchKeys.push(...await stageParsedPage(service, parsed, sourceUrl, page.id as string, campaignId, campaignSlug, TENNISRECORD_PARSER_REVISION))
      summary.pagesProcessed += 1
      summary.playersDiscovered += parsed.players.length
      summary.teamsDiscovered += parsed.teams.length
      summary.matchesStaged += parsed.matches.length
    }

    const sourceUpdate = await service.from('tennisrecord_source_pages').update({ parser_revision: TENNISRECORD_PARSER_REVISION, sync_run_id: runId, last_seen_at: now }).eq('id', page.id)
    if (sourceUpdate.error) throw new Error(sourceUpdate.error.message)
  }
  return summary
}

async function stageParsedPage(service: SupabaseClient, parsed: ReturnType<typeof parseTennisRecordMatchPage>, sourceUrl: string, pageId?: string, campaignId?: string | null, campaignSlug?: string, parserRevision = TENNISRECORD_PARSER_REVISION) {
  let savedSourceMatchKeys: string[] = []
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
    await enqueueDiscoveredCampaignPlayerHistory(service, parsed.players, campaignId)
  }
  if (parsed.leagues.length) {
    const { error } = await service.from('tennisrecord_staged_leagues').upsert(parsed.leagues.map((league) => ({ source_league_key: league.sourceLeagueKey, name: league.name, flight: league.flight || null, season_year: league.seasonYear, source_url: league.sourceUrl, raw: league, last_seen_at: new Date().toISOString() })), { onConflict: 'source_league_key' })
    if (error) throw new Error(error.message)
  }
  if (parsed.teams.length) {
    const { error } = await service.from('tennisrecord_staged_teams').upsert(parsed.teams.map((team) => ({ source_team_key: team.sourceTeamKey, name: team.name, league_name: team.leagueName || null, flight: team.flight || null, season_year: team.seasonYear, source_url: team.sourceUrl, raw: team, last_seen_at: new Date().toISOString() })), { onConflict: 'source_team_key' })
    if (error) throw new Error(error.message)
  }
  if (parsed.teamMembers.length) {
    const { error } = await service.from('tennisrecord_staged_team_memberships').upsert(parsed.teamMembers.map((member) => ({
      team_name: member.teamName,
      normalized_team_name: normalizeTennisIdentity(member.teamName),
      source_player_key: member.sourcePlayerKey,
      player_name: member.name,
      source_url: member.sourceUrl,
      raw: member,
      last_seen_at: new Date().toISOString(),
    })), { onConflict: 'normalized_team_name,source_player_key' })
    if (error) throw new Error(error.message)
  }
  if (parsed.matches.length) {
    const now = new Date().toISOString()
    const rows = parsed.matches.map((match) => ({ source_match_key: match.sourceMatchKey, source_url: match.sourceUrl, page_id: pageId || null, played_on: match.playedOn || null, league_name: match.leagueName || null, flight: match.flight || null, home_team: match.homeTeam || null, away_team: match.awayTeam || null, discipline: match.discipline, court_number: match.courtNumber, score_text: match.scoreText || null, winner_side: match.winnerSide, participants: match.participants, fingerprint: canonicalTennisRecordFingerprint(match), raw: match, parser_revision: parserRevision, parse_status: 'valid', parse_failure_reason: '', last_seen_at: now }))
    const { data: saved, error } = await service.from('tennisrecord_staged_matches').upsert(rows, { onConflict: 'source_match_key' }).select('id,fingerprint,source_match_key,source_url,score_text,winner_side,participants')
    if (error) throw new Error(error.message)
    if (saved?.length) {
      savedSourceMatchKeys = saved.map((match) => match.source_match_key as string)
      const observationRows = saved.map((match) => ({ fingerprint: match.fingerprint, source: 'tennisrecord', source_priority: sourcePriority('tennisrecord'), source_record_id: match.source_match_key, source_url: match.source_url, staged_match_id: match.id, score_text: match.score_text, winner_side: match.winner_side, participants: match.participants, raw: { stagedMatchId: match.id }, confidence: 0.55, captured_at: now, last_seen_at: now }))
      const observation = await service.from('tennisrecord_match_observations').upsert(observationRows, { onConflict: 'fingerprint,source,source_record_id' })
      if (observation.error) throw new Error(observation.error.message)
    }
  }
  const scopedDiscoveryUrls = parsed.discoveredUrls.filter((candidateUrl) => isTennisRecordCampaignDiscoveryAllowed(campaignSlug, sourceUrl, candidateUrl))
  if (scopedDiscoveryUrls.length) await enqueueTennisRecordUrls(service, scopedDiscoveryUrls, campaignId)
  return savedSourceMatchKeys
}

/**
 * A profile's own location is the campaign-boundary signal. We never use a
 * name from an arbitrary search result or a match participant with unknown
 * geography to grow historical crawl scope.
 */
async function enqueueDiscoveredCampaignPlayerHistory(
  service: SupabaseClient,
  players: Array<{ name: string; state: string; sourceUrl: string }>,
  campaignId?: string | null,
) {
  if (!campaignId) return 0

  const { data: campaign, error } = await service
    .from('tennisrecord_campaigns')
    .select('slug,starts_on,ends_on')
    .eq('id', campaignId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!campaign) return 0

  const urls = [...new Set(players.flatMap((player) => {
    if (tennisRecordRecordPageKind(player.sourceUrl) !== 'player') return []
    return getTennisRecordCampaignPlayerHistoryUrls({
      slug: campaign.slug,
      startsOn: campaign.starts_on,
      endsOn: campaign.ends_on,
      playerName: player.name,
      state: player.state,
    })
  }))]
  return enqueueTennisRecordUrls(service, urls, campaignId)
}

async function reconcileTennisRecordMatches(service: SupabaseClient, sourceMatchKeys: string[]) {
  const uniqueSourceMatchKeys = [...new Set(sourceMatchKeys.filter(Boolean))]
  if (!uniqueSourceMatchKeys.length) return { created: 0, duplicates: 0, conflicts: 0 }
  const { data: staged, error } = await service.from('tennisrecord_staged_matches').select('id,source_match_key,source_url,fingerprint,played_on,league_name,flight,home_team,away_team,discipline,court_number,score_text,winner_side,participants').eq('parse_status', 'valid').in('source_match_key', uniqueSourceMatchKeys)
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
  const line = await service.from('matches').upsert({ external_match_id: `${externalMatchId}::line:${staged.court_number}`, match_date: staged.played_on, home_team: staged.home_team, away_team: staged.away_team, league_name: staged.league_name, flight: staged.flight, source: 'tennisrecord', status: 'completed', match_source: 'usta', match_type: staged.discipline, line_number: String(staged.court_number), winner_side: staged.winner_side, score: staged.score_text, rating_eligible: true }, { onConflict: 'external_match_id' }).select('id').single()
  if (line.error || !line.data?.id) throw new Error(line.error?.message || 'Could not promote TennisRecord court match.')
  const remove = await service.from('match_players').delete().eq('match_id', line.data.id)
  if (remove.error) throw new Error(remove.error.message)
  const insert = await service.from('match_players').insert(participants.map((participant) => ({ match_id: line.data.id, player_id: participant.playerId, side: participant.side, seat: participant.seat })))
  if (insert.error) throw new Error(insert.error.message)
  return line.data.id as string
}

function emptySummary(status: TennisRecordRunSummary['status']): TennisRecordRunSummary {
  return { status, pagesAttempted: 0, pagesProcessed: 0, playersDiscovered: 0, teamsDiscovered: 0, matchesStaged: 0, canonicalMatchesCreated: 0, duplicatesDetected: 0, conflictsFound: 0, blockedRequests: 0, parserFailures: 0, transientRetries: 0, sourceFailures: 0 }
}
