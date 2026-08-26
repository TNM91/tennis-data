'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { AdminReviewFrame, AdminReviewHero } from '@/app/admin/_components/admin-review-ui'
import { supabase } from '@/lib/supabase'

type Status = {
  settings: { enabled?: boolean; bootstrap_region?: string; automation_state?: 'manual' | 'bootstrap' | 'weekly'; active_campaign_id?: string | null; max_requests_per_run?: number; bootstrap_started_at?: string | null; bootstrap_completed_at?: string | null; weekly_refresh_started_at?: string | null } | null
  lastRun: Record<string, unknown> | null
  automationCadenceMinutes: number
  safetyThrottle: { active: boolean; reason: string | null; resumesAt: string | null }
  pipelineHealth: { state: 'healthy' | 'attention' | 'cooling_down' | 'paused'; message: string; lastSuccessfulCollectorAt: string | null }
  pendingPages: number
  campaignProgress: { pending: number; completed: number; running: number; blocked: number; errors: number }
  campaignForecast: { pagesPerCheckpoint: number; checkpointsRemaining: number; estimatedMinutesRemaining: number; checkpointMinutes: number; paceSampleCount: number; paceSource: 'recent_completed_checkpoints' | 'scheduled_cadence'; estimateBasis: 'known_queue' }
  nextCampaign: { id: string; name: string; region_label: string; starts_on: string; ends_on: string; status: string } | null
  weeklyProgress: { startedAt: string | null; pending: number; completed: number; running: number; blocked: number; errors: number }
  weeklyForecast: { pagesPerCheckpoint: number; checkpointsRemaining: number; estimatedMinutesRemaining: number; checkpointMinutes: number; paceSampleCount: number; paceSource: 'recent_completed_checkpoints' | 'scheduled_cadence'; estimateBasis: 'known_queue' }
  ratingProgress: { pending: number; baselineRefreshPending: boolean; baselineRefreshRequestedAt: string | null; lastRecalculatedAt: string | null; cadence: 'overnight' | 'Wednesday' | 'paused' }
  ratingEvidence: { observations: number; computerRated: number; selfRated: number; datedObservations: number; playersWithMultipleYears: number; paired2025To2026: number }
  ratingAlignment: { verifiedPlayers: number; atOrNearBaseline: number; buildingAboveBaseline: number; belowBaseline: number; materiallyBelowBaseline: number }
  coverage: { staged_player_count: number; filterable_team_count: number; filterable_league_count: number; filterable_flight_count: number; source_roster_listing_count: number; source_team_history_count: number; unpromoted_team_history_count: number; promoted_match_count: number }
  conflicts: number
  identityReview: Array<{ staged_player_id: string; status: string; confidence: number; tennisrecord_staged_players: { name: string; city: string | null; state: string | null; ntrp_label: string | null; source_url: string } | null }>
  campaigns: Array<{ id: string; name: string; region_label: string; starts_on: string; ends_on: string; status: string; seed_provenance: string; availableSeedPages: number }>
  frontier: { status: 'seeded' | 'ready_to_seed' | 'needs_admin_seed' }
}

