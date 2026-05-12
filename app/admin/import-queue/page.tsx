'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AdminActionRow,
  AdminEmptyState,
  AdminReviewFrame,
  AdminReviewHero,
  AdminReviewPanel,
  AdminStatusPanel,
  adminReviewHeaderRowStyle,
  adminSubPanelStyle,
} from '@/app/admin/_components/admin-review-ui'
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
        <AdminReviewFrame>
          <AdminReviewHero kicker="Upload review" title="Upload Review Queue">
            Captured uploads land here only when they cannot safely become trusted data without admin confirmation.
            Open an item in the admin import center to review, fix, and commit through the fallback workflow.
          </AdminReviewHero>

          <AdminReviewPanel style={{ marginTop: 18 }}>
            <div style={adminReviewHeaderRowStyle}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['pending', 'processed', 'rejected'] as QueueStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className="button-ghost"
                    style={{
                      borderColor: statusFilter === status ? 'rgba(155,225,29,0.34)' : 'var(--shell-panel-border)',
                      background: statusFilter === status ? 'rgba(155,225,29,0.16)' : 'var(--shell-chip-bg)',
                      color: statusFilter === status ? 'var(--foreground-strong)' : 'var(--foreground)',
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => void loadRows()} className="button-ghost" disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {actionMessage ? (
              <AdminStatusPanel tone="success" text={actionMessage} />
            ) : null}

            {error ? (
              <AdminStatusPanel tone="error" text={error} />
            ) : null}

            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              {loading ? (
                <AdminEmptyState text="Loading queue..." />
              ) : filteredRows.length === 0 ? (
                <AdminEmptyState text={`No ${statusFilter} import queue items.`} />
              ) : (
                filteredRows.map((row) => (
                  <article
                    key={row.id}
                    style={adminSubPanelStyle}
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

                    <div style={{ marginTop: 12, color: 'var(--foreground-strong)', fontWeight: 800 }}>
                      {row.reason || 'No reason recorded.'}
                    </div>

                    <AdminActionRow>
                      <button type="button" className="button-primary" onClick={() => void openInImportReview(row)}>
                        Open in review
                      </button>
                      {row.status !== 'processed' ? (
                        <button type="button" className="button-ghost" onClick={() => void updateStatus(row, 'processed')}>
                          Mark processed
                        </button>
                      ) : null}
                      {row.status !== 'rejected' ? (
                        <button type="button" className="button-ghost" onClick={() => void updateStatus(row, 'rejected')}>
                          Reject
                        </button>
                      ) : null}
                    </AdminActionRow>
                  </article>
                ))
              )}
            </div>
          </AdminReviewPanel>
        </AdminReviewFrame>
      </AdminGate>
    </SiteShell>
  )
}
