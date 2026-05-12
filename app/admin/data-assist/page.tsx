'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AdminEmptyState,
  AdminFact,
  AdminReviewFrame,
  AdminReviewGrid,
  AdminReviewHero,
  AdminReviewPanel,
  AdminStatusPanel,
  adminActionRowStyle,
  adminReviewHeaderRowStyle,
} from '@/app/admin/_components/admin-review-ui'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import {
  getDataAssistImportTypeLabel,
  listDataAssistAdminBatches,
  loadDataAssistAdminBatch,
  loadDataAssistAdminBatchDetail,
  queueDataAssistOcrVerification,
  reviewDataAssistBatch,
  type DataAssistAdminBatch,
  type DataAssistAdminDraft,
  type DataAssistAdminScreenshot,
  type DataAssistBatchStatus,
  type DataAssistOcrJob,
} from '@/lib/data-assist'
import { getDataAssistOcrReadiness, getScorecardDraftReadiness } from '@/lib/data-assist-ocr'

type QueueFilter = 'exceptions' | 'all' | 'needs_review' | 'layout_detected' | 'ready_to_import' | 'verified' | 'imported' | 'rejected'

const filterLabels: Record<QueueFilter, string> = {
  exceptions: 'Exceptions',
  all: 'All',
  needs_review: 'Needs review',
  layout_detected: 'Layout detected',
  ready_to_import: 'Ready',
  verified: 'Verified',
  imported: 'Imported',
  rejected: 'Rejected',
}

export default function AdminDataAssistPage() {
  return (
    <SiteShell active="/admin">
      <AdminGate>
        <DataAssistReviewQueue />
      </AdminGate>
    </SiteShell>
  )
}