export default function TennisRecordAdminPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [seedUrl, setSeedUrl] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [mappingIds, setMappingIds] = useState<Record<string, string>>({})

  const request = useCallback(async (body?: Record<string, unknown>) => {
    const session = await supabase.auth.getSession()
    const response = await fetch('/api/admin/tennisrecord', {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(session.data.session?.access_token ? { Authorization: `Bearer ${session.data.session.access_token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const payload = await response.json() as { ok?: boolean; message?: string } & Status
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'TennisRecord operation failed.')
    return payload
  }, [])

  const refresh = useCallback(async () => {
    try { setStatus(await request()) } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load collector status.') }
  }, [request])
  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  async function act(body: Record<string, unknown>) {
    setBusy(true); setMessage('')
    try {
      const result = await request(body)
      setMessage(body.action === 'run' ? 'Manual sync finished. Review the run counts below.' : body.action === 'seed_frontier' ? 'Missouri public history pages are queued. Regional automation will continue from this checkpoint.' : body.action === 'resolve_identity' ? 'Verified player mapping saved.' : 'Collector settings saved.')
      if (body.action === 'enqueue') setSeedUrl('')
      if ('settings' in result) setStatus(result)
      await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'TennisRecord operation failed.') }
    finally { setBusy(false) }
  }

  const run = status?.lastRun || {}
  const automationState = status?.settings?.automation_state || 'manual'
  const activeCampaign = status?.campaigns?.find((campaign) => campaign.id === status?.settings?.active_campaign_id)
  const progress = status?.campaignProgress
  const knownPages = progress ? progress.pending + progress.completed + progress.running + progress.blocked + progress.errors : 0
  const settledPages = progress ? progress.completed + progress.blocked + progress.errors : 0
  const progressPercent = knownPages > 0 ? Math.min(100, Math.round((settledPages / knownPages) * 100)) : 0
  const checkpointLimit = Math.max(1, status?.settings?.max_requests_per_run || 8)
  const checkpointIntervalMinutes = Math.max(1, status?.automationCadenceMinutes || 5)
  const safetyThrottle = status?.safetyThrottle
  const campaignForecast = status?.campaignForecast
  const weeklyForecast = status?.weeklyForecast
  const checkpointsRemaining = campaignForecast?.checkpointsRemaining ?? (progress ? Math.ceil((progress.pending + progress.running) / checkpointLimit) : 0)
  const estimatedMinutesRemaining = campaignForecast?.estimatedMinutesRemaining ?? checkpointsRemaining * checkpointIntervalMinutes
  const campaignCheckpointMinutes = campaignForecast?.checkpointMinutes ?? checkpointIntervalMinutes
  const campaignPaceDetail = campaignForecast?.paceSource === 'recent_completed_checkpoints'
    ? `recent completed checkpoint pace (${campaignForecast.paceSampleCount} samples)`
    : 'scheduled checkpoint cadence while live pace builds'
  const estimatedRemaining = status?.frontier.status === 'ready_to_seed'
    ? 'Ready to seed'
    : status?.frontier.status === 'needs_admin_seed'
      ? 'Needs approved seed pages'
    : automationState === 'bootstrap' && checkpointsRemaining === 0
    ? 'Finalizing this import'
    : estimatedMinutesRemaining < 60
      ? `About ${estimatedMinutesRemaining} min remaining`
      : `About ${Math.ceil(estimatedMinutesRemaining / 60)} hr remaining`
  const weekly = status?.weeklyProgress
  const weeklyKnownPages = weekly ? weekly.pending + weekly.completed + weekly.running + weekly.blocked + weekly.errors : 0
  const weeklySettledPages = weekly ? weekly.completed + weekly.blocked + weekly.errors : 0
  const weeklyPercent = weeklyKnownPages > 0 ? Math.min(100, Math.round((weeklySettledPages / weeklyKnownPages) * 100)) : 0
  const weeklyCheckpointsRemaining = weeklyForecast?.checkpointsRemaining ?? (weekly ? Math.ceil((weekly.pending + weekly.running) / checkpointLimit) : 0)
  const weeklyEstimatedMinutes = weeklyForecast?.estimatedMinutesRemaining ?? weeklyCheckpointsRemaining * checkpointIntervalMinutes
  const weeklyEstimatedRemaining = automationState !== 'weekly'
    ? 'Starts after historical import'
    : !weekly?.startedAt
      ? 'Waiting for the next refresh'
      : weeklyCheckpointsRemaining === 0
        ? 'Refresh complete'
        : weeklyEstimatedMinutes < 60
          ? `About ${weeklyEstimatedMinutes} min remaining`
          : `About ${Math.ceil(weeklyEstimatedMinutes / 60)} hr remaining`
  const ratingProgress = status?.ratingProgress
  const ratingEvidence = status?.ratingEvidence
  const ratingAlignment = status?.ratingAlignment
  const pipelineHealth = status?.pipelineHealth
  const ratingCadence = ratingProgress?.cadence === 'overnight'
    ? 'Overnight catch-up'
    : ratingProgress?.cadence === 'Wednesday'
      ? 'Wednesday refresh'
      : 'Paused'
  return (
    <SiteShell active="/admin"><AdminGate><AdminReviewFrame>
      <AdminReviewHero kicker="Source ingestion" title="TennisRecord backfill">
        Historical collection runs automatically in small, resumable checkpoints. After the 2025 mission, each Wednesday refreshes the prior seven days without replacing verified local scorecards.
      </AdminReviewHero>
      <section className="surface-card" style={{ marginTop: 20, padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14, marginBottom: 18 }}>
          <ProgressTracker ariaLabel="Historical import progress" label="2025 historical mission" title={status?.frontier.status === 'ready_to_seed' ? 'Missouri history starts automatically' : status?.frontier.status === 'needs_admin_seed' ? 'Needs approved seed pages' : automationState === 'bootstrap' ? `Importing ${activeCampaign?.region_label || '2025 match history'}` : status?.settings?.bootstrap_completed_at ? '2025 history imported' : 'Import paused'} percent={progressPercent} processed={settledPages} total={knownPages} eta={automationState === 'bootstrap' ? estimatedRemaining : status?.settings?.bootstrap_completed_at ? 'Complete' : 'Paused'} detail={status?.frontier.status === 'ready_to_seed' ? `${activeCampaign?.availableSeedPages || 0} public 2025-current Missouri history pages are waiting for the next automatic checkpoint.` : automationState === 'bootstrap' ? `Started ${formatDateTime(status?.settings?.bootstrap_started_at)}. Forecast uses ${campaignPaceDetail}: ${campaignForecast?.pagesPerCheckpoint || checkpointLimit} pages about every ${campaignCheckpointMinutes} minutes; newly discovered public match pages can extend the queue.${safetyThrottle?.active ? ` Safety pause: ${safetyThrottle.reason} Resume after ${formatDateTime(safetyThrottle.resumesAt)}.` : ''}` : 'Historical source records remain auditable without replacing verified local scorecards.'} />
          <ProgressTracker ariaLabel="Weekly refresh progress" label="Weekly seven-day refresh" title={automationState === 'weekly' && weekly?.startedAt ? weeklyCheckpointsRemaining ? 'Refreshing recent tennis activity' : 'Weekly refresh complete' : automationState === 'weekly' ? 'Next refresh: Wednesday' : 'Weekly refresh queued'} percent={weeklyPercent} processed={weeklySettledPages} total={weeklyKnownPages} eta={weeklyEstimatedRemaining} detail={weekly?.startedAt ? `Started ${formatDateTime(weekly.startedAt)}. Forecast uses ${weeklyForecast?.paceSource === 'recent_completed_checkpoints' ? `recent weekly checkpoint pace (${weeklyForecast.paceSampleCount} samples)` : 'the scheduled checkpoint cadence while weekly pace builds'}. This scan refreshes recent match, player, and team context from the prior Wednesday-to-Wednesday window.` : 'After the historical mission, this starts every Wednesday and continues in small checkpoints until the weekly queue is clear.'} />
        </div>
        <section aria-label="TennisRecord campaign path" style={{ display: 'grid', gap: 12, marginBottom: 18, padding: 16, borderRadius: 18, border: '1px solid rgba(116,190,255,0.2)', background: 'rgba(11, 31, 55, 0.42)' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <strong style={{ color: 'var(--foreground-strong)', fontSize: 18 }}>Automatic campaign path</strong>
            <span className="subtle-text">The collector advances only after the active queue is clear; no daily action is required.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 12 }}>
            <CampaignStep label="Now" title={activeCampaign?.region_label || 'Historical campaign'} detail={automationState === 'bootstrap' ? `${status?.pendingPages ?? 0} queued pages · ${checkpointsRemaining} checkpoint${checkpointsRemaining === 1 ? '' : 's'} at about ${campaignCheckpointMinutes} minutes each` : 'Waiting for historical collection'} tone="active" />
            <CampaignStep label="Next" title={status?.nextCampaign?.region_label || 'Weekly refresh'} detail={status?.nextCampaign ? `${status.nextCampaign.name} starts automatically when the active queue clears.` : 'Starts after historical campaigns are complete.'} />
            <CampaignStep label="Then" title="Weekly seven-day refresh" detail="Runs every Wednesday and collects only the prior week’s eligible public activity." />
          </div>
          <span className="subtle-text">Time remaining reflects the currently known queue and {campaignPaceDetail}. The estimate updates automatically as public pages reveal additional eligible matches.</span>
        </section>
        <div className="metric-grid">
          <Metric label="Collector" value={status?.settings?.enabled ? 'Enabled' : 'Disabled'} />
          <Metric label="Automation" value={automationState === 'bootstrap' ? 'Regional seed' : automationState === 'weekly' ? 'Weekly sync' : 'Paused'} />
          <Metric label="Checkpoint pace" value={campaignForecast?.paceSource === 'recent_completed_checkpoints' ? `About ${campaignCheckpointMinutes} min` : `Scheduled ${checkpointIntervalMinutes} min`} />
          <Metric label="Safety throttle" value={safetyThrottle?.active ? 'Cooling down' : 'Clear'} />
          <Metric label="Import health" value={pipelineHealth?.state === 'healthy' ? 'On pace' : pipelineHealth?.state === 'cooling_down' ? 'Safety pause' : pipelineHealth?.state === 'attention' ? 'Needs review' : 'Paused'} />
          <Metric label="Last successful import" value={formatDateTime(pipelineHealth?.lastSuccessfulCollectorAt)} />
          <Metric label="Historical campaign" value={activeCampaign?.region_label || 'Not selected'} />
          <Metric label="Pending pages" value={status?.pendingPages ?? '—'} />
          <Metric label="Conflicts" value={status?.conflicts ?? '—'} />
          <Metric label="Last status" value={String(run.status || 'Never')} />
          <Metric label="Pages attempted" value={String(run.pages_attempted ?? '—')} />
          <Metric label="Teams discovered" value={String(run.teams_discovered ?? '—')} />
          <Metric label="Staged matches" value={String(run.matches_staged ?? '—')} />
          <Metric label="Promoted matches" value={String(run.canonical_matches_created ?? '—')} />
          <Metric label="TiQ ratings waiting" value={ratingProgress ? ratingProgress.pending.toLocaleString() : '—'} />
          <Metric label="Baseline refresh" value={ratingProgress?.baselineRefreshPending ? 'Queued' : 'Current'} />
          <Metric label="Baseline queued at" value={ratingProgress?.baselineRefreshPending ? formatDateTime(ratingProgress.baselineRefreshRequestedAt) : '—'} />
          <Metric label="Last TiQ rating pass" value={formatDateTime(ratingProgress?.lastRecalculatedAt)} />
          <Metric label="Rating refresh" value={ratingCadence} />
          <Metric label="Blocked requests" value={String(run.blocked_requests ?? '—')} />
          <Metric label="Transient retries" value={String(run.transient_retries ?? '—')} />
          <Metric label="Source failures" value={String(run.source_failures ?? '—')} />
          <Metric label="Parser failures" value={String(run.parser_failures ?? '—')} />
        </div>
        <section aria-label="Import health" style={{ marginTop: 20, padding: 16, borderRadius: 18, border: `1px solid ${pipelineHealth?.state === 'attention' ? 'rgba(255,157,114,0.52)' : 'rgba(116,190,255,0.2)'}`, background: pipelineHealth?.state === 'attention' ? 'rgba(98, 38, 24, 0.22)' : 'rgba(11, 31, 55, 0.42)' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <strong style={{ color: 'var(--foreground-strong)', fontSize: 18 }}>{pipelineHealth?.state === 'attention' ? 'Import health needs review' : pipelineHealth?.state === 'cooling_down' ? 'Import health: safety pause' : pipelineHealth?.state === 'paused' ? 'Import health: paused' : 'Import health: on pace'}</strong>
            <span className="subtle-text">{pipelineHealth?.message || 'Loading the latest collector health.'}</span>
            <span className="subtle-text">Last successful checkpoint: {formatDateTime(pipelineHealth?.lastSuccessfulCollectorAt)}. Last TiQ rating pass: {formatDateTime(ratingProgress?.lastRecalculatedAt)}. TiQ ratings are {ratingProgress?.pending ? `${ratingProgress.pending.toLocaleString()} match${ratingProgress.pending === 1 ? '' : 'es'} away from the next protected batch` : ratingProgress?.baselineRefreshPending ? 'queued for the next protected baseline refresh' : 'current with the latest protected batch'}.</span>
          </div>
        </section>
        <section aria-label="TiQ rating catch-up" style={{ marginTop: 20, padding: 16, borderRadius: 18, border: '1px solid rgba(155,225,29,0.28)', background: 'linear-gradient(135deg, rgba(155,225,29,0.1), rgba(116,190,255,0.06))' }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <strong style={{ color: 'var(--foreground-strong)', fontSize: 18 }}>TiQ rating catch-up</strong>
            <span className="subtle-text">{ratingProgress?.pending ? `${ratingProgress.pending.toLocaleString()} canonical match${ratingProgress.pending === 1 ? '' : 'es'} are queued for the existing TiQ rating engine.` : ratingProgress?.baselineRefreshPending ? `A confirmed USTA baseline update was captured ${formatDateTime(ratingProgress.baselineRefreshRequestedAt)} and is queued for the next protected TiQ rating pass.` : 'All currently promoted source matches are reflected in the latest TiQ rating pass.'}</span>
            <span className="subtle-text">{ratingProgress?.cadence === 'overnight' ? 'The historical mission recalculates ratings in a protected overnight batch.' : ratingProgress?.cadence === 'Wednesday' ? 'Weekly source refreshes recalculate ratings in the protected Wednesday batch.' : 'Resume automatic collection to restart scheduled TiQ rating catch-up.'} TennisRecord’s proprietary rating is never used.</span>
          </div>
        </section>
        <section aria-label="TiQ rating evidence" style={{ marginTop: 20, padding: 16, borderRadius: 18, border: '1px solid rgba(116,190,255,0.2)', background: 'rgba(11, 31, 55, 0.42)' }}>
          <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
            <strong style={{ color: 'var(--foreground-strong)', fontSize: 18 }}>TiQ rating evidence</strong>
            <span className="subtle-text">Tracks factual USTA profile designations used to validate TiQ’s annual stay, move-up, and move-down signals. TennisRecord’s estimated rating is never used.</span>
          </div>
          <div className="metric-grid">
            <Metric label="Dated observations" value={ratingEvidence?.datedObservations ?? '—'} />
            <Metric label="Computer-rated anchors" value={ratingEvidence?.computerRated ?? '—'} />
            <Metric label="Self-rated entries" value={ratingEvidence?.selfRated ?? '—'} />
            <Metric label="Players with two years" value={ratingEvidence?.playersWithMultipleYears ?? '—'} />
            <Metric label="2025→2026 pairs" value={ratingEvidence?.paired2025To2026 ?? '—'} />
          </div>
          <p className="subtle-text" style={{ margin: '14px 0 0' }}>{ratingEvidence?.paired2025To2026 ? 'Annual comparison evidence is available for calibration review.' : 'Profile evidence is building automatically. TiQ keeps using its native match-based model until paired annual USTA outcomes can validate a calibration change.'}</p>
        </section>
        <section aria-label="TiQ verified-baseline alignment" style={{ marginTop: 20, padding: 16, borderRadius: 18, border: '1px solid rgba(155,225,29,0.28)', background: 'linear-gradient(135deg, rgba(155,225,29,0.1), rgba(116,190,255,0.06))' }}>
          <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
            <strong style={{ color: 'var(--foreground-strong)', fontSize: 18 }}>TiQ verified-baseline alignment</strong>
            <span className="subtle-text">A live read of the TiQ ratings shown for players with confirmed USTA baselines. TiQ’s match model drives movement; this makes unusual downward movement easy to audit.</span>
          </div>
          <div className="metric-grid">
            <Metric label="Verified players" value={ratingAlignment?.verifiedPlayers ?? '—'} />
            <Metric label="At or near baseline" value={ratingAlignment?.atOrNearBaseline ?? '—'} />
            <Metric label="Building above baseline" value={ratingAlignment?.buildingAboveBaseline ?? '—'} />
            <Metric label="Below baseline" value={ratingAlignment?.belowBaseline ?? '—'} />
            <Metric label="Materially below" value={ratingAlignment?.materiallyBelowBaseline ?? '—'} />
          </div>
          <p className="subtle-text" style={{ margin: '14px 0 0' }}>“Below” means more than 0.06 below the confirmed USTA level. “Materially below” means at least 0.15 below and is a review signal—not an automatic demotion.</p>
        </section>
        <section aria-label="TennisRecord data coverage" style={{ marginTop: 20, padding: 16, borderRadius: 18, border: '1px solid rgba(116,190,255,0.2)', background: 'rgba(11, 31, 55, 0.42)' }}>
          <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
            <strong style={{ color: 'var(--foreground-strong)', fontSize: 18 }}>Collected data coverage</strong>
            <span className="subtle-text">Counts update automatically as source pages are staged, reconciled, and made available to Team, League, and Flight filters.</span>
          </div>
          <div className="metric-grid">
            <Metric label="Filterable teams" value={status?.coverage?.filterable_team_count ?? '—'} />
            <Metric label="Leagues" value={status?.coverage?.filterable_league_count ?? '—'} />
            <Metric label="Flights" value={status?.coverage?.filterable_flight_count ?? '—'} />
            <Metric label="Staged players" value={status?.coverage?.staged_player_count ?? '—'} />
            <Metric label="Source roster listings" value={status?.coverage?.source_roster_listing_count ?? '—'} />
            <Metric label="Team history lines" value={status?.coverage?.source_team_history_count ?? '—'} />
            <Metric label="Awaiting promotion" value={status?.coverage?.unpromoted_team_history_count ?? '—'} />
            <Metric label="Promoted matches" value={status?.coverage?.promoted_match_count ?? '—'} />
          </div>
        </section>
        <p className="subtle-text" style={{ marginTop: 16 }}>Automatic collection stays on after deployment. Use the pause control only to stop source requests temporarily; blocked pages stop at the source and no access controls are bypassed.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button className="button-secondary" disabled={busy} onClick={() => void act({ action: 'set_enabled', enabled: !status?.settings?.enabled })}>{status?.settings?.enabled ? 'Pause automatic collection' : 'Resume automatic collection'}</button>
          <select aria-label="Active historical campaign" value={status?.settings?.active_campaign_id || ''} disabled={busy || !status?.campaigns?.length} onChange={(event) => void act({ action: 'set_active_campaign', campaignId: event.target.value })}>
            <option value="">Choose campaign</option>
            {status?.campaigns?.filter((campaign) => campaign.status !== 'completed').map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} · {campaign.starts_on} to {campaign.ends_on}</option>)}
          </select>
          <input aria-label="Public TennisRecord seed URL" value={seedUrl} onChange={(event) => setSeedUrl(event.target.value)} placeholder="Public TennisRecord match URL" style={{ minWidth: 280, flex: '1 1 280px' }} />
          <button className="button-secondary" disabled={busy || !seedUrl.trim()} onClick={() => void act({ action: 'enqueue', urls: [seedUrl] })}>Queue page</button>
        </div>
        {message ? <p role="status" className="subtle-text" style={{ marginTop: 14 }}>{message}</p> : null}
      </section>
      <section className="surface-card" style={{ marginTop: 20, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>Identity review</h2>
        <p className="subtle-text">Only verify a mapping when you have roster, team, season, or match-history evidence. Unmatched source players remain safely staged.</p>
        {status?.identityReview?.length ? <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          {status.identityReview.map((identity) => {
            const player = identity.tennisrecord_staged_players
            return <div key={identity.staged_player_id} className="metric-card" style={{ display: 'grid', gap: 8 }}>
              <div><strong>{player?.name || 'Unknown player'}</strong>{player?.city || player?.state ? ` · ${[player.city, player.state].filter(Boolean).join(', ')}` : ''}{player?.ntrp_label ? ` · ${player.ntrp_label}` : ''}</div>
              <a className="subtle-text" href={player?.source_url} target="_blank" rel="noreferrer">View source record</a>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input aria-label={`TenAceIQ player ID for ${player?.name || 'staged player'}`} value={mappingIds[identity.staged_player_id] || ''} onChange={(event) => setMappingIds((current) => ({ ...current, [identity.staged_player_id]: event.target.value }))} placeholder="Verified TenAceIQ player ID" style={{ minWidth: 280, flex: '1 1 280px' }} />
                <button className="button-secondary" disabled={busy || !(mappingIds[identity.staged_player_id] || '').trim()} onClick={() => void act({ action: 'resolve_identity', stagedPlayerId: identity.staged_player_id, canonicalPlayerId: mappingIds[identity.staged_player_id] })}>Confirm mapping</button>
              </div>
            </div>
          })}
        </div> : <p className="subtle-text" style={{ marginTop: 12 }}>No identity reviews are waiting.</p>}
      </section>
    </AdminReviewFrame></AdminGate></SiteShell>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="metric-card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>
}

function CampaignStep({ label, title, detail, tone }: { label: string; title: string; detail: string; tone?: 'active' }) {
  return <div className="metric-card" style={{ display: 'grid', gap: 6, borderColor: tone === 'active' ? 'rgba(155,225,29,0.45)' : undefined }}>
    <div className="metric-label" style={{ color: tone === 'active' ? '#d9f84a' : undefined }}>{label}</div>
    <strong style={{ color: 'var(--foreground-strong)' }}>{title}</strong>
    <span className="subtle-text">{detail}</span>
  </div>
}

function ProgressTracker({ ariaLabel, label, title, percent, processed, total, eta, detail }: { ariaLabel: string; label: string; title: string; percent: number; processed: number; total: number; eta: string; detail: string }) {
  return <section aria-label={ariaLabel} style={{ display: 'grid', gap: 10, minWidth: 0, padding: 16, borderRadius: 18, border: '1px solid rgba(155,225,29,0.28)', background: 'linear-gradient(135deg, rgba(155,225,29,0.12), rgba(116,190,255,0.08))' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}><div style={{ minWidth: 0 }}><div style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div><strong style={{ color: 'var(--foreground-strong)', fontSize: 22 }}>{title}</strong></div><strong style={{ color: '#d9f84a', fontSize: 28 }}>{percent}%</strong></div>
    <div aria-label={`${percent}% of this import queue processed`} style={{ height: 10, overflow: 'hidden', borderRadius: 999, background: 'rgba(6,19,36,0.72)' }}><div style={{ width: `${percent}%`, height: '100%', borderRadius: 'inherit', background: 'linear-gradient(90deg, #9be11d, #74beff)', transition: 'width 280ms ease' }} /></div>
    <div className="subtle-text" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><span>{processed.toLocaleString()} of {total.toLocaleString()} known pages processed</span><strong>{eta}</strong></div>
    <div className="subtle-text">{detail}</div>
  </section>
}

function formatDateTime(value?: string | null) {
  if (!value) return 'not yet'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'not yet' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
