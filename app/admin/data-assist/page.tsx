'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import {
  getDataAssistImportTypeLabel,
  listDataAssistAdminBatches,
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

type QueueFilter = 'all' | 'needs_review' | 'layout_detected' | 'ready_to_import' | 'rejected'

const filterLabels: Record<QueueFilter, string> = {
  all: 'All',
  needs_review: 'Needs review',
  layout_detected: 'Layout detected',
  ready_to_import: 'Ready',
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
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [savingStatus, setSavingStatus] = useState<DataAssistBatchStatus | ''>('')
  const [queueingOcr, setQueueingOcr] = useState(false)

  const selectedBatch = batches.find((batch) => batch.id === selectedId) ?? null
  const selectedDraft = drafts[0] ?? null

  const filteredBatches = useMemo(
    () => batches.filter((batch) => filter === 'all' || batch.status === filter),
    [batches, filter],
  )

  const stats = useMemo(() => {
    const needsReview = batches.filter((batch) => batch.status === 'needs_review' || batch.status === 'layout_detected').length
    const ready = batches.filter((batch) => batch.status === 'ready_to_import').length
    const rejected = batches.filter((batch) => batch.status === 'rejected').length
    const scorecards = batches.filter((batch) => batch.requestedImportType === 'scorecard').length
    return { needsReview, ready, rejected, scorecards }
  }, [batches])

  async function refreshQueue(nextSelectedId = selectedId) {
    setLoading(true)
    setError('')
    try {
      const nextBatches = await listDataAssistAdminBatches()
      setBatches(nextBatches)
      const nextId = nextSelectedId || nextBatches[0]?.id || ''
      setSelectedId(nextId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Data Assist batches.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshQueue()
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
          ? 'approved for OCR verification'
          : status === 'rejected'
            ? 'rejected'
            : 'held for review'
      setMessage(`Batch ${label}. Import remains locked until verified parsing is implemented.`)
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
      setMessage(`OCR verification boundary queued. Job ${result.jobId.slice(0, 8).toUpperCase()} produced a review-only draft; import remains locked.`)
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
    <section style={{ width: '100%', maxWidth: 1280, margin: '0 auto', padding: '18px 24px 36px' }}>
      <div
        className="hero-panel"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '24px',
          borderRadius: 22,
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="section-kicker">Data Assist Review</div>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            TennisLink screenshot queue
          </h1>
          <p className="page-subtitle" style={{ maxWidth: 860 }}>
            Review community-assisted screenshot batches, confirm the TennisLink layout, and hold every import behind OCR verification.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
            <Link href="/data-assist" className="button-secondary" style={{ textDecoration: 'none' }}>
              Open Upload Flow
            </Link>
            <Link href="/admin" className="button-secondary" style={{ textDecoration: 'none' }}>
              Back to Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="metric-grid" style={{ marginTop: 18 }}>
        <QueueMetric label="Needs review" value={stats.needsReview} />
        <QueueMetric label="Ready for OCR" value={stats.ready} />
        <QueueMetric label="Rejected" value={stats.rejected} />
        <QueueMetric label="Scorecards" value={stats.scorecards} />
      </div>

      {message ? <StatusPanel tone="success" text={message} /> : null}
      {error ? <StatusPanel tone="error" text={error} /> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: 18,
          marginTop: 18,
          alignItems: 'start',
        }}
      >
        <section className="surface-card" style={{ padding: 18, minHeight: 520 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="section-kicker">Queue</div>
              <h2 className="section-title" style={{ marginTop: 6, fontSize: '1.4rem' }}>
                Review batches
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
              <EmptyState text="Loading Data Assist batches..." />
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
                    {batch.screenshotCount} screenshots - {Math.round(batch.confidenceScore * 100)}% confidence
                  </div>
                  <div className="subtle-text" style={{ marginTop: 6, fontSize: 12 }}>
                    {formatDate(batch.createdAt)}
                  </div>
                </button>
              ))
            ) : (
              <EmptyState text="No batches match this filter yet." />
            )}
          </div>
        </section>

        <section className="surface-card" style={{ padding: 18, minHeight: 520 }}>
          {!selectedBatch ? (
            <EmptyState text="Select a batch to review its screenshots and draft boundary." />
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
                <EmptyState text="Loading screenshots and draft detail..." />
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

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => void handleReview('ready_to_import')}
                  disabled={Boolean(savingStatus)}
                >
                  {savingStatus === 'ready_to_import' ? 'Saving...' : 'Approve for OCR verification'}
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
        </section>
      </div>
    </section>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 10 }}>
        {fields.map(([label, value]) => (
          <div key={label} style={{ padding: 12, borderRadius: 14, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
            <div className="metric-label">{label}</div>
            <div style={{ color: 'var(--foreground)', fontWeight: 900, marginTop: 5 }}>{value}</div>
          </div>
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
                  ? 'A review-only parsed draft was generated. Import remains disabled.'
                  : 'No OCR verification draft has been generated yet.'}
              </div>
            </div>
            <StatusBadge status={draft.ocrStatus} compact />
          </div>

          {latestJob ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 12 }}>
              <MiniFact label="Job" value={latestJob.id.slice(0, 8).toUpperCase()} />
              <MiniFact label="Provider" value={latestJob.provider} />
              <MiniFact label="Screenshots" value={String(latestJob.screenshotCount)} />
              <MiniFact label="Processed" value={formatDate(latestJob.processedAt || latestJob.createdAt)} />
            </div>
          ) : null}
        </div>

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
          <EmptyState text="No scorecard lines have been extracted yet. This boundary is ready for a real OCR provider." />
        )}
      </div>
    </div>
  )
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 12, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg-strong)' }}>
      <div className="metric-label">{label}</div>
      <div style={{ color: 'var(--foreground)', fontWeight: 900, marginTop: 5 }}>{value || 'None'}</div>
    </div>
  )
}

function ScreenshotGrid({ screenshots }: { screenshots: DataAssistAdminScreenshot[] }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="section-kicker">Screenshots</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 10 }}>
        {screenshots.length ? (
          screenshots.map((screenshot) => (
            <div key={screenshot.id} style={{ overflow: 'hidden', borderRadius: 16, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
              <div style={{ position: 'relative', aspectRatio: '4 / 5', background: 'var(--shell-panel-bg-strong)', borderBottom: '1px solid var(--shell-panel-border)' }}>
                {screenshot.signedImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={screenshot.signedImageUrl}
                    alt={`TennisLink screenshot ${screenshot.uploadOrder}`}
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
          <EmptyState text="No screenshot metadata found for this batch." />
        )}
      </div>
    </div>
  )
}

function DraftSummary({ draft }: { draft: DataAssistAdminDraft | null }) {
  if (!draft) return <EmptyState text="No draft row found for this batch." />

  return (
    <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
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
      : status === 'ready_to_import' || status === 'ready_for_verification' || status === 'supported'
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

function StatusPanel({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: '12px 14px',
        borderRadius: 16,
        border: tone === 'success' ? '1px solid rgba(155,225,29,0.24)' : '1px solid rgba(248,113,113,0.24)',
        background: tone === 'success' ? 'rgba(155,225,29,0.08)' : 'rgba(248,113,113,0.08)',
        color: tone === 'success' ? '#d9ff87' : '#fecaca',
        fontWeight: 800,
      }}
    >
      {text}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 16, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)' }}>
      <div className="subtle-text">{text}</div>
    </div>
  )
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
