'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { supabase } from '@/lib/supabase'
import {
  mapUpgradeRequestRow,
  UPGRADE_REQUESTS_KEY,
  type UpgradeRequestRecord,
  type UpgradeRequestRow,
  type UpgradeRequestStatus,
} from '@/lib/upgrade-requests'

type StatusFilter = 'all' | 'captain' | 'league' | 'player_plus'
type SetupStatus = {
  upgradeRequestsTable: boolean
  playerPlusEntitlements: boolean
  activationServiceKey: boolean
  messages: Record<string, string>
} | null

export default function AdminUpgradeRequestsPage() {
  const [requests, setRequests] = useState<UpgradeRequestRecord[]>(() => readStoredRequests())
  const [status, setStatus] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [setupStatus, setSetupStatus] = useState<SetupStatus>(null)

  const loadRequests = useCallback(async () => {
    const localRequests = readStoredRequests()

    const { data, error } = await supabase
      .from('upgrade_requests')
      .select('id, plan_id, plan_name, requester_name, requester_email, requester_user_id, organization, goal, next_href, status, source, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      setRequests(localRequests)
      setStatus(localRequests.length ? 'Showing local fallback requests. Supabase request table is not available yet.' : 'No Supabase upgrade request table found yet.')
      return
    }

    const remoteRequests = ((data ?? []) as UpgradeRequestRow[]).map(mapUpgradeRequestRow)
    const remoteIds = new Set(remoteRequests.map((request) => request.id))
    setRequests([...remoteRequests, ...localRequests.filter((request) => !remoteIds.has(request.id))])
    setStatus('')
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRequests()
      void loadSetupStatus()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadRequests])

  const filteredRequests = useMemo(() => {
    if (filter === 'all') return requests
    return requests.filter((request) => request.planId === filter)
  }, [filter, requests])

  const captainCount = requests.filter((request) => request.planId === 'captain').length
  const leagueCount = requests.filter((request) => request.planId === 'league').length
  const playerCount = requests.filter((request) => request.planId === 'player_plus').length
  const localCount = requests.filter((request) => request.source === 'local').length
  const hasSetupIssue = setupStatus
    ? !setupStatus.upgradeRequestsTable ||
      !setupStatus.playerPlusEntitlements ||
      !setupStatus.activationServiceKey
    : false

  async function loadSetupStatus() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) return

    const response = await fetch('/api/upgrade-requests/setup', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    const body = await response.json().catch(() => null) as
      | {
          ok?: boolean
          checks?: {
            upgradeRequestsTable?: boolean
            playerPlusEntitlements?: boolean
            activationServiceKey?: boolean
          }
          messages?: Record<string, string>
        }
      | null

    if (!response.ok || !body?.ok || !body.checks) return

    setSetupStatus({
      upgradeRequestsTable: Boolean(body.checks.upgradeRequestsTable),
      playerPlusEntitlements: Boolean(body.checks.playerPlusEntitlements),
      activationServiceKey: Boolean(body.checks.activationServiceKey),
      messages: body.messages ?? {},
    })
  }

  function clearRequests() {
    window.localStorage.removeItem(UPGRADE_REQUESTS_KEY)
    setRequests((current) => current.filter((request) => request.source !== 'local'))
    setStatus('Fallback request queue cleared.')
  }

  async function updateRequestStatus(request: UpgradeRequestRecord, nextStatus: UpgradeRequestStatus) {
    if (request.source !== 'supabase') {
      setStatus('Local fallback requests cannot be updated in Supabase.')
      return
    }

    const { error } = await supabase
      .from('upgrade_requests')
      .update({ status: nextStatus })
      .eq('id', request.id)

    if (error) {
      setStatus(error.message || 'Could not update request status.')
      return
    }

    setRequests((current) =>
      current.map((item) => item.id === request.id ? { ...item, status: nextStatus } : item),
    )
    setStatus(`Marked ${request.email} as ${nextStatus}.`)
  }

  async function activateRequest(request: UpgradeRequestRecord) {
    if (request.source !== 'supabase') {
      setStatus('Local fallback requests cannot be activated. Ask the requester to submit again after the migration is live.')
      return
    }

    if (!request.userId) {
      setStatus('This request is not linked to an account yet. Ask the requester to sign in or create an account first.')
      return
    }

    setActivatingId(request.id)
    setStatus('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const response = await fetch('/api/upgrade-requests/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          requestId: request.id,
          planId: request.planId,
          userId: request.userId,
        }),
      })
      const body = await response.json().catch(() => null) as { ok?: boolean; message?: string } | null

      if (!response.ok || !body?.ok) {
        throw new Error(body?.message ?? 'Could not activate access.')
      }

      setRequests((current) =>
        current.map((item) => item.id === request.id ? { ...item, status: 'converted' } : item),
      )
      setStatus(body.message ?? `Activated ${request.planName} access for ${request.email}.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not activate access.')
    } finally {
      setActivatingId(null)
    }
  }

  function exportRequests() {
    if (!requests.length) {
      setStatus('No upgrade requests to export.')
      return
    }

    void navigator.clipboard.writeText(JSON.stringify(requests, null, 2))
      .then(() => setStatus('Copied upgrade requests JSON to clipboard.'))
      .catch(() => setStatus('Clipboard export failed.'))
  }

  return (
    <SiteShell active="/admin">
      <AdminGate>
        <main style={pageStyle}>
          <section className="hero-panel" style={heroStyle}>
            <div className="section-kicker">Upgrade requests</div>
            <h1 className="page-title">Plan intent queue</h1>
            <p className="page-subtitle" style={{ maxWidth: 760 }}>
              Review paid-plan requests, follow up with leads, and activate access once an account is linked.
            </p>
            <div style={metricGridStyle}>
              <Metric label="Total requests" value={String(requests.length)} />
              <Metric label="Captain" value={String(captainCount)} />
              <Metric label="League" value={String(leagueCount)} />
              <Metric label="Player" value={String(playerCount)} />
            </div>
          </section>

          <section className="surface-card" style={panelStyle}>
            {hasSetupIssue ? (
              <div style={setupPanelStyle}>
                <div>
                  <div className="section-kicker">Setup needed</div>
                  <h2 style={setupTitleStyle}>Finish the upgrade request backend.</h2>
                  <p style={emptyTextStyle}>
                    Live lead capture and one-click activation need the migrations applied and the service role key configured.
                  </p>
                </div>
                <div style={setupGridStyle}>
                  <SetupCheck
                    label="Upgrade request table"
                    ok={Boolean(setupStatus?.upgradeRequestsTable)}
                    message={setupStatus?.messages.upgradeRequestsTable}
                  />
                  <SetupCheck
                    label="Player entitlement fields"
                    ok={Boolean(setupStatus?.playerPlusEntitlements)}
                    message={setupStatus?.messages.playerPlusEntitlements}
                  />
                  <SetupCheck
                    label="Activation service key"
                    ok={Boolean(setupStatus?.activationServiceKey)}
                    message={setupStatus?.messages.activationServiceKey}
                  />
                </div>
              </div>
            ) : null}

            <div style={toolbarStyle}>
              <div style={filterWrapStyle}>
                {[
                  ['all', 'All'],
                  ['captain', 'Captain'],
                  ['league', 'League'],
                  ['player_plus', 'Player'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value as StatusFilter)}
                    style={filter === value ? activeFilterButtonStyle : filterButtonStyle}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={actionWrapStyle}>
                <button type="button" className="button-secondary" onClick={loadRequests}>
                  Refresh
                </button>
                <button type="button" className="button-secondary" onClick={exportRequests}>
                  Copy JSON
                </button>
                <button
                  type="button"
                  style={{
                    ...dangerButtonStyle,
                    opacity: localCount ? 1 : 0.58,
                    cursor: localCount ? 'pointer' : 'not-allowed',
                  }}
                  onClick={clearRequests}
                  disabled={!localCount}
                >
                  Clear fallback queue
                </button>
              </div>
            </div>

            {status ? <div style={statusStyle}>{status}</div> : null}

            {filteredRequests.length ? (
              <div style={requestGridStyle}>
                {filteredRequests.map((request) => (
                  <article key={request.id} style={requestCardStyle}>
                    <div style={cardTopStyle}>
                      <div style={badgeWrapStyle}>
                        <span className="badge badge-green">{request.planName}</span>
                        <span className="badge badge-slate">{request.status ?? 'pending'}</span>
                        <span className="badge badge-blue">
                          {request.source === 'local' ? 'Fallback' : 'Supabase'}
                        </span>
                      </div>
                      <span style={dateStyle}>{formatRequestDate(request.createdAt)}</span>
                    </div>
                    <h2 style={cardTitleStyle}>{request.name || 'Unnamed request'}</h2>
                    <a href={`mailto:${request.email}`} style={emailStyle}>
                      {request.email}
                    </a>
                    {request.organization ? (
                      <div style={metaLineStyle}>Team or league: {request.organization}</div>
                    ) : null}
                    {request.userId ? (
                      <div style={metaLineStyle}>Account: {request.userId}</div>
                    ) : (
                      <div style={metaLineMutedStyle}>No account linked yet. Ask them to sign in or create one before activation.</div>
                    )}
                    <p style={goalStyle}>{request.goal}</p>
                    <div style={cardActionRowStyle}>
                      <Link href={request.nextHref || '/pricing'} className="button-secondary">
                        Preview destination
                      </Link>
                      <Link
                        href={request.userId ? `/admin/access?search=${encodeURIComponent(request.userId)}` : '/admin/access'}
                        className="button-secondary"
                      >
                        Access control
                      </Link>
                      <a href={buildMailtoHref(request)} className="button-primary">
                        Follow up
                      </a>
                      <button
                        type="button"
                        onClick={() => void activateRequest(request)}
                        disabled={activatingId === request.id || !request.userId || request.source !== 'supabase'}
                        style={{
                          ...activateButtonStyle,
                          opacity: activatingId === request.id || !request.userId || request.source !== 'supabase' ? 0.58 : 1,
                          cursor: activatingId === request.id || !request.userId || request.source !== 'supabase' ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {activatingId === request.id ? 'Activating...' : `Activate ${request.planName}`}
                      </button>
                    </div>
                    <div style={statusActionRowStyle}>
                      {(['pending', 'contacted', 'converted', 'closed'] as UpgradeRequestStatus[]).map((statusOption) => (
                        <button
                          key={statusOption}
                          type="button"
                          onClick={() => void updateRequestStatus(request, statusOption)}
                          style={(request.status ?? 'pending') === statusOption ? activeSmallButtonStyle : smallButtonStyle}
                        >
                          {statusOption}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div style={emptyStyle}>
                <div className="section-kicker">No requests yet</div>
                <h2 style={emptyTitleStyle}>Upgrade interest will appear here.</h2>
                <p style={emptyTextStyle}>
                  Submit a request from a paid upgrade page, then return here to review and activate it.
                </p>
                <Link href="/pricing" className="button-primary">
                  Open pricing
                </Link>
              </div>
            )}
          </section>
        </main>
      </AdminGate>
    </SiteShell>
  )
}

function readStoredRequests() {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(UPGRADE_REQUESTS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isUpgradeRequestRecord) : []
  } catch {
    return []
  }
}

function isUpgradeRequestRecord(value: unknown): value is UpgradeRequestRecord {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<UpgradeRequestRecord>
  return Boolean(candidate.id && candidate.planId && candidate.planName && candidate.email)
}

function formatRequestDate(value: string) {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return `Local ${Math.round(numeric)}`

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Local request'
  return date.toLocaleString()
}

function buildMailtoHref(request: UpgradeRequestRecord) {
  const subject = encodeURIComponent(`TenAceIQ ${request.planName} follow-up`)
  const body = encodeURIComponent(
    [
      `Hi${request.name ? ` ${request.name}` : ''},`,
      '',
      `Thanks for your interest in ${request.planName}. I saw that you want to:`,
      request.goal,
      '',
      'What would be the best next step for your tennis setup?',
    ].join('\n'),
  )

  return `mailto:${request.email}?subject=${subject}&body=${body}`
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  )
}

function SetupCheck({
  label,
  ok,
  message,
}: {
  label: string
  ok: boolean
  message?: string
}) {
  return (
    <div style={setupCheckStyle}>
      <span className={ok ? 'badge badge-green' : 'badge badge-slate'}>
        {ok ? 'Ready' : 'Missing'}
      </span>
      <strong>{label}</strong>
      {message ? <small>{message}</small> : null}
    </div>
  )
}

const pageStyle: CSSProperties = {
  width: 'min(1180px, calc(100% - 32px))',
  margin: '0 auto',
  padding: '18px 0 36px',
  display: 'grid',
  gap: 18,
}

const heroStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const metricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
  marginTop: 8,
}

const panelStyle: CSSProperties = {
  padding: 18,
  display: 'grid',
  gap: 16,
}

const setupPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 16,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-panel-bg) 92%)',
}

const setupTitleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
}

const setupGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 10,
}

const setupCheckStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  alignContent: 'start',
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 850,
}

const toolbarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
}

const filterWrapStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const actionWrapStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const filterButtonStyle: CSSProperties = {
  minHeight: 38,
  padding: '0 13px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  fontWeight: 850,
  cursor: 'pointer',
}

const activeFilterButtonStyle: CSSProperties = {
  ...filterButtonStyle,
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  color: '#04121a',
}

const dangerButtonStyle: CSSProperties = {
  ...filterButtonStyle,
  color: '#fecaca',
  borderColor: 'rgba(248, 113, 113, 0.28)',
}

const statusStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 800,
}

const requestGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: 12,
}

const requestCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 16,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
}

const cardTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'flex-start',
}

const badgeWrapStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
}

const dateStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 800,
}

const cardTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.1,
  fontWeight: 950,
}

const emailStyle: CSSProperties = {
  color: 'var(--brand-blue)',
  fontSize: 14,
  fontWeight: 850,
}

const metaLineStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 13,
  fontWeight: 800,
}

const metaLineMutedStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 750,
}

const goalStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 700,
}

const cardActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 4,
}

const activateButtonStyle: CSSProperties = {
  minHeight: 40,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',
  background: 'color-mix(in srgb, var(--brand-green) 16%, var(--shell-chip-bg) 84%)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 950,
}

const statusActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  paddingTop: 10,
  borderTop: '1px solid var(--shell-panel-border)',
}

const smallButtonStyle: CSSProperties = {
  minHeight: 28,
  padding: '0 9px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 850,
  cursor: 'pointer',
}

const activeSmallButtonStyle: CSSProperties = {
  ...smallButtonStyle,
  background: 'color-mix(in srgb, var(--brand-green) 18%, var(--shell-chip-bg) 82%)',
  borderColor: 'color-mix(in srgb, var(--brand-green) 32%, var(--shell-panel-border) 68%)',
}

const emptyStyle: CSSProperties = {
  display: 'grid',
  justifyItems: 'start',
  gap: 10,
  padding: 24,
  borderRadius: 18,
  border: '1px dashed var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const emptyTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.1,
  fontWeight: 950,
}

const emptyTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.6,
  fontWeight: 750,
}
