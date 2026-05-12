'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import {
  getIssueTypeLabel,
  getReportStatusLabel,
  listMatchAccuracyReportsForAdmin,
  reviewMatchAccuracyReport,
  type MatchAccuracyReport,
  type MatchAccuracyReportStatus,
} from '@/lib/match-accuracy-reports'

type ReportFilter = 'open' | 'all' | MatchAccuracyReportStatus

const filterLabels: Record<ReportFilter, string> = {
  open: 'Open',
  all: 'All',
  pending: 'Pending',
  reviewing: 'Reviewing',
  resolved: 'Resolved',
  rejected: 'Rejected',
}

export default function AdminMatchReportsPage() {
  return (
    <SiteShell active="/admin">
      <AdminGate>
        <MatchReportQueue />
      </AdminGate>
    </SiteShell>
  )
}

function MatchReportQueue() {
  const [reports, setReports] = useState<MatchAccuracyReport[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [filter, setFilter] = useState<ReportFilter>('open')
  const [statusDraft, setStatusDraft] = useState<MatchAccuracyReportStatus>('reviewing')
  const [adminNotes, setAdminNotes] = useState('')
  const [actionSummary, setActionSummary] = useState('')
  const [suspensionReason, setSuspensionReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedReport = reports.find((report) => report.id === selectedId) || reports[0] || null

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (filter === 'all') return true
      if (filter === 'open') return report.status === 'pending' || report.status === 'reviewing'
      return report.status === filter
    })
  }, [filter, reports])

  const stats = useMemo(() => {
    return {
      pending: reports.filter((report) => report.status === 'pending').length,
      reviewing: reports.filter((report) => report.status === 'reviewing').length,
      resolved: reports.filter((report) => report.status === 'resolved').length,
      uploaderLinked: reports.filter((report) => report.sourceUploaderUserId).length,
    }
  }, [reports])

  async function refreshReports(nextSelectedId = selectedId) {
    setLoading(true)
    setError('')
    try {
      const nextReports = await listMatchAccuracyReportsForAdmin()
      setReports(nextReports)
      setSelectedId(nextSelectedId || nextReports[0]?.id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load match accuracy reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedReport) return
    setStatusDraft(selectedReport.status === 'pending' ? 'reviewing' : selectedReport.status)
    setAdminNotes(selectedReport.adminNotes)
    setActionSummary(selectedReport.actionSummary)
    setSuspensionReason('')
  }, [selectedReport])

  async function saveReport(uploaderCanUploadScorecards?: boolean) {
    if (!selectedReport) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await reviewMatchAccuracyReport({
        reportId: selectedReport.id,
        status: statusDraft,
        adminNotes,
        actionSummary,
        uploaderCanUploadScorecards,
        uploadSuspensionReason: suspensionReason || 'Scorecard uploads paused after repeated match accuracy reports.',
      })
      setMessage(
        uploaderCanUploadScorecards === false
          ? 'Report updated and uploader scorecard uploads paused.'
          : uploaderCanUploadScorecards === true
            ? 'Report updated and uploader scorecard uploads restored.'
            : 'Report updated.',
      )
      await refreshReports(updated.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this match report.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section style={{ width: '100%', maxWidth: 1280, margin: '0 auto', padding: '18px 24px 36px' }}>
      <div className="hero-panel" style={{ padding: 24, borderRadius: 22 }}>
        <div className="section-kicker">Match Accuracy Reports</div>
        <h1 className="page-title" style={{ marginTop: 8 }}>Player-reported data issues</h1>
        <p className="page-subtitle" style={{ maxWidth: 860 }}>
          Review matches players flag as inaccurate, action the correction path, and pause scorecard uploads for linked contributors when reports show a trust pattern.
        </p>
      </div>

      <div className="metric-grid" style={{ marginTop: 18 }}>
        <QueueMetric label="Pending" value={stats.pending} />
        <QueueMetric label="Reviewing" value={stats.reviewing} />
        <QueueMetric label="Resolved" value={stats.resolved} />
        <QueueMetric label="Uploader linked" value={stats.uploaderLinked} />
      </div>

      {message ? <StatusPanel tone="success" text={message} /> : null}
      {error ? <StatusPanel tone="error" text={error} /> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
          gap: 18,
          marginTop: 18,
          alignItems: 'start',
        }}
      >
        <section className="surface-card" style={{ padding: 18, minHeight: 520 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="section-kicker">Queue</div>
              <h2 className="section-title" style={{ marginTop: 6, fontSize: '1.4rem' }}>Action items</h2>
            </div>
            <button type="button" className="button-secondary" onClick={() => void refreshReports()} disabled={loading}>
              Refresh
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {(Object.keys(filterLabels) as ReportFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={filter === item ? 'button-primary' : 'button-secondary'}
                style={{ minHeight: 34, padding: '7px 11px', fontSize: 12 }}
              >
                {filterLabels[item]}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {loading ? (
              <EmptyState text="Loading match reports..." />
            ) : filteredReports.length ? (
              filteredReports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setSelectedId(report.id)}
                  style={{
                    textAlign: 'left',
                    borderRadius: 16,
                    border: report.id === selectedReport?.id ? '1px solid var(--brand-green)' : '1px solid var(--shell-panel-border)',
                    background: report.id === selectedReport?.id ? 'var(--shell-chip-bg-strong)' : 'var(--shell-chip-bg)',
                    color: 'var(--foreground)',
                    padding: 14,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--foreground-strong)' }}>{getIssueTypeLabel(report.issueType)}</strong>
                    <span className="badge badge-blue">{getReportStatusLabel(report.status)}</span>
                  </div>
                  <div style={{ color: 'var(--shell-copy-muted)', fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
                    {report.description}
                  </div>
                  <div style={{ color: 'var(--shell-copy-muted)', fontSize: 12, marginTop: 8 }}>
                    Match {report.externalMatchId || report.matchId || 'unknown'} {report.sourceUploaderUserId ? '- uploader linked' : '- no uploader link'}
                  </div>
                </button>
              ))
            ) : (
              <EmptyState text="No match reports in this view." />
            )}
          </div>
        </section>

        <section className="surface-card" style={{ padding: 18, minHeight: 520 }}>
          {selectedReport ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div className="section-kicker">Review</div>
                <h2 className="section-title" style={{ marginTop: 6, fontSize: '1.4rem' }}>
                  {getIssueTypeLabel(selectedReport.issueType)}
                </h2>
                <p className="page-subtitle" style={{ marginTop: 8 }}>{selectedReport.description}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
                <Fact label="Match" value={selectedReport.externalMatchId || selectedReport.matchId} />
                <Fact label="Reporter" value={selectedReport.reporterPlayerName || selectedReport.reporterUserId.slice(0, 8)} />
                <Fact label="Uploader" value={selectedReport.sourceUploaderUserId ? selectedReport.sourceUploaderUserId.slice(0, 8) : 'Not linked'} />
              </div>

              <details style={{ color: 'var(--shell-copy-muted)' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--foreground-strong)', fontWeight: 800 }}>Match snapshot</summary>
                <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 10, fontSize: 12 }}>
                  {JSON.stringify(selectedReport.matchSnapshot, null, 2)}
                </pre>
              </details>

              <label style={fieldLabelStyle} htmlFor="report-status">Status</label>
              <select
                id="report-status"
                value={statusDraft}
                onChange={(event) => setStatusDraft(event.target.value as MatchAccuracyReportStatus)}
                style={selectStyle}
              >
                <option value="pending">Pending</option>
                <option value="reviewing">Reviewing</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>

              <label style={fieldLabelStyle} htmlFor="admin-notes">Admin notes</label>
              <textarea
                id="admin-notes"
                value={adminNotes}
                onChange={(event) => setAdminNotes(event.target.value)}
                rows={4}
                style={textAreaStyle}
                placeholder="What did you inspect?"
              />

              <label style={fieldLabelStyle} htmlFor="action-summary">Action summary</label>
              <textarea
                id="action-summary"
                value={actionSummary}
                onChange={(event) => setActionSummary(event.target.value)}
                rows={3}
                style={textAreaStyle}
                placeholder="What changed, or why was it rejected?"
              />

              {selectedReport.sourceUploaderUserId ? (
                <>
                  <label style={fieldLabelStyle} htmlFor="suspension-reason">Uploader trust note</label>
                  <textarea
                    id="suspension-reason"
                    value={suspensionReason}
                    onChange={(event) => setSuspensionReason(event.target.value)}
                    rows={3}
                    style={textAreaStyle}
                    placeholder="Reason shown internally when scorecard upload access is paused."
                  />
                </>
              ) : null}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="button-primary" onClick={() => void saveReport()} disabled={saving}>
                  {saving ? 'Saving...' : 'Save review'}
                </button>
                {selectedReport.sourceUploaderUserId ? (
                  <>
                    <button type="button" className="button-secondary" onClick={() => void saveReport(false)} disabled={saving}>
                      Pause uploader scorecards
                    </button>
                    <button type="button" className="button-secondary" onClick={() => void saveReport(true)} disabled={saving}>
                      Restore uploader scorecards
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <EmptyState text="Select a report to review." />
          )}
        </section>
      </div>
    </section>
  )
}

function QueueMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', borderRadius: 14, padding: 12 }}>
      <div style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: 'var(--foreground-strong)', fontWeight: 900, marginTop: 5, overflowWrap: 'anywhere' }}>{value || '-'}</div>
    </div>
  )
}

function StatusPanel({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  return (
    <div
      style={{
        marginTop: 16,
        borderRadius: 16,
        padding: '12px 14px',
        border: tone === 'success' ? '1px solid rgba(155,225,29,0.24)' : '1px solid rgba(248,113,113,0.24)',
        background: tone === 'success' ? 'rgba(155,225,29,0.10)' : 'rgba(239,68,68,0.10)',
        color: 'var(--foreground-strong)',
        fontWeight: 800,
      }}
    >
      {text}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', borderRadius: 16, padding: 16, color: 'var(--shell-copy-muted)', lineHeight: 1.6 }}>
      {text}
    </div>
  )
}

const fieldLabelStyle = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
}

const selectStyle = {
  width: '100%',
  minHeight: 44,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '0 12px',
  colorScheme: 'normal' as const,
}

const textAreaStyle = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: 12,
  lineHeight: 1.55,
  resize: 'vertical' as const,
  colorScheme: 'normal' as const,
}