function DataAssistReviewQueue() {
  const [batches, setBatches] = useState<DataAssistAdminBatch[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [screenshots, setScreenshots] = useState<DataAssistAdminScreenshot[]>([])
  const [drafts, setDrafts] = useState<DataAssistAdminDraft[]>([])
  const [ocrJobs, setOcrJobs] = useState<DataAssistOcrJob[]>([])
  const [filter, setFilter] = useState<QueueFilter>('exceptions')
  const [requestedDraftId, setRequestedDraftId] = useState('')
  const [deepLinkActive, setDeepLinkActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [savingStatus, setSavingStatus] = useState<DataAssistBatchStatus | ''>('')
  const [queueingOcr, setQueueingOcr] = useState(false)

  const selectedBatch = batches.find((batch) => batch.id === selectedId) ?? null
  const selectedDraft = drafts.find((draft) => draft.id === requestedDraftId) ?? drafts[0] ?? null

  const filteredBatches = useMemo(
    () => batches.filter((batch) => {
      if (filter === 'all') return true
      if (filter === 'exceptions') return batch.status === 'needs_review' || batch.status === 'rejected'
      return batch.status === filter
    }),
    [batches, filter],
  )

  const stats = useMemo(() => {
    const needsReview = batches.filter((batch) => batch.status === 'needs_review').length
    const ready = batches.filter((batch) => batch.status === 'ready_to_import').length
    const rejected = batches.filter((batch) => batch.status === 'rejected').length
    const scorecards = batches.filter((batch) => batch.requestedImportType === 'scorecard').length
    const imported = batches.filter((batch) => batch.status === 'imported').length
    return { needsReview, ready, rejected, scorecards, imported }
  }, [batches])

  async function refreshQueue(nextSelectedId = selectedId) {
    setLoading(true)
    setError('')
    try {
      const nextBatches = await listDataAssistAdminBatches()
      let visibleBatches = nextBatches
      if (nextSelectedId && !nextBatches.some((batch) => batch.id === nextSelectedId)) {
        const linkedBatch = await loadDataAssistAdminBatch(nextSelectedId)
        if (linkedBatch) visibleBatches = [linkedBatch, ...nextBatches]
      }
      setBatches(visibleBatches)
      const nextId = nextSelectedId || nextBatches[0]?.id || ''
      setSelectedId(nextId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Data Assist batches.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      void refreshQueue()
      return
    }

    const params = new URLSearchParams(window.location.search)
    const batchId = params.get('batch')?.trim() || ''
    const draftId = params.get('draft')?.trim() || ''
    setDeepLinkActive(Boolean(batchId || draftId))
    setRequestedDraftId(draftId)
    if (batchId) setFilter('all')
    void refreshQueue(batchId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setScreenshots([])
      setDrafts([])
      setOcrJobs([])
      setReviewNote('')
      return
    }

    setDetailLoading(true)
    setError('')
    void loadDataAssistAdminBatchDetail(selectedId)
      .then((detail) => {
        setScreenshots(detail.screenshots)
        setDrafts(detail.drafts)
        setOcrJobs(detail.ocrJobs)
        const draftNote = detail.drafts[0]?.reviewNote || ''
        const batchNote = batches.find((batch) => batch.id === selectedId)?.reviewNote || ''
        setReviewNote(draftNote || batchNote)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load batch detail.'))
      .finally(() => setDetailLoading(false))
  }, [batches, selectedId])

  async function handleReview(status: Extract<DataAssistBatchStatus, 'needs_review' | 'ready_to_import' | 'rejected'>) {
    if (!selectedBatch) return
    setSavingStatus(status)
    setMessage('')
    setError('')
    try {
      await reviewDataAssistBatch({
        batchId: selectedBatch.id,
        draftId: selectedDraft?.id,
        status,
        reviewNote,
      })
      const label =
        status === 'ready_to_import'
          ? 'marked ready'
          : status === 'rejected'
            ? 'rejected'
            : 'held for review'
      setMessage(`Batch ${label}. Import remains locked until the parsed read is trusted.`)
      await refreshQueue(selectedBatch.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this Data Assist batch.')
    } finally {
      setSavingStatus('')
    }
  }

  async function handleQueueOcr() {
    if (!selectedBatch || !selectedDraft || queueingOcr) return
    setQueueingOcr(true)
    setMessage('')
    setError('')
    try {
      const result = await queueDataAssistOcrVerification({
        batchId: selectedBatch.id,
        draftId: selectedDraft.id,
      })
      setMessage(`OCR scan completed. Job ${result.jobId.slice(0, 8).toUpperCase()} produced an auto-assessed draft.`)
      const detail = await loadDataAssistAdminBatchDetail(selectedBatch.id)
      setScreenshots(detail.screenshots)
      setDrafts(detail.drafts)
      setOcrJobs(detail.ocrJobs)
      await refreshQueue(selectedBatch.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not queue OCR verification.')
    } finally {
      setQueueingOcr(false)
    }
  }

  const ocrReadiness = getDataAssistOcrReadiness()
  const ocrButtonLabel = ocrReadiness.provider === 'tesseract' ? 'Run free OCR' : 'Queue OCR verification'

  return (
    <AdminReviewFrame>
      <AdminReviewHero
        kicker="Data Assist Review"
        title="Data Assist upload queue"
        actions={(
          <>
            <Link href="/data-assist" className="button-secondary" style={{ textDecoration: 'none' }}>
              Open Upload Flow
            </Link>
            {deepLinkActive ? (
              <Link href="/admin/data-assist" className="button-secondary" style={{ textDecoration: 'none' }}>
                Clear deep link
              </Link>
            ) : null}
            <Link href="/admin" className="button-secondary" style={{ textDecoration: 'none' }}>
              Back to Admin
            </Link>
          </>
        )}
      >
        Monitor player, captain, and coordinator TennisLink uploads, resolve exceptions, and keep imports behind trusted review checks.
      </AdminReviewHero>

      <div className="metric-grid" style={{ marginTop: 18 }}>
        <QueueMetric label="Needs review" value={stats.needsReview} />
        <QueueMetric label="Ready" value={stats.ready} />
        <QueueMetric label="Imported" value={stats.imported} />
        <QueueMetric label="Rejected" value={stats.rejected} />
      </div>

      {message ? <AdminStatusPanel tone="success" text={message} /> : null}
      {error ? <AdminStatusPanel tone="error" text={error} /> : null}

      <AdminReviewGrid>
        <AdminReviewPanel>
          <div style={adminReviewHeaderRowStyle}>
            <div>
              <div className="section-kicker">Queue</div>
              <h2 className="section-title" style={{ marginTop: 6, fontSize: '1.4rem' }}>
                Exception queue
              </h2>
            </div>
            <button type="button" className="button-secondary" onClick={() => void refreshQueue()} disabled={loading}>
              Refresh
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {(Object.keys(filterLabels) as QueueFilter[]).map((item) => (
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
              <AdminEmptyState text="Loading Data Assist batches..." />
            ) : filteredBatches.length ? (
              filteredBatches.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => setSelectedId(batch.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 14,
                    borderRadius: 16,
                    border: selectedId === batch.id ? '1px solid rgba(155,225,29,0.42)' : '1px solid var(--shell-panel-border)',
                    background: selectedId === batch.id ? 'rgba(155,225,29,0.09)' : 'var(--shell-panel-bg)',
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontWeight: 900 }}>{getDataAssistImportTypeLabel(batch.requestedImportType)}</span>
                    <StatusBadge status={batch.status} />
                  </div>
                  <div className="subtle-text" style={{ marginTop: 7, fontSize: 13 }}>
                    {batch.screenshotCount} upload file{batch.screenshotCount === 1 ? '' : 's'} - {Math.round(batch.confidenceScore * 100)}% confidence
                  </div>
                  <div className="subtle-text" style={{ marginTop: 6, fontSize: 12 }}>
                    {formatDate(batch.createdAt)}
                  </div>
                </button>
              ))
            ) : (
              <AdminEmptyState text="No batches match this filter yet." />
            )}
          </div>
        </AdminReviewPanel>

        <AdminReviewPanel>
          {!selectedBatch ? (
            <AdminEmptyState text="Select a batch to review its upload files and draft boundary." />
          ) : (
            <div>
              <BatchHeader batch={selectedBatch} />

              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 16,
                  border: '1px solid rgba(251,191,36,0.24)',
                  background: 'rgba(251,191,36,0.08)',
                }}
              >
                <div style={{ color: '#fde68a', fontWeight: 900 }}>Import lock active</div>
                <div className="subtle-text" style={{ marginTop: 6 }}>
                  {ocrReadiness.reason} Queue approval only moves a batch into verification readiness.
                </div>
              </div>

              {detailLoading ? (
                <AdminEmptyState text="Loading upload files and draft detail..." />
              ) : (
                <>
                  <ScorecardBoundary draft={selectedDraft} />
                  <OcrJobPanel draft={selectedDraft} jobs={ocrJobs} />
                  <ScreenshotGrid screenshots={screenshots} />
                  <DraftSummary draft={selectedDraft} />
                </>
              )}

              <div style={{ marginTop: 18 }}>
                <label htmlFor="review-note" style={{ display: 'block', color: 'var(--foreground)', fontWeight: 900, marginBottom: 8 }}>
                  Review note
                </label>
                <textarea
                  id="review-note"
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="Add what needs verification before this can become trusted data."
                  rows={4}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    borderRadius: 14,
                    border: '1px solid var(--shell-panel-border)',
                    background: 'var(--shell-panel-bg)',
                    color: 'var(--foreground)',
                    padding: 12,
                    font: 'inherit',
                  }}
                />
              </div>

              <div style={adminActionRowStyle}>
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => void handleReview('ready_to_import')}
                  disabled={Boolean(savingStatus)}
                >
                  {savingStatus === 'ready_to_import' ? 'Saving...' : 'Mark ready'}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => void handleQueueOcr()}
                  disabled={Boolean(savingStatus) || queueingOcr || !selectedDraft || selectedBatch.requestedImportType !== 'scorecard'}
                >
                  {queueingOcr ? 'Queueing...' : ocrButtonLabel}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => void handleReview('needs_review')}
                  disabled={Boolean(savingStatus)}
                >
                  {savingStatus === 'needs_review' ? 'Saving...' : 'Hold for review'}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => void handleReview('rejected')}
                  disabled={Boolean(savingStatus)}
                  style={{ borderColor: 'rgba(248,113,113,0.26)', color: '#fecaca' }}
                >
                  {savingStatus === 'rejected' ? 'Saving...' : 'Reject batch'}
                </button>
              </div>
            </div>
          )}
        </AdminReviewPanel>
      </AdminReviewGrid>
    </AdminReviewFrame>
  )
}

