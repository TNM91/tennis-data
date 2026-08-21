'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { AdminReviewFrame, AdminReviewHero } from '@/app/admin/_components/admin-review-ui'
import { supabase } from '@/lib/supabase'

type Status = {
  settings: { enabled?: boolean; bootstrap_region?: string; automation_state?: 'manual' | 'bootstrap' | 'weekly'; active_campaign_id?: string | null; max_requests_per_run?: number } | null
  lastRun: Record<string, unknown> | null
  pendingPages: number
  campaignProgress: { pending: number; completed: number; running: number; blocked: number; errors: number }
  conflicts: number
  identityReview: Array<{ staged_player_id: string; status: string; confidence: number; tennisrecord_staged_players: { name: string; city: string | null; state: string | null; ntrp_label: string | null; source_url: string } | null }>
  campaigns: Array<{ id: string; name: string; region_label: string; starts_on: string; ends_on: string; status: string; seed_provenance: string }>
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
  useEffect(() => { void refresh() }, [refresh])

  async function act(body: Record<string, unknown>) {
    setBusy(true); setMessage('')
    try {
      const result = await request(body)
      setMessage(body.action === 'run' ? 'Manual sync finished. Review the run counts below.' : body.action === 'resolve_identity' ? 'Verified player mapping saved.' : 'Collector settings saved.')
      if (body.action === 'enqueue') setSeedUrl('')
      if ('settings' in result) setStatus(result)
      await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'TennisRecord operation failed.') }
    finally { setBusy(false) }
  }

  const run = status?.lastRun || {}
  const automationState = status?.settings?.automation_state || 'manual'
  const activeCampaign = status?.campaigns?.find((campaign) => campaign.id === status?.settings?.active_campaign_id)
  const automationButtonLabel = automationState === 'bootstrap' ? 'Pause regional automation' : automationState === 'weekly' ? 'Pause scheduled sync' : 'Start regional automation'
  const nextAutomationState = automationState === 'manual' ? 'bootstrap' : 'manual'
  const progress = status?.campaignProgress
  const knownPages = progress ? progress.pending + progress.completed + progress.running + progress.blocked + progress.errors : 0
  const settledPages = progress ? progress.completed + progress.blocked + progress.errors : 0
  const progressPercent = knownPages > 0 ? Math.min(100, Math.round((settledPages / knownPages) * 100)) : automationState === 'weekly' ? 100 : 0
  const checkpointLimit = Math.max(1, status?.settings?.max_requests_per_run || 8)
  const checkpointsRemaining = progress ? Math.ceil((progress.pending + progress.running) / checkpointLimit) : 0
  const estimatedMinutesRemaining = checkpointsRemaining * 15
  const estimatedRemaining = automationState === 'weekly' && !progress?.pending && !progress?.running
    ? 'Weekly refresh ready'
    : estimatedMinutesRemaining < 60
      ? `About ${estimatedMinutesRemaining} min remaining`
      : `About ${Math.ceil(estimatedMinutesRemaining / 60)} hr remaining`
  return (
    <SiteShell active="/admin"><AdminGate><AdminReviewFrame>
      <AdminReviewHero kicker="Source ingestion" title="TennisRecord backfill" actions={<button className="button-primary" disabled={busy} onClick={() => void act({ action: 'run' })}>Run one page now</button>}>
        Seed reviewed St. Louis / Missouri results without replacing verified local scorecards. Regional automation safely resumes from its checkpoint until the approved queue is clear.
      </AdminReviewHero>
      <section className="surface-card" style={{ marginTop: 20, padding: 20 }}>
        <section aria-label="Historical import progress" style={{ display: 'grid', gap: 10, padding: 16, borderRadius: 18, border: '1px solid rgba(155,225,29,0.28)', background: 'linear-gradient(135deg, rgba(155,225,29,0.12), rgba(116,190,255,0.08))', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <div>
              <div style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Historical import</div>
              <strong style={{ color: 'var(--foreground-strong)', fontSize: 22 }}>{automationState === 'bootstrap' ? 'Importing match history' : automationState === 'weekly' ? 'Weekly refresh' : 'Import paused'}</strong>
            </div>
            <strong style={{ color: '#d9f84a', fontSize: 28 }}>{progressPercent}%</strong>
          </div>
          <div aria-label={`${progressPercent}% of the known import queue processed`} style={{ height: 10, overflow: 'hidden', borderRadius: 999, background: 'rgba(6,19,36,0.72)' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', borderRadius: 'inherit', background: 'linear-gradient(90deg, #9be11d, #74beff)', transition: 'width 280ms ease' }} />
          </div>
          <div className="subtle-text" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span>{settledPages.toLocaleString()} of {knownPages.toLocaleString()} known pages processed</span>
            <strong>{estimatedRemaining}</strong>
          </div>
          {automationState === 'bootstrap' ? <div className="subtle-text">Estimate uses the active 8-page checkpoint. Newly discovered public match pages can extend the queue.</div> : null}
        </section>
        <div className="metric-grid">
          <Metric label="Collector" value={status?.settings?.enabled ? 'Enabled' : 'Disabled'} />
          <Metric label="Automation" value={automationState === 'bootstrap' ? 'Regional seed' : automationState === 'weekly' ? 'Weekly sync' : 'Paused'} />
          <Metric label="Historical campaign" value={activeCampaign?.region_label || 'Not selected'} />
          <Metric label="Pending pages" value={status?.pendingPages ?? '—'} />
          <Metric label="Conflicts" value={status?.conflicts ?? '—'} />
          <Metric label="Last status" value={String(run.status || 'Never')} />
          <Metric label="Pages attempted" value={String(run.pages_attempted ?? '—')} />
          <Metric label="Teams discovered" value={String(run.teams_discovered ?? '—')} />
          <Metric label="Staged matches" value={String(run.matches_staged ?? '—')} />
          <Metric label="Promoted matches" value={String(run.canonical_matches_created ?? '—')} />
          <Metric label="Blocked requests" value={String(run.blocked_requests ?? '—')} />
          <Metric label="Parser failures" value={String(run.parser_failures ?? '—')} />
        </div>
        <p className="subtle-text" style={{ marginTop: 16 }}>The collector remains off until both this switch and the production environment safety flag are enabled. Blocked pages stop at the source; no access controls are bypassed.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button className="button-secondary" disabled={busy} onClick={() => void act({ action: 'set_enabled', enabled: !status?.settings?.enabled })}>{status?.settings?.enabled ? 'Disable collector' : 'Enable collector'}</button>
          <button className="button-secondary" disabled={busy || !status?.settings?.enabled} onClick={() => void act({ action: 'set_automation_state', automationState: nextAutomationState })}>{automationButtonLabel}</button>
          {automationState === 'manual' ? <button className="button-secondary" disabled={busy || !status?.settings?.enabled} onClick={() => void act({ action: 'set_automation_state', automationState: 'weekly' })}>Enable weekly sync</button> : null}
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
