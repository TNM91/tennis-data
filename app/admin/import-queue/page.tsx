'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { supabase } from '@/lib/supabase'

type QueueStatus = 'pending' | 'processed' | 'rejected'
type QueuePageType = 'scorecard' | 'season_schedule' | 'team_summary'

type ImportQueueRow = {
  id: string
  page_type: QueuePageType
  payload: unknown
  status: QueueStatus
  reason: string
  created_at: string
}

const pageWrapStyle: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '18px 24px 40px',
}

const panelStyle: CSSProperties = {
  borderRadius: 24,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 18,
}

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  borderRadius: 999,
  padding: '0 14px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontWeight: 800,
  cursor: 'pointer',
}

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  color: '#08111d',
}

function importKindForQueueType(pageType: QueuePageType) {
  return pageType === 'season_schedule' ? 'schedule' : pageType
}

function prettyPageType(pageType: QueuePageType) {
  if (pageType === 'season_schedule') return 'Season schedule'
  if (pageType === 'team_summary') return 'Team summary'
  return 'Scorecard'
}

function statusBadgeClass(status: QueueStatus) {
  if (status === 'processed') return 'badge badge-green'
  if (status === 'rejected') return 'badge'
  return 'badge badge-blue'
}

export default function AdminImportQueuePage() {
  const router = useRouter()
  const [rows, setRows] = useState<ImportQueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<QueueStatus>('pending')
  const [actionMessage, setActionMessage] = useState('')

  const filteredRows = useMemo(
    () => rows.filter((row) => row.status === statusFilter),
    [rows, statusFilter],
  )

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('import_queue')
      .select('id, page_type, payload, status, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (loadError) {
      setError(loadError.message)
      setRows([])
    } else {
      setRows((data ?? []) as ImportQueueRow[])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadRows()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadRows])

  async function updateStatus(row: ImportQueueRow, status: QueueStatus) {
    setActionMessage('')
    const { error: updateError } = await supabase
      .from('import_queue')
      .update({ status })
      .eq('id', row.id)

    if (updateError) {
      setActionMessage(`Queue update failed: ${updateError.message}`)
      return
    }

    setRows((current) => current.map((item) => item.id === row.id ? { ...item, status } : item))
    setActionMessage(`Marked ${prettyPageType(row.page_type).toLowerCase()} item ${status}.`)
  }

  async function openInImportReview(row: ImportQueueRow) {
    const kind = importKindForQueueType(row.page_type)
    await navigator.clipboard.writeText(JSON.stringify(row.payload, null, 2))
    const params = new URLSearchParams({
      kind,
      source: 'import-queue',
      autopaste: '1',
      autopreview: '1',
      focus: row.page_type === 'scorecard' ? 'unresolved' : 'all',
    })

    if (row.page_type === 'scorecard') {
      params.set('autocommit', 'clean_safe')
    }

    router.push(`/admin/import?${params.toString()}`)
  }

  return (
    <SiteShell active="/admin">
      <AdminGate>
        <section style={pageWrapStyle}>
          <section className="hero-panel" style={{ marginBottom: 18 }}>
            <div className="section-kicker">Import review</div>
            <h1 className="page-title">Automated Import Queue</h1>
            <p className="page-subtitle" style={{ maxWidth: 760 }}>
              Payloads land here only when the automated pipeline cannot safely commit them.
              Open an item in the import center to review, fix, and commit through the existing fallback workflow.
            </p>
          </section>

          <section style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['pending', 'processed', 'rejected'] as QueueStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    style={{
                      ...buttonStyle,
                      borderColor: statusFilter === status ? 'rgba(155,225,29,0.34)' : 'var(--shell-panel-border)',
                      color: statusFilter === status ? '#C8F56B' : 'var(--foreground)',
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => void loadRows()} style={buttonStyle} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {actionMessage ? (
              <div className="badge badge-blue" style={{ marginTop: 14, justifyContent: 'flex-start' }}>
                {actionMessage}
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                style={{
                  marginTop: 16,
                  borderRadius: 18,
                  border: '1px solid rgba(248,113,113,0.24)',
                  background: 'rgba(127,29,29,0.18)',
                  color: '#fecaca',
                  padding: '14px 16px',
                  fontWeight: 800,
                }}
              >
                {error}
              </div>
            ) : null}

            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              {loading ? (
                <div className="subtle-text">Loading queue...</div>
              ) : filteredRows.length === 0 ? (
                <div className="subtle-text">No {statusFilter} import queue items.</div>
              ) : (
                filteredRows.map((row) => (
                  <article
                    key={row.id}
                    style={{
                      borderRadius: 20,
                      border: '1px solid var(--shell-panel-border)',
                      background: 'var(--shell-chip-bg)',
                      padding: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ color: 'var(--foreground)', fontWeight: 900, fontSize: '1rem' }}>
                          {prettyPageType(row.page_type)}
                        </div>
                        <div className="subtle-text" style={{ marginTop: 6 }}>
                          {new Date(row.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span className={statusBadgeClass(row.status)}>{row.status}</span>
                        <span className="badge badge-slate">{row.page_type}</span>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, color: '#D8E8FB', fontWeight: 800 }}>
                      {row.reason || 'No reason recorded.'}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                      <button type="button" style={primaryButtonStyle} onClick={() => void openInImportReview(row)}>
                        Open in review
                      </button>
                      {row.status !== 'processed' ? (
                        <button type="button" style={buttonStyle} onClick={() => void updateStatus(row, 'processed')}>
                          Mark processed
                        </button>
                      ) : null}
                      {row.status !== 'rejected' ? (
                        <button type="button" style={buttonStyle} onClick={() => void updateStatus(row, 'rejected')}>
                          Reject
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>
      </AdminGate>
    </SiteShell>
  )
}
