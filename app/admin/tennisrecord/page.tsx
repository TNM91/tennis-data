'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { AdminReviewFrame, AdminReviewHero } from '@/app/admin/_components/admin-review-ui'
import { supabase } from '@/lib/supabase'

type Status = {
  settings: { enabled?: boolean; bootstrap_region?: string } | null
  lastRun: Record<string, unknown> | null
  pendingPages: number
  conflicts: number
}

export default function TennisRecordAdminPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [seedUrl, setSeedUrl] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

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
      setMessage(body.action === 'run' ? 'Manual sync finished. Review the run counts below.' : 'Collector settings saved.')
      if (body.action === 'enqueue') setSeedUrl('')
      if ('settings' in result) setStatus(result)
      await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'TennisRecord operation failed.') }
    finally { setBusy(false) }
  }

  const run = status?.lastRun || {}
  return (
    <SiteShell active="/admin"><AdminGate><AdminReviewFrame>
      <AdminReviewHero kicker="Source ingestion" title="TennisRecord backfill" actions={<button className="button-primary" disabled={busy} onClick={() => void act({ action: 'run' })}>Run small sync</button>}>
        Seed reviewed St. Louis / Missouri results without replacing verified local scorecards.
      </AdminReviewHero>
      <section className="surface-card" style={{ marginTop: 20, padding: 20 }}>
        <div className="metric-grid">
          <Metric label="Collector" value={status?.settings?.enabled ? 'Enabled' : 'Disabled'} />
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
          <input aria-label="Public TennisRecord seed URL" value={seedUrl} onChange={(event) => setSeedUrl(event.target.value)} placeholder="Public TennisRecord match URL" style={{ minWidth: 280, flex: '1 1 280px' }} />
          <button className="button-secondary" disabled={busy || !seedUrl.trim()} onClick={() => void act({ action: 'enqueue', urls: [seedUrl] })}>Queue page</button>
        </div>
        {message ? <p role="status" className="subtle-text" style={{ marginTop: 14 }}>{message}</p> : null}
      </section>
    </AdminReviewFrame></AdminGate></SiteShell>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="metric-card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>
}