function BatchHeader({ batch }: { batch: DataAssistAdminBatch }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div>
        <div className="section-kicker">Selected batch</div>
        <h2 className="section-title" style={{ marginTop: 6, fontSize: '1.5rem' }}>
          {getDataAssistImportTypeLabel(batch.requestedImportType)}
        </h2>
        <p className="subtle-text" style={{ marginTop: 8, maxWidth: 720 }}>
          {batch.contributionValue || 'Community upload queued for admin trust review.'}
        </p>
      </div>
      <StatusBadge status={batch.status} />
    </div>
  )
}

function ScorecardBoundary({ draft }: { draft: DataAssistAdminDraft | null }) {
  if (!draft || draft.draftType !== 'scorecard') return null

  const readiness = getScorecardDraftReadiness({
    externalMatchId: draft.externalMatchId,
    homeTeam: draft.homeTeam,
    awayTeam: draft.awayTeam,
    matchDate: draft.matchDate,
    lineCount: draft.lineCount,
    parserWarnings: draft.parserWarnings,
  })

  const fields = [
    ['Match id', draft.externalMatchId || 'Not parsed'],
    ['Home team', draft.homeTeam || 'Not parsed'],
    ['Away team', draft.awayTeam || 'Not parsed'],
    ['Match date', draft.matchDate || 'Not parsed'],
    ['Lines', String(draft.lineCount || 0)],
  ]

  return (
    <div style={{ marginTop: 18 }}>
      <div className="section-kicker">Scorecard boundary</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10, marginTop: 10 }}>
        {fields.map(([label, value]) => (
          <AdminFact key={label} label={label} value={value} />
        ))}
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {readiness.warnings.map((warning) => (
          <div key={warning} className="subtle-text" style={{ color: '#fed7aa' }}>
            {warning}
          </div>
        ))}
      </div>
    </div>
  )
}

