'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { AdminReviewFrame, AdminReviewHero } from '@/app/admin/_components/admin-review-ui'
import { supabase } from '@/lib/supabase'

type Status = {
  settings: { enabled?: boolean; bootstrap_region?: string; automation_state?: 'manual' | 'bootstrap' | 'weekly' } | null
  lastRun: Record<string, unknown> | null
  pendingPages: number
  conflicts: number
  identityReview: Array<{ staged_player_id: string; status: string; confidence: number; tennisrecord_staged_players: { name: string; city: string | null; state: string | null; ntrp_label: string | null; source_url: string } | null }>
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
  const automationButtonLabel = automationState === 'bootstrap' ? 'Pause regional automation' : automationState === 'weekly' ? 'Pause scheduled sync' : 'Start regional automation'
  const nextAutomationState = automationState === 'manual' ? 'bootstrap' : 'manual'
  return (
    <SiteShell active="/admin"><AdminGate><AdminReviewFrame>
      <AdminReviewHero kicker="Source ingestion" title="TennisRecord backfill" actions={<button className="button-primary" disabled={busy} onClick={() => void act({ action: 'run' })}>Run one page now</button>}>
        Seed reviewed St. Louis / Missouri results without replacing verified local scorecards. Regional automation safely resumes from its checkpoint until the approved queue is clear.
      </AdminReviewHero>
      <section className="surface-card" style={{ marginTop: 20, padding: 20 }}>
        <div className="metric-grid">
          <Metric label="Collector" value={status?.settings?.enabled ? 'Enabled' : 'Disabled'} />
          <Metric label="Automation" value={automationState === 'bootstrap' ? 'Regional seed' : automationState === 'weekly' ? 'Weekly sync' : 'Paused'} />
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
