import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'
import { fetchTennisRecordPage, hasTennisRecordFetchBudget, TennisRecordCheckpointBudgetError, TENNISRECORD_SOURCE_WORK_BUDGET_MS } from './collector'
import { parseTennisRecordMatchPage, normalizedTennisRecordPlayerName, tennisRecordRecordPageKind, tennisRecordStatedNtrpBaseline, tennisRecordStatedNtrpDesignation } from './parser'
import { canonicalTennisRecordFingerprint, normalizeTennisIdentity, sourcePriority } from './reconcile'
import { isSyntheticTennisRecordObservation, tennisRecordResultCorrection } from './result-integrity'
import { findExistingProductionMatch, type ProductionMatch, type CanonicalParticipant } from './production-match-lookup'
import { getTennisRecordCampaignPlayerHistoryUrls, getTennisRecordCampaignSeedUrls, isTennisRecordCampaignDiscoveryAllowed, tennisRecordCampaignCurrentEndOn, tennisRecordFrontierStatus } from './frontier'
import type { TennisRecordRunSummary } from './types'

type AutomationState = 'manual' | 'bootstrap' | 'weekly'
type Settings = { enabled: boolean; min_request_interval_ms: number; max_requests_per_run: number; weekly_lookback_days: number; automation_state: AutomationState; bootstrap_started_at: string | null; bootstrap_completed_at: string | null; weekly_refresh_started_at: string | null; active_campaign_id: string | null; rating_recalculation_requested_at: string | null; rating_recalculation_reason: string | null; rating_recalculated_at: string | null }
type QueueRow = { id: string; source_url: string; page_kind: string; campaign_id: string | null; retry_count: number; deferred_retry_count: number; deferred_retry_at: string | null }
type SyncTriggerKind = 'manual' | 'bootstrap' | 'weekly'
type SyncInput = { triggerKind: SyncTriggerKind; requestedByUserId?: string; limit?: number; pageKinds?: string[]; pageKindPlan?: readonly (readonly string[])[]; campaignId?: string | null; recalculateRatings?: boolean }

/**
 * A newly discovered computer-rated USTA baseline is factual player context.
 * Keep an untouched provisional profile from visibly remaining below that
 * baseline while the protected full rating pass rebuilds the full history.
 */
export function floorFreshComputerRatedDynamic(current: number | null | undefined, baseline: number) {
  return Math.max(typeof current === 'number' && Number.isFinite(current) ? current : baseline, baseline)
}

export type TennisRecordAdultFlightEvidence = {
  matchDate: string | null | undefined
  leagueName: string | null | undefined
  flight: string | null | undefined
  matchSource?: string | null | undefined
  ratingEligible?: boolean | null | undefined
}

export type InferredAdultFlightBaseline = {
  ntrp: number
  seasonYear: number
  evidenceMatches: number
  seasonMatches: number
}

export function ratingSourceFromStatedNtrp(
  baseline: number | null,
  designation: ReturnType<typeof tennisRecordStatedNtrpDesignation>,
) {
  if (designation === 'computer') return 'verified' as const
  if (designation === 'self') return 'self' as const
  // A source page can factually state the numeric level without showing C/S.
  // Keep that level, but never invent a self-rating designation for it.
  return baseline === null ? 'unknown' as const : 'inferred' as const
}

/**
 * A current profile page can omit its stated NTRP while an earlier profile
 * page supplied a valid one. Preserve that valid factual context, but clear
 * a legacy malformed value so it cannot keep blocking observation staging.
 */
export function preserveTennisRecordStatedNtrpLabel(currentLabel: unknown, priorLabel: unknown) {
  if (tennisRecordStatedNtrpBaseline(currentLabel) !== null) {
    return typeof currentLabel === 'string' ? currentLabel.trim() : null
  }
  if (tennisRecordStatedNtrpBaseline(priorLabel) !== null) {
    return typeof priorLabel === 'string' ? priorLabel.trim() : null
  }
  return null
}

const MIN_INFERRED_ADULT_FLIGHT_MATCHES = 8
const MIN_INFERRED_ADULT_FLIGHT_SHARE = 0.7

/**
 * A standard Adult flight is meaningful public evidence of a player’s current
 * competitive level. It is not evidence of a C/S designation: people can play
 * up, and Mixed and Tri-Level divisions intentionally combine levels. Only a
 * sustained, dominant standard-Adult season is allowed to establish an
 * inferred starting baseline.
 */
export function inferCurrentAdultFlightBaseline(
  matches: TennisRecordAdultFlightEvidence[],
): InferredAdultFlightBaseline | null {
  const evidence = matches.flatMap((match) => {
    if (match.ratingEligible === false || (match.matchSource && match.matchSource !== 'usta')) return []
    const leagueName = match.leagueName || ''
    if (!/\badult\b/i.test(leagueName) || /\b(?:mixed|tri[-\s]?level)\b/i.test(leagueName)) return []
    const seasonYear = Number(String(match.matchDate || '').slice(0, 4))
    if (!Number.isInteger(seasonYear) || seasonYear < 2000 || seasonYear > 2100) return []
    const flightValue = String(match.flight || '').trim()
    const exactFlight = flightValue.match(/^([2-5]\.[05])$/)?.[1]
    const namedFlight = leagueName.match(/\b([2-5]\.[05])\b/)?.[1]
    const ntrp = Number(exactFlight || namedFlight)
    return Number.isFinite(ntrp) ? [{ seasonYear, ntrp }] : []
  })
  if (!evidence.length) return null

  const seasonYear = Math.max(...evidence.map((match) => match.seasonYear))
  const currentSeason = evidence.filter((match) => match.seasonYear === seasonYear)
  if (currentSeason.length < MIN_INFERRED_ADULT_FLIGHT_MATCHES) return null

  const counts = new Map<number, number>()
  for (const match of currentSeason) counts.set(match.ntrp, (counts.get(match.ntrp) || 0) + 1)
  const [ntrp, evidenceMatches] = [...counts.entries()].sort((left, right) => right[1] - left[1] || right[0] - left[0])[0]
  if (evidenceMatches < MIN_INFERRED_ADULT_FLIGHT_MATCHES || evidenceMatches / currentSeason.length < MIN_INFERRED_ADULT_FLIGHT_SHARE) return null

  return { ntrp, seasonYear, evidenceMatches, seasonMatches: currentSeason.length }
}
export type TennisRecordRatingBatchSummary = {
  status: 'completed' | 'disabled' | 'skipped'
  pendingMatches: number
  processedMatches: number
  reason?: string
}
export type TennisRecordPipelineHealth = {
  state: 'healthy' | 'attention' | 'cooling_down' | 'paused'
  message: string
}
type RatingBaselineAlignmentPlayer = {
  id: string
  rating_source: string | null
  overall_rating: number | null
  overall_dynamic_rating: number | null
}
export type RatingBaselineAlignment = {
  verifiedPlayers: number
  atOrNearBaseline: number
  buildingAboveBaseline: number
  belowBaseline: number
  materiallyBelowBaseline: number
}
// Historical backfill uses the Admin-configured safe ceiling. Requests remain
// sequentially paced, while the bounded batch keeps the checkpoint resumable
// and within the cron runtime.
// A collector checkpoint also reconciles match evidence and may promote line
// records. The collector remains sequentially rate-limited. Eighteen pages
// uses the additional database headroom without increasing the public-source
// request rate. Normal checkpoints stay within the observed runtime headroom;
// the route's existing five-minute limit remains the final safety boundary.
const BOOTSTRAP_TENNISRECORD_BATCH_LIMIT = 18
const WEEKLY_TENNISRECORD_BATCH_LIMIT = 3
// Replaying already-captured pages does not contact the source. Six local-only
// pages per checkpoint recover stated NTRP evidence from existing profiles
// without increasing external request pressure, while leaving the external
// collector sequentially rate-limited.
const SCHEDULED_TENNISRECORD_REPLAY_BATCH_LIMIT = 6
const MAX_TRANSIENT_TENNISRECORD_RETRIES = 3
const MAX_DEFERRED_TENNISRECORD_RETRIES = 2
// The Admin tracker is an estimate by design. Planner counts avoid a series
// of exact table scans competing with the live collector for disk IO.
const TENNISRECORD_STATUS_COUNT = { count: 'planned' as const, head: true }
// A transport failure must not consume the rest of the current checkpoint by
// immediately selecting the same oldest queue row again. Keep the normal
// in-request retry in collector.ts, then give a failed page a short, polite
// checkpoint break while newer public pages continue to progress.
const TENNISRECORD_TRANSIENT_RETRY_DELAY_MS = 6 * 60_000
const DEFERRED_TENNISRECORD_RETRY_DELAYS_MS = [6 * 60 * 60_000, 24 * 60 * 60_000] as const
const DEFERRED_TENNISRECORD_RETRY_BATCH_LIMIT = 4
// The cron route is allowed to run for five minutes. A one-minute grace keeps
// an active checkpoint protected while allowing a compute restart or other
// interruption to recover on the next scheduled pass instead of idling for
// up to twelve minutes.
const STALE_TENNISRECORD_RUN_MS = 6 * 60_000
// A completed checkpoint gets a short idle gap before the next one. The
// source-request lane itself remains strictly sequential and paced by the
// configured request interval.
export const TENNISRECORD_AUTOMATION_INTERVAL_MINUTES = 3
const TENNISRECORD_SOURCE_BLOCK_BACKOFF_MS = 30 * 60_000
export const TENNISRECORD_SOURCE_PAGE_BUCKET = 'tennisrecord-source-pages'
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
// Revision 8 retains the exact public player-profile URL found on a match
// page. This lets the collector verify an existing staged identity by the
// source's stable profile key rather than by a name-only guess.
// Revision 7 reads directional winner arrows from complete court rows, then
// allows that corrected source observation to repair an older TennisRecord-only
// canonical record. A `1-0` deciding-match-tiebreak marker cannot overturn
// the source result.
// TennisRecord's estimated dynamic rating remains metadata only. Captured
// pages replay gradually from cache.
// Revision 9 preserves apostrophes inside quoted profile URLs so different
// O'-surnames cannot share one truncated source identity.
// Revision 10 requires an unambiguous source winner marker, never score order.
const TENNISRECORD_PARSER_REVISION = 10

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