function OcrJobPanel({ draft, jobs }: { draft: DataAssistAdminDraft | null; jobs: DataAssistOcrJob[] }) {
  if (!draft) return null

  const parsedPayload = draft.parsedPayload as {
    rawTextPreview?: string
    sourceScreenshotCount?: number
    confidenceScore?: number
    ocrQuality?: {
      provider?: string
      textLength?: number
      nonEmptyLineCount?: number
      duplicateLineCount?: number
      parserWarningCount?: number
      parsedLineCount?: number
      ocrConfidenceScore?: number
      parserConfidenceScore?: number
      reviewPriority?: string
      autoAssessment?: {
        decision?: string
        label?: string
        detail?: string
        reasons?: string[]
        adminReviewRequired?: boolean
        memberConfirmationRequired?: boolean
      }
      screenshotSummaries?: Array<{
        uploadOrder?: number
        fileName?: string
        confidenceScore?: number
        textLength?: number
        nonEmptyLineCount?: number
        duplicateLineCount?: number
      }>
    }
    lines?: Array<{
      lineLabel?: string
      homePlayers?: string[]
      awayPlayers?: string[]
      score?: string
      winner?: string
      confidenceScore?: number
    }>
  }
  const latestJob = jobs[0] ?? null
  const ocrQuality = parsedPayload.ocrQuality || null
  const autoAssessment = ocrQuality?.autoAssessment || null

  return (
    <div style={{ marginTop: 18 }}>
      <div className="section-kicker">OCR verification</div>
      <div style={{ marginTop: 10, display: 'grid', gap: 12 }}>
        <div style={{ padding: 14, borderRadius: 16, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: 'var(--foreground)', fontWeight: 900 }}>
                {getOcrProviderLabel(draft.ocrProvider)}
              </div>
              <div className="subtle-text" style={{ marginTop: 6 }}>
                {draft.ocrStatus === 'processed'
                  ? 'A parsed draft was generated. Admin review is only needed for exceptions.'
                  : 'No OCR verification draft has been generated yet.'}
              </div>
            </div>
            <StatusBadge status={draft.ocrStatus} compact />
          </div>

          {latestJob ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10, marginTop: 12 }}>
              <AdminFact label="Job" value={latestJob.id.slice(0, 8).toUpperCase()} />
              <AdminFact label="Provider" value={latestJob.provider} />
              <AdminFact label="Upload files" value={String(latestJob.screenshotCount)} />
              <AdminFact label="Processed" value={formatDate(latestJob.processedAt || latestJob.createdAt)} />
            </div>
          ) : null}
        </div>

        {ocrQuality ? (
          <div style={{ padding: 14, borderRadius: 16, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--foreground)', fontWeight: 900 }}>OCR quality</div>
                <div className="subtle-text" style={{ marginTop: 6 }}>
                  {getOcrReviewPriorityCopy(ocrQuality.reviewPriority)}
                </div>
              </div>
              <StatusBadge status={ocrQuality.reviewPriority || 'needs_manual_review'} compact />
            </div>
            {autoAssessment ? (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg-strong)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: 'var(--foreground)', fontWeight: 900 }}>
                      {autoAssessment.label || 'Auto assessment'}
                    </div>
                    <div className="subtle-text" style={{ marginTop: 5 }}>
                      {autoAssessment.detail || 'TenAceIQ auto-assessed this OCR draft.'}
                    </div>
                  </div>
                  <StatusBadge status={autoAssessment.decision || 'needs_review'} compact />
                </div>
                {autoAssessment.reasons?.length ? (
                  <div style={{ display: 'grid', gap: 5, marginTop: 10 }}>
                    {autoAssessment.reasons.slice(0, 4).map((reason) => (
                      <div key={reason} className="subtle-text" style={{ fontSize: 12 }}>{reason}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))', gap: 10, marginTop: 12 }}>
              <AdminFact label="OCR confidence" value={formatPercent(ocrQuality.ocrConfidenceScore)} />
              <AdminFact label="Parser confidence" value={formatPercent(ocrQuality.parserConfidenceScore ?? parsedPayload.confidenceScore)} />
              <AdminFact label="Parsed lines" value={String(ocrQuality.parsedLineCount ?? parsedPayload.lines?.length ?? 0)} />
              <AdminFact label="Text lines" value={String(ocrQuality.nonEmptyLineCount ?? 0)} />
              <AdminFact label="Text chars" value={(ocrQuality.textLength ?? 0).toLocaleString()} />
              <AdminFact label="Duplicates removed" value={String(ocrQuality.duplicateLineCount ?? 0)} />
              <AdminFact label="Warnings" value={String(ocrQuality.parserWarningCount ?? draft.parserWarnings.length)} />
            </div>
            {ocrQuality.screenshotSummaries?.length ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {ocrQuality.screenshotSummaries.map((summary) => (
                  <div
                    key={`${summary.uploadOrder}-${summary.fileName}`}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      border: '1px solid var(--shell-panel-border)',
                      background: 'var(--shell-panel-bg-strong)',
                    }}
                  >
                    <div style={{ color: 'var(--foreground)', fontWeight: 900 }}>
                      #{summary.uploadOrder || '?'} {summary.fileName || 'Upload file'}
                    </div>
                    <div className="subtle-text" style={{ marginTop: 5, fontSize: 12 }}>
                      {formatPercent(summary.confidenceScore)} OCR - {summary.nonEmptyLineCount ?? 0} lines - {summary.duplicateLineCount ?? 0} overlap lines removed
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {draft.parserWarnings.length ? (
          <div style={{ padding: 14, borderRadius: 16, border: '1px solid rgba(251,191,36,0.24)', background: 'rgba(251,191,36,0.08)' }}>
            <div style={{ color: '#fde68a', fontWeight: 900 }}>Parser warnings</div>
            <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
              {draft.parserWarnings.map((warning) => (
                <div key={warning} className="subtle-text">{warning}</div>
              ))}
            </div>
          </div>
        ) : null}

        {parsedPayload.rawTextPreview ? (
          <div style={{ padding: 14, borderRadius: 16, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
            <div className="metric-label">OCR source preview</div>
            <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', color: 'var(--foreground)', fontSize: 12, lineHeight: 1.5 }}>
              {parsedPayload.rawTextPreview}
            </pre>
          </div>
        ) : null}

        {parsedPayload.lines?.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {parsedPayload.lines.map((line, index) => (
              <div key={`${line.lineLabel}-${index}`} style={{ padding: 12, borderRadius: 14, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
                <div style={{ color: 'var(--foreground)', fontWeight: 900 }}>{line.lineLabel || `Line ${index + 1}`}</div>
                <div className="subtle-text" style={{ marginTop: 6 }}>
                  {(line.homePlayers || []).join(' / ') || 'Home players not parsed'} vs {(line.awayPlayers || []).join(' / ') || 'Away players not parsed'}
                </div>
                <div className="subtle-text" style={{ marginTop: 4 }}>{line.score || 'Score not parsed'}</div>
              </div>
            ))}
          </div>
        ) : (
          <AdminEmptyState text="No scorecard lines have been extracted yet. Run free OCR or keep this in manual review." />
        )}
      </div>
    </div>
  )
}

function ScreenshotGrid({ screenshots }: { screenshots: DataAssistAdminScreenshot[] }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="section-kicker">Upload Files</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12, marginTop: 10 }}>
        {screenshots.length ? (
          screenshots.map((screenshot) => (
            <div key={screenshot.id} style={{ overflow: 'hidden', borderRadius: 16, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
              <div style={{ position: 'relative', aspectRatio: '4 / 5', background: 'var(--shell-panel-bg-strong)', borderBottom: '1px solid var(--shell-panel-border)' }}>
                {screenshot.signedImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={screenshot.signedImageUrl}
                    alt={`TennisLink upload ${screenshot.uploadOrder}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 14, textAlign: 'center' }}>
                    <div className="subtle-text">Stored image unavailable. Metadata is still available below.</div>
                  </div>
                )}
                <div style={{ position: 'absolute', top: 10, left: 10 }}>
                  <StatusBadge status={screenshot.detectionStatus} compact />
                </div>
              </div>
              <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ color: 'var(--foreground)', fontWeight: 900 }}>#{screenshot.uploadOrder}</div>
                <span className="badge badge-blue" style={{ fontSize: 10 }}>
                  {screenshot.storagePath ? 'Stored' : 'Metadata only'}
                </span>
              </div>
              <div className="subtle-text" style={{ marginTop: 8, wordBreak: 'break-word' }}>
                {screenshot.fileName}
              </div>
              <div className="subtle-text" style={{ marginTop: 6, fontSize: 12 }}>
                {screenshot.imageWidth}x{screenshot.imageHeight} - {formatBytes(screenshot.fileSizeBytes)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {screenshot.visualSignals.slice(0, 3).map((signal) => (
                  <span key={signal} className="badge badge-slate" style={{ fontSize: 10 }}>
                    {signal}
                  </span>
                ))}
              </div>
              </div>
            </div>
          ))
        ) : (
          <AdminEmptyState text="No upload metadata found for this batch." />
        )}
      </div>
    </div>
  )
}

function DraftSummary({ draft }: { draft: DataAssistAdminDraft | null }) {
  if (!draft) return <AdminEmptyState text="No draft row found for this batch." />

  return (
    <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
      <div style={{ padding: 14, borderRadius: 16, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
        <div className="metric-label">Draft status</div>
        <div style={{ marginTop: 8 }}>
          <StatusBadge status={draft.status} />
        </div>
      </div>
      <div style={{ padding: 14, borderRadius: 16, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
        <div className="metric-label">OCR status</div>
        <div style={{ color: 'var(--foreground)', fontWeight: 900, marginTop: 8 }}>{draft.ocrStatus.replace(/_/g, ' ')}</div>
      </div>
      <div style={{ padding: 14, borderRadius: 16, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
        <div className="metric-label">Confidence</div>
        <div style={{ color: 'var(--foreground)', fontWeight: 900, marginTop: 8 }}>{Math.round(draft.confidenceScore * 100)}%</div>
      </div>
    </div>
  )
}

function QueueMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ fontSize: '1.35rem' }}>
        {value.toLocaleString()}
      </div>
    </div>
  )
}

function StatusBadge({ status, compact = false }: { status: string; compact?: boolean }) {
  const tone =
    status === 'rejected' || status === 'blocked'
      ? 'badge-slate'
      : status === 'ready_to_import' || status === 'ready_for_verification' || status === 'supported' || status === 'verified' || status === 'imported'
        ? 'badge-green'
        : 'badge-blue'

  return (
    <span className={`badge ${tone}`} style={{ fontSize: compact ? 10 : 11 }}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function getOcrProviderLabel(provider: string) {
  if (provider === 'mock_review') return 'Mock OCR boundary'
  if (provider === 'tesseract') return 'Free Tesseract OCR'
  return provider
}

function getOcrReviewPriorityCopy(priority: string | undefined) {
  if (priority === 'ready_for_review') return 'OCR found enough trusted structure to keep moving.'
  if (priority === 'blocked') return 'OCR did not find enough usable scorecard text.'
  return 'Review carefully before trusting these extracted fields.'
}

function formatPercent(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0%'
  return `${Math.round(value * 100)}%`
}

function formatDate(value: string) {
  if (!value) return 'Unknown date'
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatBytes(value: number) {
  if (!value) return '0 KB'
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}
