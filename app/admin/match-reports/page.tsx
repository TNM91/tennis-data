'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import {
  getIssueTypeLabel,
  getReportStatusLabel,
  getUploaderTrustLabel,
  listMatchAccuracyReportsForAdmin,
  reviewMatchAccuracyReport,
  type DataAssistUploaderTrustMap,
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
  const [uploaderTrusts, setUploaderTrusts] = useState<DataAssistUploaderTrustMap>({})
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
  const selectedUploaderTrust = selectedReport?.sourceUploaderUserId
    ? uploaderTrusts[selectedReport.sourceUploaderUserId] || null
    : null

  const selectedUploaderReports = useMemo(() => {
    if (!selectedReport?.sourceUploaderUserId) return []
    return reports.filter((report) => report.sourceUploaderUserId === selectedReport.sourceUploaderUserId)
  }, [reports, selectedReport?.sourceUploaderUserId])

  const selectedUploaderStats = useMemo(() => {
    return {
      total: selectedUploaderReports.length,
      open: selectedUploaderReports.filter((report) => report.status === 'pending' || report.status === 'reviewing').length,
      resolved: selectedUploaderReports.filter((report) => report.status === 'resolved').length,
      rejected: selectedUploaderReports.filter((report) => report.status === 'rejected').length,
    }
  }, [selectedUploaderReports])

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
  const resolutionNeedsSummary = statusDraft === 'resolved' || statusDraft === 'rejected'
  const actionSummaryReady = actionSummary.trim().length >= 8
  const saveDisabled = saving || (resolutionNeedsSummary && !actionSummaryReady)
  const correctionSearch = selectedReport
    ? selectedReport.externalMatchId || selectedReport.matchId || getSnapshotSearchSeed(selectedReport.matchSnapshot)
    : ''
  const matchCorrectionHref = `/admin/manage-matches?search=${encodeURIComponent(correctionSearch)}`
  const sourceReviewHref = selectedReport?.sourceBatchId
    ? `/admin/data-assist?batch=${encodeURIComponent(selectedReport.sourceBatchId)}${selectedReport.sourceDraftId ? `&draft=${encodeURIComponent(selectedReport.sourceDraftId)}` : ''}`
    : ''

  async function refreshReports(nextSelectedId = selectedId) {
    setLoading(true)
    setError('')
    try {
      const result = await listMatchAccuracyReportsForAdmin()
      setReports(result.reports)
      setUploaderTrusts(result.uploaderTrusts)
      setSelectedId(nextSelectedId || result.reports[0]?.id || '')
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
    if (resolutionNeedsSummary && !actionSummaryReady) {
      setError('Add an action summary before resolving or rejecting this report. Players see this in My Lab.')
      return
    }
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

              <section style={correctionPathStyle}>
                <div>
                  <div className="section-kicker">Correction path</div>
                  <h3 className="section-title" style={{ marginTop: 6, fontSize: '1.15rem' }}>
                    Jump to the source before closing the report
                  </h3>
                  <p style={{ color: 'var(--shell-copy-muted)', lineHeight: 1.6, margin: '8px 0 0' }}>
                    Use the match ledger to fix or remove the stored row. If this came from Data Assist, open the exact upload batch and draft that introduced it.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link href={matchCorrectionHref} className="button-primary" style={{ textDecoration: 'none' }}>
                    Open match editor
                  </Link>
                  {sourceReviewHref ? (
                    <Link href={sourceReviewHref} className="button-secondary" style={{ textDecoration: 'none' }}>
                      Open source upload
                    </Link>
                  ) : (
                    <span className="badge badge-slate">No Data Assist source linked</span>
                  )}
                </div>
              </section>

              <section style={uploaderContextStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div className="section-kicker">Uploader trust</div>
                    <h3 className="section-title" style={{ marginTop: 6, fontSize: '1.15rem' }}>
                      {selectedReport.sourceUploaderUserId
                        ? selectedUploaderTrust
                          ? getUploaderTrustLabel(selectedUploaderTrust)
                          : 'Scorecard uploads enabled'
                        : 'No uploader linked'}
                    </h3>
                  </div>
                  {selectedReport.sourceUploaderUserId ? (
                    <span className={selectedUploaderTrust?.canUploadScorecards === false ? 'badge badge-slate' : 'badge badge-green'}>
                      {selectedUploaderTrust?.canUploadScorecards === false ? 'Uploads paused' : 'Uploads enabled'}
                    </span>
                  ) : null}
                </div>
                {selectedReport.sourceUploaderUserId ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 110px), 1fr))', gap: 10, marginTop: 12 }}>
                      <Fact label="Uploader reports" value={String(selectedUploaderStats.total)} />
                      <Fact label="Open" value={String(selectedUploaderStats.open)} />
                      <Fact label="Resolved" value={String(selectedUploaderStats.resolved)} />
                      <Fact label="Rejected" value={String(selectedUploaderStats.rejected)} />
                    </div>
                    {selectedUploaderTrust?.uploadSuspensionReason ? (
                      <p style={{ color: 'var(--shell-copy-muted)', lineHeight: 1.6, margin: '12px 0 0' }}>
                        {selectedUploaderTrust.uploadSuspensionReason}
                      </p>
                    ) : null}
                    {selectedUploaderReports.length > 1 ? (
                      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                        {selectedUploaderReports
                          .filter((report) => report.id !== selectedReport.id)
                          .slice(0, 3)
                          .map((report) => (
                            <button
                              key={report.id}
                              type="button"
                              onClick={() => setSelectedId(report.id)}
                              style={relatedReportButtonStyle}
                            >
                              <span>{getIssueTypeLabel(report.issueType)}</span>
                              <span className="badge badge-blue">{getReportStatusLabel(report.status)}</span>
                            </button>
                          ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p style={{ color: 'var(--shell-copy-muted)', lineHeight: 1.6, margin: '10px 0 0' }}>
                    This report is not tied to a Data Assist scorecard uploader yet. Use the match snapshot to trace the source manually.
                  </p>
                )}
              </section>

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
              {resolutionNeedsSummary && !actionSummaryReady ? (
                <p style={{ color: 'var(--shell-copy-muted)', fontSize: 13, lineHeight: 1.5, margin: '-8px 0 0' }}>
                  Add at least 8 characters before resolving or rejecting. Players see this in My Lab.
                </p>
              ) : null}

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
                <button type="button" className="button-primary" onClick={() => void saveReport()} disabled={saveDisabled}>
                  {saving ? 'Saving...' : 'Save review'}
                </button>
                {selectedReport.sourceUploaderUserId ? (
                  <>
                    <button type="button" className="button-secondary" onClick={() => void saveReport(false)} disabled={saveDisabled}>
                      Pause uploader scorecards
                    </button>
                    <button type="button" className="button-secondary" onClick={() => void saveReport(true)} disabled={saveDisabled}>
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

function getSnapshotSearchSeed(snapshot: Record<string, unknown>) {
  const externalMatchId = cleanSnapshotText(snapshot.external_match_id)
  if (externalMatchId) return externalMatchId
  return [
    cleanSnapshotText(snapshot.match_date),
    cleanSnapshotText(snapshot.home_team),
    cleanSnapshotText(snapshot.away_team),
  ].filter(Boolean).join(' ')
}

function cleanSnapshotText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

const correctionPathStyle = {
  display: 'grid',
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-chip-bg) 93%)',
}

const uploaderContextStyle = {
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  borderRadius: 16,
  padding: 14,
}

const relatedReportButtonStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  color: 'var(--foreground-strong)',
  borderRadius: 12,
  padding: '9px 10px',
  cursor: 'pointer',
  fontWeight: 800,
  textAlign: 'left' as const,
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