type TennisRecordCompletedCheckpointSample = {
  completed_at?: string | null
  pages_attempted?: number | null
}

export type TennisRecordCheckpointPace = {
  minutesPerCheckpoint: number
  sampleCount: number
  source: 'recent_completed_checkpoints' | 'scheduled_cadence'
}

/**
 * Forecasts should reflect the actual time between completed checkpoints, not
 * just the ideal cron interval. That naturally includes deliberate safety
 * pauses and ordinary source latency without changing collector behavior.
 */
export function tennisRecordObservedCheckpointPace(samples: TennisRecordCompletedCheckpointSample[]): TennisRecordCheckpointPace {
  const completedAt = samples
    .filter((sample) => (sample.pages_attempted || 0) > 0)
    .map((sample) => Date.parse(sample.completed_at || ''))
    .filter(Number.isFinite)
    .sort((left, right) => left - right)
  const checkpointGaps = completedAt
    .slice(1)
    .map((completed, index) => (completed - completedAt[index]) / 60_000)
    .filter((minutes) => Number.isFinite(minutes) && minutes > 0 && minutes <= 24 * 60)
    .sort((left, right) => left - right)

  if (!checkpointGaps.length) {
    return {
      minutesPerCheckpoint: TENNISRECORD_AUTOMATION_INTERVAL_MINUTES,
      sampleCount: 0,
      source: 'scheduled_cadence',
    }
  }

  const midpoint = Math.floor(checkpointGaps.length / 2)
  const median = checkpointGaps.length % 2
    ? checkpointGaps[midpoint]
    : (checkpointGaps[midpoint - 1] + checkpointGaps[midpoint]) / 2
  return {
    minutesPerCheckpoint: Math.max(TENNISRECORD_AUTOMATION_INTERVAL_MINUTES, Math.ceil(median)),
    sampleCount: checkpointGaps.length,
    source: 'recent_completed_checkpoints',
  }
}

export function tennisRecordCheckpointForecastWithPace(pendingPages: number, runningPages: number, maxRequestsPerRun: number, pace: TennisRecordCheckpointPace, cadence: 'bootstrap' | 'weekly' = 'bootstrap') {
  const forecast = tennisRecordCheckpointForecast(pendingPages, runningPages, maxRequestsPerRun, cadence)
  return {
    ...forecast,
    estimatedMinutesRemaining: forecast.checkpointsRemaining * pace.minutesPerCheckpoint,
    checkpointMinutes: pace.minutesPerCheckpoint,
    paceSampleCount: pace.sampleCount,
    paceSource: pace.source,
  }
}

type TennisRecordRunSafetySample = {
  started_at?: string | null
  completed_at?: string | null
  blocked_requests?: number | null
  parser_failures?: number | null
  source_failures?: number | null
  transient_retries?: number | null
}

export type TennisRecordCadenceSafety = {
  active: boolean
  reason: string | null
  resumesAt: string | null
}

/**
 * A verified source access block must stop the next checkpoint. Individual
 * transport and parser failures are already delayed or quarantined at their
 * queue row, so they must not pause thousands of unrelated public pages.
 */
export function tennisRecordCadenceSafetyStatus(lastRun: TennisRecordRunSafetySample | null | undefined, now = Date.now()): TennisRecordCadenceSafety {
  const completedAt = Date.parse(lastRun?.completed_at || '')
  if (!lastRun || !Number.isFinite(completedAt)) return { active: false, reason: null, resumesAt: null }

  const hasBlock = Number(lastRun.blocked_requests || 0) > 0
  const backoffMs = hasBlock ? TENNISRECORD_SOURCE_BLOCK_BACKOFF_MS : 0
  if (!backoffMs) return { active: false, reason: null, resumesAt: null }

  const resumesAtMs = completedAt + backoffMs
  if (now >= resumesAtMs) return { active: false, reason: null, resumesAt: null }
  const reason = 'A source access block was observed.'
  return { active: true, reason, resumesAt: new Date(resumesAtMs).toISOString() }
}

/** Keep raw source evidence out of the transactional database hot path. */
export function tennisRecordSourcePageStoragePath(sourceUrl: string, contentHash: string) {
  const sourceKey = createHash('sha256').update(sourceUrl).digest('hex')
  const safeHash = contentHash.replace(/[^a-zA-Z0-9_-]/g, '') || 'content'
  return `pages/${sourceKey}/${safeHash}.html`
}

async function persistTennisRecordSourcePage(service: SupabaseClient, page: Awaited<ReturnType<typeof fetchTennisRecordPage>>, runId: string) {
  const rawHtml = page.html || null
  let storagePath: string | null = null
  let databaseFallbackHtml: string | null = rawHtml

  if (rawHtml) {
    const candidatePath = tennisRecordSourcePageStoragePath(page.url, page.contentHash)
    const upload = await service.storage
      .from(TENNISRECORD_SOURCE_PAGE_BUCKET)
      .upload(candidatePath, new Blob([rawHtml], { type: 'text/html; charset=utf-8' }), { contentType: 'text/html; charset=utf-8', upsert: true })

    if (upload.error) {
      // Preserve the source observation even if object storage is temporarily
      // unavailable. This is intentionally a rare database fallback rather
      // than a reason to discard audit evidence or stop the campaign.
      console.warn('[tennisrecord] source page storage fallback', { sourceUrl: page.url, message: upload.error.message })
    } else {
      storagePath = candidatePath
      databaseFallbackHtml = null
    }
  }

  const pageUpsert = await service
    .from('tennisrecord_source_pages')
    .upsert({
      source_url: page.url,
      content_hash: page.contentHash,
      http_status: page.status,
      captured_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      blocked: Boolean(page.blockReason),
      block_reason: page.blockReason,
      raw_html: databaseFallbackHtml,
      raw_html_storage_path: storagePath,
      sync_run_id: runId,
      parser_revision: TENNISRECORD_PARSER_REVISION,
    }, { onConflict: 'source_url,content_hash' })
    .select('id')
    .single()
  if (pageUpsert.error) throw new Error(pageUpsert.error.message)
  return pageUpsert.data?.id as string | undefined
}

export function tennisRecordFailureDisposition(message: string, retryCount: number) {
  const transient = isTennisRecordTransientFailure(message)
  return transient && retryCount < MAX_TRANSIENT_TENNISRECORD_RETRIES ? 'retry' as const : 'quarantine' as const
}

/**
 * Separate ordinary queue retries across checkpoints so a flaky public page
 * cannot stall the historical frontier or create avoidable source pressure.
 */
export function tennisRecordTransientRetryAt(message: string, retryCount: number, now = Date.now()) {
  if (tennisRecordFailureDisposition(message, retryCount) !== 'retry') return null
  return new Date(now + TENNISRECORD_TRANSIENT_RETRY_DELAY_MS).toISOString()
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

/**
 * Historical imports can steadily add canonical matches throughout the day.
 * Rebuild ratings overnight while bootstrap is active; after bootstrap, the
 * same controlled path only runs on the Wednesday weekly-refresh cadence.
 */
export function isTennisRecordRatingBatchDue(automationState: AutomationState, now = new Date()) {
  return automationState === 'bootstrap' || (automationState === 'weekly' && isTennisRecordWeeklyWindowOpen(now))
}

export function tennisRecordPipelineHealth(input: {
  enabled: boolean
  automationState: AutomationState
  lastSuccessfulCollectorAt: string | null
  safetyThrottle: TennisRecordCadenceSafety
}, now = Date.now()): TennisRecordPipelineHealth {
  if (!input.enabled || input.automationState === 'manual') return { state: 'paused', message: 'Automatic collection is paused.' }
  if (input.safetyThrottle.active) return { state: 'cooling_down', message: 'The collector is taking its planned safety pause.' }
  if (input.automationState === 'bootstrap') {
    const lastSuccess = Date.parse(input.lastSuccessfulCollectorAt || '')
    const hasMissedCheckpointWindow = !Number.isFinite(lastSuccess) || now - lastSuccess > 20 * 60_000
    if (hasMissedCheckpointWindow) return { state: 'attention', message: 'No successful import checkpoint has completed in the expected window.' }
  }
  return { state: 'healthy', message: 'Automatic collection is on pace.' }
}

/** Start once for a newly provisioned collector; later Admin pauses stay paused. */
export function shouldSelfStartTennisRecordBootstrap(settings: Pick<Settings, 'automation_state' | 'bootstrap_started_at' | 'bootstrap_completed_at'> | null) {
  return settings?.automation_state === 'manual' && !settings.bootstrap_started_at && !settings.bootstrap_completed_at
}

/**
 * An operational read of the TiQ ratings currently shown for players with a
 * confirmed USTA baseline. It is never a rating-calculation input: TiQ match
 * results remain the sole driver of dynamic movement.
 */
export function buildRatingBaselineAlignment(players: RatingBaselineAlignmentPlayer[]): RatingBaselineAlignment {
  const alignment: RatingBaselineAlignment = {
    verifiedPlayers: 0,
    atOrNearBaseline: 0,
    buildingAboveBaseline: 0,
    belowBaseline: 0,
    materiallyBelowBaseline: 0,
  }

  for (const player of players) {
    if (
      player.rating_source !== 'verified' ||
      !Number.isFinite(player.overall_rating) ||
      !Number.isFinite(player.overall_dynamic_rating)
    ) continue

    alignment.verifiedPlayers += 1
    const difference = Number(player.overall_dynamic_rating) - Number(player.overall_rating)
    if (difference > 0.06) {
      alignment.buildingAboveBaseline += 1
      continue
    }
    if (difference < -0.06) {
      alignment.belowBaseline += 1
      // Decimal rating values can produce -0.149999... for a displayed
      // 0.15 gap, so compare against the rounded presentation value.
      if (Math.round(difference * 1000) <= -150) alignment.materiallyBelowBaseline += 1
      continue
    }
    alignment.atOrNearBaseline += 1
  }

  return alignment
}

export async function getTennisRecordOperationalStatus(service: SupabaseClient) {
  // Keep the primary Admin status path operationally bounded. The former
  // version paged every verified player and loaded every NTRP observation to
  // render secondary calibration metrics. During a large import that made the
  // status page itself compete with the collector for database IO.
  const [settings, lastRun, lastSuccessfulRun, recentCompletedRuns, pending, conflicts, ratingPending, identities, campaigns] = await Promise.all([
    service.from('tennisrecord_collector_settings').select('*').eq('id', true).maybeSingle(),
    service.from('tennisrecord_sync_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    service.from('tennisrecord_sync_runs').select('completed_at').eq('status', 'completed').not('completed_at', 'is', null).order('started_at', { ascending: false }).limit(1).maybeSingle(),
    service.from('tennisrecord_sync_runs').select('completed_at,pages_attempted,trigger_kind').eq('status', 'completed').not('completed_at', 'is', null).gt('pages_attempted', 0).order('completed_at', { ascending: false }).limit(30),
    service.from('tennisrecord_crawl_queue').select('id', TENNISRECORD_STATUS_COUNT).eq('status', 'pending'),
    service.from('tennisrecord_canonical_matches').select('fingerprint', TENNISRECORD_STATUS_COUNT).eq('has_conflict', true),
    service.from('tennisrecord_canonical_matches').select('fingerprint', TENNISRECORD_STATUS_COUNT).not('canonical_match_id', 'is', null).is('rating_processed_at', null),
    service.from('tennisrecord_player_identities').select('staged_player_id,status,confidence,tennisrecord_staged_players(name,city,state,ntrp_label,source_url)').in('status', ['pending', 'ambiguous']).order('updated_at').limit(50),
    service.from('tennisrecord_campaigns').select('id,slug,name,region_label,starts_on,ends_on,status,seed_provenance').order('created_at'),
  ])
  if (settings.error || lastRun.error || lastSuccessfulRun.error || recentCompletedRuns.error || pending.error || conflicts.error || ratingPending.error || identities.error || campaigns.error) throw new Error('TennisRecord operations status is unavailable.')
  const activeCampaignId = (settings.data as Settings | null)?.active_campaign_id || null
  const countCampaignPages = (status: string) => {
    let query = service.from('tennisrecord_crawl_queue').select('id', TENNISRECORD_STATUS_COUNT).eq('status', status)
    if (activeCampaignId) query = query.eq('campaign_id', activeCampaignId)
    return query
  }
  const [campaignPending, campaignCompleted, campaignRunning, campaignReview, campaignBlocked, campaignErrors] = await Promise.all([
    countCampaignPages('pending'),
    countCampaignPages('done'),
    countCampaignPages('running'),
    countCampaignPages('review'),
    countCampaignPages('blocked'),
    countCampaignPages('error'),
  ])
  if (campaignPending.error || campaignCompleted.error || campaignRunning.error || campaignReview.error || campaignBlocked.error || campaignErrors.error) throw new Error('TennisRecord campaign progress is unavailable.')
  const weeklyStartedAt = (settings.data as Settings | null)?.weekly_refresh_started_at || null
  const countWeeklyPages = (status: string, timestampColumn: 'last_seen_at' | 'completed_at') => {
    let query = service.from('tennisrecord_crawl_queue').select('id', TENNISRECORD_STATUS_COUNT).eq('status', status).in('page_kind', TENNISRECORD_WEEKLY_PAGE_KINDS)
    if (activeCampaignId) query = query.eq('campaign_id', activeCampaignId)
    if (weeklyStartedAt) query = query.gte(timestampColumn, weeklyStartedAt)
    return query
  }
  const emptyWeeklyCount = { count: 0, error: null }
  const [weeklyPending, weeklyCompleted, weeklyRunning, weeklyReview, weeklyBlocked, weeklyErrors] = weeklyStartedAt
    ? await Promise.all([
      countWeeklyPages('pending', 'last_seen_at'),
      countWeeklyPages('done', 'completed_at'),
      countWeeklyPages('running', 'last_seen_at'),
      countWeeklyPages('review', 'completed_at'),
      countWeeklyPages('blocked', 'completed_at'),
      countWeeklyPages('error', 'completed_at'),
    ])
    : [emptyWeeklyCount, emptyWeeklyCount, emptyWeeklyCount, emptyWeeklyCount, emptyWeeklyCount, emptyWeeklyCount]
  if (weeklyPending.error || weeklyCompleted.error || weeklyRunning.error || weeklyReview.error || weeklyBlocked.error || weeklyErrors.error) throw new Error('TennisRecord weekly progress is unavailable.')
  const campaignRows = campaigns.data || []
  const activeCampaign = campaignRows.find((campaign) => campaign.id === activeCampaignId)
  const nextCampaign = campaignRows.find((campaign) => campaign.status === 'planned') || null
  const activeSeedUrls = activeCampaign
    ? getTennisRecordCampaignSeedUrls({ slug: activeCampaign.slug, startsOn: activeCampaign.starts_on, endsOn: tennisRecordCampaignCurrentEndOn(activeCampaign.ends_on) })
    : []
  const knownCampaignPages = (campaignPending.count || 0) + (campaignCompleted.count || 0) + (campaignRunning.count || 0) + (campaignReview.count || 0) + (campaignBlocked.count || 0) + (campaignErrors.count || 0)
  const completedRuns = (recentCompletedRuns.data || []) as Array<TennisRecordCompletedCheckpointSample & { trigger_kind: SyncTriggerKind }>
  const bootstrapPace = tennisRecordObservedCheckpointPace(completedRuns.filter((run) => run.trigger_kind === 'bootstrap'))
  const weeklyPace = tennisRecordObservedCheckpointPace(completedRuns.filter((run) => run.trigger_kind === 'weekly'))
  const campaignForecast = tennisRecordCheckpointForecastWithPace(
    campaignPending.count || 0,
    campaignRunning.count || 0,
    (settings.data as Settings | null)?.max_requests_per_run || BOOTSTRAP_TENNISRECORD_BATCH_LIMIT,
    bootstrapPace,
  )
  const weeklyForecast = tennisRecordCheckpointForecastWithPace(
    weeklyPending.count || 0,
    weeklyRunning.count || 0,
    (settings.data as Settings | null)?.max_requests_per_run || WEEKLY_TENNISRECORD_BATCH_LIMIT,
    weeklyPace,
    'weekly',
  )
  const safetyThrottle = tennisRecordCadenceSafetyStatus(lastRun.data as TennisRecordRunSafetySample | null)
  const collectorSettings = settings.data as Settings | null
  return {
    settings: settings.data,
    lastRun: lastRun.data,
    automationCadenceMinutes: TENNISRECORD_AUTOMATION_INTERVAL_MINUTES,
    safetyThrottle,
    pipelineHealth: {
      ...tennisRecordPipelineHealth({
        enabled: Boolean(collectorSettings?.enabled),
        automationState: collectorSettings?.automation_state || 'manual',
        lastSuccessfulCollectorAt: (lastSuccessfulRun.data?.completed_at as string | null | undefined) || null,
        safetyThrottle,
      }),
      lastSuccessfulCollectorAt: (lastSuccessfulRun.data?.completed_at as string | null | undefined) || null,
    },
    pendingPages: activeCampaignId ? campaignPending.count || 0 : pending.count || 0,
    campaignProgress: {
      pending: campaignPending.count || 0,
      completed: campaignCompleted.count || 0,
      running: campaignRunning.count || 0,
      review: campaignReview.count || 0,
      blocked: campaignBlocked.count || 0,
      errors: campaignErrors.count || 0,
    },
    campaignForecast: {
      ...campaignForecast,
      estimateBasis: 'known_queue' as const,
    },
    weeklyForecast: {
      ...weeklyForecast,
      estimateBasis: 'known_queue' as const,
    },
    nextCampaign: nextCampaign ? {
      id: nextCampaign.id,
      name: nextCampaign.name,
      region_label: nextCampaign.region_label,
      starts_on: nextCampaign.starts_on,
      ends_on: tennisRecordCampaignCurrentEndOn(nextCampaign.ends_on),
      status: nextCampaign.status,
    } : null,
    weeklyProgress: {
      startedAt: weeklyStartedAt,
      pending: weeklyPending.count || 0,
      completed: weeklyCompleted.count || 0,
      running: weeklyRunning.count || 0,
      review: weeklyReview.count || 0,
      blocked: weeklyBlocked.count || 0,
      errors: weeklyErrors.count || 0,
    },
    ratingProgress: {
      pending: ratingPending.count || 0,
      baselineRefreshPending: Boolean(collectorSettings?.rating_recalculation_requested_at),
      baselineRefreshRequestedAt: collectorSettings?.rating_recalculation_requested_at || null,
      lastRecalculatedAt: collectorSettings?.rating_recalculated_at || null,
      cadence: (settings.data as Settings | null)?.automation_state === 'bootstrap'
        ? 'overnight'
        : (settings.data as Settings | null)?.automation_state === 'weekly'
          ? 'Wednesday'
          : 'paused',
    },
    conflicts: conflicts.count || 0,
    // Coverage aggregates are intentionally deferred from this heartbeat.
    // The historical view uses whole-table counts and was starving the same
    // database that serves navigation and team access during active imports.
    coverage: null,
    // Calibration analytics intentionally load outside the live operations
    // heartbeat so that monitoring the importer can never become an import
    // bottleneck. `null` means "not sampled in this heartbeat", not zero.
    ratingEvidence: null,
    ratingAlignment: null,
    identityReview: identities.data || [],
    campaigns: campaignRows.map((campaign) => ({
      ...campaign,
      ends_on: tennisRecordCampaignCurrentEndOn(campaign.ends_on),
      availableSeedPages: getTennisRecordCampaignSeedUrls({ slug: campaign.slug, startsOn: campaign.starts_on, endsOn: tennisRecordCampaignCurrentEndOn(campaign.ends_on) }).length,
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
  const endsOn = tennisRecordCampaignCurrentEndOn(campaign.ends_on)
  if (endsOn !== campaign.ends_on) {
    const { error: refreshError } = await service
      .from('tennisrecord_campaigns')
      .update({ ends_on: endsOn })
      .eq('id', campaign.id)
      .lt('ends_on', endsOn)
    if (refreshError) throw new Error(refreshError.message)
  }
  const urls = getTennisRecordCampaignSeedUrls({ slug: campaign.slug, startsOn: campaign.starts_on, endsOn })
  return enqueueTennisRecordUrls(service, urls, campaign.id)
}

export async function runTennisRecordSync(service: SupabaseClient, input: SyncInput): Promise<TennisRecordRunSummary> {
  const sourceDeadlineAt = Date.now() + TENNISRECORD_SOURCE_WORK_BUDGET_MS
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
  const shouldRecalculateRatings = input.recalculateRatings !== false
  try {
    summary.transientRetries += await requeueDueDeferredTennisRecordRetries(service, input.campaignId)
    const campaign = input.campaignId
      ? await service.from('tennisrecord_campaigns').select('slug').eq('id', input.campaignId).maybeSingle()
      : { data: null, error: null }
    if (campaign.error) throw new Error(campaign.error.message)
    const campaignSlug = campaign.data?.slug as string | undefined
    const replay = await reparseCapturedTennisRecordMatchPages(service, runId, input.campaignId, campaignSlug)
    const touchedSourceMatchKeys = new Set<string>()
    const touchedSourcePlayerKeys = new Set(replay.sourcePlayerKeys)
    let baselineChanged = replay.baselineChanged
    summary.pagesProcessed += replay.pagesProcessed
    summary.playersDiscovered += replay.playersDiscovered
    summary.teamsDiscovered += replay.teamsDiscovered
    summary.matchesStaged += replay.matchesStaged
    summary.parserFailures += replay.parserFailures
    const requestedLimit = Math.min(input.limit || settings.max_requests_per_run, settings.max_requests_per_run)
    for (let index = 0; index < requestedLimit; index += 1) {
      if (!hasTennisRecordFetchBudget(sourceDeadlineAt, settings.min_request_interval_ms)) break
      const preferredKinds = input.pageKindPlan?.[index] || input.pageKinds || []
      const job = await selectNextTennisRecordQueueJob(service, input, preferredKinds)
        || (input.pageKindPlan ? await selectNextTennisRecordQueueJob(service, input, input.pageKinds || []) : null)
      if (!job) break
      // Queue selection can itself take time. Do not claim another row once
      // the remaining source budget cannot accommodate its pacing interval.
      if (!hasTennisRecordFetchBudget(sourceDeadlineAt, settings.min_request_interval_ms)) break
      summary.pagesAttempted += 1
      await service.from('tennisrecord_crawl_queue').update({ status: 'running', attempted_at: new Date().toISOString(), last_run_id: runId }).eq('id', job.id).eq('status', 'pending')
      try {
        const page = await fetchTennisRecordPage(job.source_url, settings.min_request_interval_ms, sourceDeadlineAt)
        summary.transientRetries += page.transientRetries
        const sourcePageId = await persistTennisRecordSourcePage(service, page, runId)
        if (page.blockReason) {
          summary.blockedRequests += 1; summary.status = 'blocked'
          await service.from('tennisrecord_crawl_queue').update({ status: 'blocked', failure_reason: page.blockReason, completed_at: new Date().toISOString() }).eq('id', job.id)
          continue
        }
        const parsed = parseTennisRecordMatchPage(page.html, page.url)
        if (job.page_kind === 'match' && parsed.matches.length === 0) {
          summary.parserFailures += 1
          await service.from('tennisrecord_crawl_queue').update({
            // The public page was captured and preserved. Keep it terminal for
            // parser review instead of presenting it as an active collector
            // failure or allowing it to re-enter the crawl queue.
            status: 'review',
            failure_reason: 'No complete TennisRecord court results were parsed; page evidence was retained for review.',
            last_error_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          }).eq('id', job.id)
          continue
        }
        const staged = await stageParsedPage(service, parsed, page.url, sourcePageId, job.campaign_id, campaignSlug, TENNISRECORD_PARSER_REVISION)
        baselineChanged = baselineChanged || staged.baselineChanged
        for (const sourceMatchKey of staged.sourceMatchKeys) {
          touchedSourceMatchKeys.add(sourceMatchKey)
        }
        for (const sourcePlayerKey of staged.sourcePlayerKeys) {
          touchedSourcePlayerKeys.add(sourcePlayerKey)
        }
        summary.pagesProcessed += 1; summary.playersDiscovered += parsed.players.length; summary.teamsDiscovered += parsed.teams.length; summary.matchesStaged += parsed.matches.length
        const unclearWinners = parsed.matches.filter(match => !match.winnerSide).length
        summary.parserFailures += unclearWinners
        await service.from('tennisrecord_crawl_queue').update({ status: unclearWinners ? 'review' : 'done', retry_count: 0, deferred_retry_at: null, failure_reason: unclearWinners ? 'Winner indicator is missing or conflicting. Source scorecards retained for review.' : '', completed_at: new Date().toISOString() }).eq('id', job.id)
      } catch (error) {
        if (error instanceof TennisRecordCheckpointBudgetError) {
          // A planned yield is not a source failure and must not consume a
          // retry or strand the claimed row. Reconcile captured pages below.
          const released = await service.from('tennisrecord_crawl_queue').update({ status: 'pending' }).eq('id', job.id).eq('status', 'running')
          if (released.error) throw new Error(released.error.message)
          break
        }
        const failureReason = error instanceof Error ? error.message : 'Unknown collector failure'
        const disposition = tennisRecordFailureDisposition(failureReason, job.retry_count || 0)
        const retryAt = disposition === 'retry'
          ? tennisRecordTransientRetryAt(failureReason, job.retry_count || 0)
          : tennisRecordDeferredRetryAt(failureReason, job.deferred_retry_count || 0)
        if (disposition === 'retry') summary.transientRetries += 1
        else if (retryAt) summary.transientRetries += 1
        else summary.sourceFailures += 1
        await service.from('tennisrecord_crawl_queue').update({
          status: disposition === 'retry' ? 'pending' : 'error',
          retry_count: disposition === 'retry' ? (job.retry_count || 0) + 1 : job.retry_count || 0,
          failure_reason: failureReason,
          last_error_at: new Date().toISOString(),
          deferred_retry_at: retryAt,
        }).eq('id', job.id)
      }
    }
    const reconciled = await reconcileTennisRecordMatches(
      service,
      [...replay.sourceMatchKeys, ...touchedSourceMatchKeys],
      false,
    )
    baselineChanged = (await applyInferredAdultFlightBaselines(service, [...touchedSourcePlayerKeys])) || baselineChanged
    if (shouldRecalculateRatings && (baselineChanged || reconciled.ratingChanged)) await recalculateDynamicRatings(undefined, service)
    if (shouldRecalculateRatings && (baselineChanged || reconciled.ratingChanged)) {
      await recordTennisRecordRatingRefreshCompletion(service)
    } else if (baselineChanged) {
      await requestTennisRecordRatingRefresh(service, 'usta_baseline_evidence_changed')
    }
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
    let pendingQuery = service.from('tennisrecord_crawl_queue').select('id').eq('status', 'pending').in('page_kind', TENNISRECORD_BOOTSTRAP_PAGE_KINDS).limit(1)
    if (settings.active_campaign_id) pendingQuery = pendingQuery.eq('campaign_id', settings.active_campaign_id)
    const { data: pendingRows, error: countError } = await pendingQuery
    if (countError) throw new Error(countError.message)
    let hasPendingPages = Boolean(pendingRows?.length)
    let hasKnownPages = hasPendingPages
    if (settings.active_campaign_id) {
      const allCampaignPages = await service.from('tennisrecord_crawl_queue').select('id').eq('campaign_id', settings.active_campaign_id).limit(1)
      if (allCampaignPages.error) throw new Error(allCampaignPages.error.message)
      hasKnownPages = Boolean(allCampaignPages.data?.length)
      // Seed discovery is idempotent: every checkpoint can safely introduce a
      // newly approved frontier URL without reopening completed queue rows.
      // This lets a running Missouri mission gain its bounded league path
      // rather than waiting for the old player-only queue to exhaust.
      await seedTennisRecordCampaignFrontier(service, settings.active_campaign_id)
      const seededPages = await service.from('tennisrecord_crawl_queue').select('id').eq('campaign_id', settings.active_campaign_id).limit(1)
      if (seededPages.error) throw new Error(seededPages.error.message)
      hasKnownPages = Boolean(seededPages.data?.length)
    }
    const refreshedPending = settings.active_campaign_id
      ? await service.from('tennisrecord_crawl_queue').select('id').eq('status', 'pending').eq('campaign_id', settings.active_campaign_id).in('page_kind', TENNISRECORD_BOOTSTRAP_PAGE_KINDS).limit(1)
      : { data: pendingRows, error: null }
    if (refreshedPending.error) throw new Error(refreshedPending.error.message)
    hasPendingPages = Boolean(refreshedPending.data?.length)
    const decision = tennisRecordAutomationDecision(settings.automation_state, cadence, hasPendingPages ? 1 : 0, hasKnownPages ? 1 : 0)
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
      recalculateRatings: false,
    })
    if (summary.status !== 'completed' && summary.status !== 'blocked') return summary
    let remainingQuery = service.from('tennisrecord_crawl_queue').select('id').eq('status', 'pending').in('page_kind', TENNISRECORD_BOOTSTRAP_PAGE_KINDS).limit(1)
    if (settings.active_campaign_id) remainingQuery = remainingQuery.eq('campaign_id', settings.active_campaign_id)
    const { data: remainingRows, error: remainingError } = await remainingQuery
    if (remainingError) throw new Error(remainingError.message)
    if (!remainingRows?.length) await completeActiveTennisRecordCampaign(service, settings.active_campaign_id)
    return summary
  }

  if (tennisRecordAutomationDecision(settings.automation_state, cadence, 1) === 'skip') return emptySummary('skipped')
  let weeklyPendingQuery = service.from('tennisrecord_crawl_queue').select('id').eq('status', 'pending').in('page_kind', TENNISRECORD_WEEKLY_PAGE_KINDS).limit(1)
  if (settings.active_campaign_id) weeklyPendingQuery = weeklyPendingQuery.eq('campaign_id', settings.active_campaign_id)
  const { data: pendingRows, error: pendingError } = await weeklyPendingQuery
  if (pendingError) throw new Error(pendingError.message)
  if (!pendingRows?.length) {
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
    recalculateRatings: false,
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
  query = query.or(`deferred_retry_at.is.null,deferred_retry_at.lte.${new Date().toISOString()}`)
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
    service.from('tennisrecord_sync_runs').select('started_at,completed_at,blocked_requests,parser_failures,source_failures,transient_retries').not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(1).maybeSingle(),
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

/**
 * Run the existing TiQ rating engine at a controlled cadence. Scheduled
 * collector checkpoints deliberately leave their newly promoted matches
 * unmarked; this batch is the only path that marks that queued evidence as
 * processed after the engine finishes successfully.
 */
export async function runScheduledTennisRecordRatingBatch(service: SupabaseClient, now = new Date()): Promise<TennisRecordRatingBatchSummary> {
  const { data: rawSettings, error: settingsError } = await service
    .from('tennisrecord_collector_settings')
    .select('enabled,automation_state,rating_recalculation_requested_at,rating_recalculated_at')
    .eq('id', true)
    .maybeSingle()
  if (settingsError) throw new Error(settingsError.message)

  const settings = rawSettings as Pick<Settings, 'enabled' | 'automation_state' | 'rating_recalculation_requested_at' | 'rating_recalculated_at'> | null
  if (!settings?.enabled) return { status: 'disabled', pendingMatches: 0, processedMatches: 0, reason: 'collector_disabled' }
  if (!isTennisRecordRatingBatchDue(settings.automation_state, now)) {
    return { status: 'skipped', pendingMatches: 0, processedMatches: 0, reason: 'outside_rating_cadence' }
  }

  const { data: activeRun, error: activeRunError } = await service
    .from('tennisrecord_sync_runs')
    .select('id')
    .eq('status', 'running')
    .limit(1)
    .maybeSingle()
  if (activeRunError) throw new Error(activeRunError.message)
  if (activeRun) return { status: 'skipped', pendingMatches: 0, processedMatches: 0, reason: 'collector_checkpoint_active' }

  // A full rating rebuild reads a coherent point-in-time match cohort. Keep
  // anything reconciled after this point queued for the next pass instead of
  // marking it processed just because it arrived while the rebuild was saving.
  const ratingWatermark = new Date().toISOString()
  const pendingQuery = service
    .from('tennisrecord_canonical_matches')
    .select('fingerprint', { count: 'exact', head: true })
    .not('canonical_match_id', 'is', null)
    .is('rating_processed_at', null)
  const { count: pendingMatches, error: pendingError } = await pendingQuery
  if (pendingError) throw new Error(pendingError.message)
  const pendingMatchCount = pendingMatches || 0
  const baselineRefreshRequested = Boolean(settings.rating_recalculation_requested_at)
  if (!pendingMatchCount && !baselineRefreshRequested) return { status: 'skipped', pendingMatches: 0, processedMatches: 0, reason: 'no_unprocessed_matches' }

  await recalculateDynamicRatings(undefined, service, { replaceSnapshots: false })
  let processedMatches = 0
  if (pendingMatchCount) {
    const { data: processed, error: processedError } = await service
      .from('tennisrecord_canonical_matches')
      .update({ rating_processed_at: now.toISOString() })
      .not('canonical_match_id', 'is', null)
      .is('rating_processed_at', null)
      .lte('reconciled_at', ratingWatermark)
      .select('fingerprint')
    if (processedError) throw new Error(processedError.message)
    processedMatches = processed?.length || pendingMatchCount
  }
  await recordTennisRecordRatingRefreshCompletion(service, now)

  return { status: 'completed', pendingMatches: pendingMatchCount, processedMatches }
}

/** Queue one protected full pass when profile evidence changes an NTRP base. */
async function requestTennisRecordRatingRefresh(service: SupabaseClient, reason: string) {
  const { error } = await service
    .from('tennisrecord_collector_settings')
    .update({ rating_recalculation_requested_at: new Date().toISOString(), rating_recalculation_reason: reason })
    .eq('id', true)
  if (error) throw new Error(`Could not queue TiQ rating refresh: ${error.message}`)
}

async function recordTennisRecordRatingRefreshCompletion(service: SupabaseClient, completedAt = new Date()) {
  const { error } = await service
    .from('tennisrecord_collector_settings')
    .update({
      rating_recalculation_requested_at: null,
      rating_recalculation_reason: null,
      rating_recalculated_at: completedAt.toISOString(),
    })
    .eq('id', true)
  if (error) throw new Error(`Could not record TiQ rating refresh completion: ${error.message}`)
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

type ParserReplaySummary = Pick<TennisRecordRunSummary, 'pagesProcessed' | 'playersDiscovered' | 'teamsDiscovered' | 'matchesStaged' | 'parserFailures'> & { sourceMatchKeys: string[]; sourcePlayerKeys: string[]; baselineChanged: boolean }

async function reparseCapturedTennisRecordMatchPages(service: SupabaseClient, runId: string, campaignId?: string | null, campaignSlug?: string): Promise<ParserReplaySummary> {
  const summary: ParserReplaySummary = { pagesProcessed: 0, playersDiscovered: 0, teamsDiscovered: 0, matchesStaged: 0, parserFailures: 0, sourceMatchKeys: [], sourcePlayerKeys: [], baselineChanged: false }
  const { data: pages, error } = await service
    .from('tennisrecord_source_pages')
    .select('id,source_url,raw_html,raw_html_storage_path')
    .eq('blocked', false)
    .lt('parser_revision', TENNISRECORD_PARSER_REVISION)
    .or('raw_html.not.is.null,raw_html_storage_path.not.is.null')
    .order('last_seen_at', { ascending: false })
    .limit(SCHEDULED_TENNISRECORD_REPLAY_BATCH_LIMIT)
  if (error) throw new Error(error.message)

  for (const page of pages || []) {
    const sourceUrl = page.source_url as string
    let html = page.raw_html as string | null
    if (!html && page.raw_html_storage_path) {
      const storedPage = await service.storage.from(TENNISRECORD_SOURCE_PAGE_BUCKET).download(page.raw_html_storage_path as string)
      if (storedPage.error) throw new Error(storedPage.error.message)
      html = await storedPage.data.text()
    }
    if (!html) continue
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
      const staged = await stageParsedPage(service, parsed, sourceUrl, page.id as string, campaignId, campaignSlug, TENNISRECORD_PARSER_REVISION)
      summary.sourceMatchKeys.push(...staged.sourceMatchKeys)
      summary.sourcePlayerKeys.push(...staged.sourcePlayerKeys)
      summary.baselineChanged = summary.baselineChanged || staged.baselineChanged
      summary.pagesProcessed += 1
      summary.playersDiscovered += parsed.players.length
      summary.teamsDiscovered += parsed.teams.length
      summary.matchesStaged += parsed.matches.length
      summary.parserFailures += parsed.matches.filter(match => !match.winnerSide).length
    }

    const sourceUpdate = await service.from('tennisrecord_source_pages').update({ parser_revision: TENNISRECORD_PARSER_REVISION, sync_run_id: runId, last_seen_at: now }).eq('id', page.id)
    if (sourceUpdate.error) throw new Error(sourceUpdate.error.message)
  }
  return summary
}

async function stageParsedPage(service: SupabaseClient, parsed: ReturnType<typeof parseTennisRecordMatchPage>, sourceUrl: string, pageId?: string, campaignId?: string | null, campaignSlug?: string, parserRevision = TENNISRECORD_PARSER_REVISION) {
  let savedSourceMatchKeys: string[] = []
  const sourcePlayerKeys = [...new Set(parsed.players.map((player) => player.sourcePlayerKey).filter(Boolean))]
  let baselineChanged = false
  if (parsed.players.length) {
    const sourcePlayerKeys = parsed.players.map((player) => player.sourcePlayerKey)
    const prior = await service.from('tennisrecord_staged_players').select('source_player_key,ntrp_label,published_rating,source_url').in('source_player_key', sourcePlayerKeys)
    if (prior.error) throw new Error(prior.error.message)
    const priorByKey = new Map((prior.data || []).map((player) => [player.source_player_key as string, player]))
    const rows = parsed.players.map((player) => {
      const previous = priorByKey.get(player.sourcePlayerKey)
      const statedNtrp = tennisRecordStatedNtrpBaseline(player.ntrpLabel)
      const ntrpLabel = preserveTennisRecordStatedNtrpLabel(player.ntrpLabel, previous?.ntrp_label)
      const isDirectProfile = tennisRecordRecordPageKind(player.sourceUrl) === 'player'
      return {
        source_player_key: player.sourcePlayerKey,
        name: player.name,
        normalized_name: normalizedTennisRecordPlayerName(player),
        city: player.city || null,
        state: player.state || null,
        ntrp_label: ntrpLabel,
        published_rating: player.publishedRating ?? previous?.published_rating ?? null,
        // A match page can establish the source player key, but the linked
        // public profile is stronger provenance for the same exact key. Keep
        // it even before its stated level is fetched so replay can enqueue it.
        source_url: statedNtrp === null && !isDirectProfile ? previous?.source_url || player.sourceUrl : player.sourceUrl,
        raw: player,
        last_seen_at: new Date().toISOString(),
      }
    })
    const { data: staged, error } = await service.from('tennisrecord_staged_players').upsert(rows, { onConflict: 'source_player_key' }).select('id,source_player_key,name,normalized_name,city,state,ntrp_label')
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
        const created = await service.from('players').upsert(provisional.map((player) => {
          const baseline = tennisRecordStatedNtrpBaseline(player.ntrp_label)
          const designation = tennisRecordStatedNtrpDesignation(player.ntrp_label)
          return {
            name: player.name,
            normalized_name: player.normalized_name,
            location: [player.city, player.state].filter(Boolean).join(', ') || null,
            rating_source: ratingSourceFromStatedNtrp(baseline, designation),
            ...(baseline === null ? {} : {
              singles_rating: baseline,
              doubles_rating: baseline,
              overall_rating: baseline,
              singles_dynamic_rating: baseline,
              doubles_dynamic_rating: baseline,
              overall_dynamic_rating: baseline,
            }),
            external_source: 'tennisrecord',
            external_source_key: player.source_player_key,
            is_external_provisional: true,
          }
        }), { onConflict: 'external_source,external_source_key' }).select('id,external_source_key')
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
      const mapped = await service.from('tennisrecord_player_identities').select('staged_player_id,canonical_player_id').in('staged_player_id', staged.map((player) => player.id)).not('canonical_player_id', 'is', null)
      if (mapped.error) throw new Error(mapped.error.message)
      const stagedIdBySourceKey = new Map(staged.map((player) => [player.source_player_key as string, player.id as string]))
      const canonicalIdByStagedId = new Map((mapped.data || []).map((identity) => [identity.staged_player_id as string, identity.canonical_player_id as string]))
      const ntrpObservations = parsed.players.flatMap((player) => {
        const ntrp = tennisRecordStatedNtrpBaseline(player.ntrpLabel)
        const stagedPlayerId = stagedIdBySourceKey.get(player.sourcePlayerKey)
        if (ntrp === null || !stagedPlayerId) return []
        const effectiveDate = player.ntrpEffectiveDate || null
        return [{
          observation_key: `tennisrecord:${player.sourcePlayerKey}:${ntrp}:${effectiveDate || 'undated'}`,
          staged_player_id: stagedPlayerId,
          canonical_player_id: canonicalIdByStagedId.get(stagedPlayerId) || null,
          ntrp,
          ntrp_label: player.ntrpLabel,
          designation: tennisRecordStatedNtrpDesignation(player.ntrpLabel),
          effective_date: effectiveDate,
          observed_at: new Date().toISOString(),
          source_url: player.sourceUrl,
          source_page_id: pageId || null,
          last_seen_at: new Date().toISOString(),
        }]
      })
      if (ntrpObservations.length) {
        const { error: observationError } = await service
          .from('tennisrecord_ntrp_observations')
          .upsert(ntrpObservations, { onConflict: 'observation_key' })
        if (observationError) throw new Error(observationError.message)
      }
      const ntrpByStagedId = new Map(staged.map((player) => [player.id as string, {
        baseline: tennisRecordStatedNtrpBaseline(player.ntrp_label),
        designation: tennisRecordStatedNtrpDesignation(player.ntrp_label),
      }]))
      const baselineByCanonicalId = new Map((mapped.data || []).flatMap((identity) => {
        const ntrp = ntrpByStagedId.get(identity.staged_player_id as string)
        return ntrp?.baseline === null || ntrp?.baseline === undefined || !identity.canonical_player_id ? [] : [[identity.canonical_player_id as string, ntrp] as const]
      }))
      if (baselineByCanonicalId.size) {
        const canonicalIds = [...baselineByCanonicalId.keys()]
        const current = await service.from('players').select('id,rating_source,external_source,is_external_provisional,overall_rating,singles_rating,doubles_rating,overall_dynamic_rating,singles_dynamic_rating,doubles_dynamic_rating,overall_usta_dynamic_rating,singles_usta_dynamic_rating,doubles_usta_dynamic_rating').in('id', canonicalIds)
        if (current.error) throw new Error(current.error.message)
        for (const player of current.data || []) {
          const ntrp = baselineByCanonicalId.get(player.id as string)
          const isUntouchedProvisional = player.external_source === 'tennisrecord'
            && player.is_external_provisional === true
            && (player.rating_source === 'self' || player.rating_source === 'unknown')
            && [player.overall_rating, player.singles_rating, player.doubles_rating].every((rating) => rating === null || Number(rating) === 3.5)
          if (!ntrp || ntrp.baseline === null || ntrp.baseline === undefined || !isUntouchedProvisional) continue
          const update = {
            rating_source: ratingSourceFromStatedNtrp(ntrp.baseline, ntrp.designation),
            singles_rating: ntrp.baseline,
            doubles_rating: ntrp.baseline,
            overall_rating: ntrp.baseline,
            ...(ntrp.designation === 'computer' ? {
              singles_dynamic_rating: floorFreshComputerRatedDynamic(player.singles_dynamic_rating, ntrp.baseline),
              doubles_dynamic_rating: floorFreshComputerRatedDynamic(player.doubles_dynamic_rating, ntrp.baseline),
              overall_dynamic_rating: floorFreshComputerRatedDynamic(player.overall_dynamic_rating, ntrp.baseline),
              singles_usta_dynamic_rating: floorFreshComputerRatedDynamic(player.singles_usta_dynamic_rating, ntrp.baseline),
              doubles_usta_dynamic_rating: floorFreshComputerRatedDynamic(player.doubles_usta_dynamic_rating, ntrp.baseline),
              overall_usta_dynamic_rating: floorFreshComputerRatedDynamic(player.overall_usta_dynamic_rating, ntrp.baseline),
            } : {}),
          }
          const updated = await service
            .from('players')
            .update(update)
            .eq('id', player.id)
            .in('rating_source', ['self', 'unknown'])
          if (updated.error) throw new Error(updated.error.message)
          baselineChanged = true
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
    const rows = parsed.matches.map((match) => ({ source_match_key: match.sourceMatchKey, source_url: match.sourceUrl, page_id: pageId || null, played_on: match.playedOn || null, league_name: match.leagueName || null, flight: match.flight || null, home_team: match.homeTeam || null, away_team: match.awayTeam || null, discipline: match.discipline, court_number: match.courtNumber, score_text: match.scoreText || null, winner_side: match.winnerSide, participants: match.participants, fingerprint: canonicalTennisRecordFingerprint(match), raw: match, parser_revision: parserRevision, parse_status: match.winnerSide ? 'valid' : 'quarantined', parse_failure_reason: match.winnerSide ? '' : 'Winner indicator is missing or conflicting. Review the retained source scorecard.', last_seen_at: now }))
    const { data: saved, error } = await service.from('tennisrecord_staged_matches').upsert(rows, { onConflict: 'source_match_key' }).select('id,fingerprint,source_match_key,source_url,score_text,winner_side,participants')
    if (error) throw new Error(error.message)
    const valid = (saved || []).filter(match => match.winner_side === 'A' || match.winner_side === 'B')
    if (valid.length) {
      savedSourceMatchKeys = valid.map((match) => match.source_match_key as string)
      const observationRows = valid.map((match) => ({ fingerprint: match.fingerprint, source: 'tennisrecord', source_priority: sourcePriority('tennisrecord'), source_record_id: match.source_match_key, source_url: match.source_url, staged_match_id: match.id, score_text: match.score_text, winner_side: match.winner_side, participants: match.participants, raw: { stagedMatchId: match.id }, confidence: 0.55, captured_at: now, last_seen_at: now }))
      const observation = await service.from('tennisrecord_match_observations').upsert(observationRows, { onConflict: 'fingerprint,source,source_record_id' })
      if (observation.error) throw new Error(observation.error.message)
    }
  }
  const scopedDiscoveryUrls = parsed.discoveredUrls.filter((candidateUrl) => isTennisRecordCampaignDiscoveryAllowed(campaignSlug, sourceUrl, candidateUrl))
  if (scopedDiscoveryUrls.length) await enqueueTennisRecordUrls(service, scopedDiscoveryUrls, campaignId)
  return { sourceMatchKeys: savedSourceMatchKeys, sourcePlayerKeys, baselineChanged }
}

/**
 * Match pages do not always expose an individual C/S label. For untouched
 * TennisRecord-created profiles, retain that distinction as unknown while
 * allowing sustained, current standard-Adult play to replace the artificial
 * 3.5 provisional baseline. This never touches local, reviewed, or explicitly
 * designated profiles, and it deliberately excludes Mixed and Tri-Level play.
 */
async function applyInferredAdultFlightBaselines(service: SupabaseClient, sourcePlayerKeys: string[]) {
  const uniqueSourcePlayerKeys = [...new Set(sourcePlayerKeys.filter(Boolean))]
  if (!uniqueSourcePlayerKeys.length) return false

  const stagedResult = await service
    .from('tennisrecord_staged_players')
    .select('id,source_player_key')
    .in('source_player_key', uniqueSourcePlayerKeys)
  if (stagedResult.error || !stagedResult.data?.length) {
    if (stagedResult.error) throw new Error(stagedResult.error.message)
    return false
  }

  const stagedIds = stagedResult.data.map((player) => player.id as string)
  const identitiesResult = await service
    .from('tennisrecord_player_identities')
    .select('staged_player_id,canonical_player_id,status')
    .in('staged_player_id', stagedIds)
    .eq('status', 'matched')
    .not('canonical_player_id', 'is', null)
  if (identitiesResult.error || !identitiesResult.data?.length) {
    if (identitiesResult.error) throw new Error(identitiesResult.error.message)
    return false
  }

  const playerIds = [...new Set(identitiesResult.data.map((identity) => identity.canonical_player_id as string).filter(Boolean))]
  const [playersResult, statedResult, playerMatchesResult] = await Promise.all([
    service
      .from('players')
      .select('id,rating_source,external_source,is_external_provisional,overall_rating,singles_rating,doubles_rating')
      .in('id', playerIds)
      .eq('external_source', 'tennisrecord')
      .eq('is_external_provisional', true)
      .in('rating_source', ['self', 'unknown']),
    service
      .from('tennisrecord_ntrp_observations')
      .select('canonical_player_id')
      .in('canonical_player_id', playerIds),
    service
      .from('match_players')
      .select('player_id,match_id')
      .in('player_id', playerIds),
  ])
  if (playersResult.error || statedResult.error || playerMatchesResult.error) {
    throw new Error(playersResult.error?.message || statedResult.error?.message || playerMatchesResult.error?.message || 'Could not load current USTA flight evidence.')
  }

  const statedPlayerIds = new Set((statedResult.data || []).map((row) => row.canonical_player_id as string).filter(Boolean))
  const eligiblePlayers = (playersResult.data || []).filter((player) => !statedPlayerIds.has(player.id as string))
  if (!eligiblePlayers.length) return false

  const eligiblePlayerIds = new Set(eligiblePlayers.map((player) => player.id as string))
  const playerMatches = (playerMatchesResult.data || []).filter((row) => eligiblePlayerIds.has(row.player_id as string))
  const matchIds = [...new Set(playerMatches.map((row) => row.match_id as string).filter(Boolean))]
  if (!matchIds.length) return false

  const matches: Array<{ id: string; match_date: string; league_name: string | null; flight: string | null; match_source: string | null; rating_eligible: boolean | null }> = []
  for (const chunk of chunkArray(matchIds, 500)) {
    const result = await service
      .from('matches')
      .select('id,match_date,league_name,flight,match_source,rating_eligible')
      .in('id', chunk)
      .eq('status', 'completed')
    if (result.error) throw new Error(result.error.message)
    matches.push(...(result.data || []) as typeof matches)
  }
  const matchById = new Map(matches.map((match) => [match.id, match]))
  const evidenceByPlayerId = new Map<string, TennisRecordAdultFlightEvidence[]>()
  for (const link of playerMatches) {
    const match = matchById.get(link.match_id as string)
    if (!match) continue
    const evidence = evidenceByPlayerId.get(link.player_id as string) || []
    evidence.push({
      matchDate: match.match_date,
      leagueName: match.league_name,
      flight: match.flight,
      matchSource: match.match_source,
      ratingEligible: match.rating_eligible,
    })
    evidenceByPlayerId.set(link.player_id as string, evidence)
  }

  let changed = false
  for (const player of eligiblePlayers) {
    const baseline = inferCurrentAdultFlightBaseline(evidenceByPlayerId.get(player.id as string) || [])
    if (!baseline) continue
    const update = await service
      .from('players')
      .update({
        rating_source: 'inferred',
        singles_rating: baseline.ntrp,
        doubles_rating: baseline.ntrp,
        overall_rating: baseline.ntrp,
      })
      .eq('id', player.id)
      .in('rating_source', ['self', 'unknown'])
    if (update.error) throw new Error(update.error.message)
    changed = true
  }
  return changed
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
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

async function reconcileTennisRecordMatches(service: SupabaseClient, sourceMatchKeys: string[], shouldRecalculateRatings = true) {
  const uniqueSourceMatchKeys = [...new Set(sourceMatchKeys.filter(Boolean))]
  if (!uniqueSourceMatchKeys.length) return { created: 0, duplicates: 0, conflicts: 0, ratingChanged: false }
  const { data: staged, error } = await service.from('tennisrecord_staged_matches').select('id,source_match_key,source_url,fingerprint,played_on,league_name,flight,home_team,away_team,discipline,court_number,score_text,winner_side,participants').eq('parse_status', 'valid').in('source_match_key', uniqueSourceMatchKeys)
  if (error) throw new Error(error.message)
  let created = 0; let duplicates = 0; let conflicts = 0
  let ratingChanged = false
  for (const item of staged || []) {
    const existingCanonical = await service.from('tennisrecord_canonical_matches').select('fingerprint,canonical_match_id').eq('fingerprint', item.fingerprint).maybeSingle()
    if (existingCanonical.error) throw new Error(existingCanonical.error.message)
    const identities = await resolveMatchedParticipants(service, item.participants)
    let existing: ProductionMatch | null = null
    if (identities) {
      const lookup = await findExistingProductionMatch(service, { ...item, known_canonical_match_id: existingCanonical.data?.canonical_match_id }, identities)
      if (lookup.kind === 'review') {
        const held = await service.from('tennisrecord_staged_matches').update({ parse_status: 'quarantined', parse_failure_reason: `Possible existing match with different or ambiguous court context. Review before importing. Candidates: ${lookup.candidateIds.join(', ')}` }).eq('id', item.id)
        if (held.error) throw new Error(held.error.message)
        conflicts += 1
        continue
      }
      existing = lookup.kind === 'match' ? lookup.match : null
      if (existing?.source === 'tennisrecord') {
        // Never let an older parser result become a higher-priority local
        // observation. A newer replay of the same public source is permitted
        // to correct this lower-authority canonical record only.
        const priorObservations = await service
          .from('tennisrecord_match_observations')
          .select('id,source,source_record_id,raw')
          .eq('fingerprint', item.fingerprint)
          .eq('source', 'tenaceiq')
          .eq('source_record_id', existing.id)
        if (priorObservations.error) throw new Error(priorObservations.error.message)
        const staleIds = (priorObservations.data || []).filter(o => isSyntheticTennisRecordObservation(o, existing!)).map(o => o.id)
        if (staleIds.length) {
          const removed = await service.from('tennisrecord_match_observations').delete().in('id', staleIds)
          if (removed.error) throw new Error(removed.error.message)
        }
      } else if (existing) {
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
    const { data: observations, error: observationsError } = await service.from('tennisrecord_match_observations').select('id,source,source_priority,canonical_match_id,score_text,winner_side,participants,last_seen_at').eq('fingerprint', item.fingerprint).order('source_priority', { ascending: false }).order('last_seen_at', { ascending: false })
    if (observationsError) throw new Error(observationsError.message)
    if (!observations?.length) continue
    const winner = observations[0]
    const conflicting = observations.slice(1).filter((value) => value.score_text !== winner.score_text || value.winner_side !== winner.winner_side || JSON.stringify(value.participants) !== JSON.stringify(winner.participants))
    const canonicalMatchId = winner.canonical_match_id || existingCanonical.data?.canonical_match_id || existing?.id || null
    const correction = existing && existing.id === canonicalMatchId ? tennisRecordResultCorrection(existing, winner) : null
    // Queue before changing the winner. A failed/interrupted write must not
    // leave corrected evidence marked as already reflected in TiQ ratings.
    const result = await service.from('tennisrecord_canonical_matches').upsert({ fingerprint: item.fingerprint, winning_observation_id: winner.id, canonical_match_id: canonicalMatchId, winning_source: winner.source, has_conflict: conflicting.length > 0, conflict_count: conflicting.length, reconciled_at: new Date().toISOString(), ...(correction ? { rating_processed_at: null } : {}) }, { onConflict: 'fingerprint' })
    if (result.error) throw new Error(result.error.message)
    if (correction && existing) {
      let update = service.from('matches').update(correction).eq('id', existing.id).eq('source', 'tennisrecord')
      update = existing.score === null ? update.is('score', null) : update.eq('score', existing.score)
      update = existing.winner_side === null ? update.is('winner_side', null) : update.eq('winner_side', existing.winner_side)
      const repaired = await update.select('id')
      if (repaired.error || repaired.data?.length !== 1) throw new Error(repaired.error?.message || 'Match changed during source reconciliation; retry from fresh evidence.')
      ratingChanged = true
    }
    if (existingCanonical.data) duplicates += 1; else created += 1
    conflicts += conflicting.length
    if (!canonicalMatchId && winner.source === 'tennisrecord' && identities && item.winner_side) {
      const promoted = await promoteTennisRecordMatch(service, item, identities)
      if (promoted) {
        ratingChanged = true
        await service.from('tennisrecord_canonical_matches').update({
          canonical_match_id: promoted,
          promoted_at: new Date().toISOString(),
          // Scheduled checkpoints are intentionally light. Leave this null
          // until the controlled batch has run the existing TiQ engine.
          rating_processed_at: shouldRecalculateRatings ? new Date().toISOString() : null,
        }).eq('fingerprint', item.fingerprint)
      }
    }
  }
  if (shouldRecalculateRatings && ratingChanged) await recalculateDynamicRatings(undefined, service)
  return { created, duplicates, conflicts, ratingChanged }
}

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
  // Distinct source identities can still map to the same canonical player.
  // Never promote someone onto both sides or into two seats of one court.
  if (new Set(resolved.map(p => p.playerId)).size !== resolved.length ||
    new Set(resolved.map(p => `${p.side}:${p.seat}`)).size !== resolved.length) return null
  return resolved
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
