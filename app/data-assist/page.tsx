'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import {
  getMyDataAssistContributorStats,
  getDataAssistContributionValue,
  getDataAssistImportTypeLabel,
  listMyDataAssistSubmissions,
  prepareDataAssistBatch,
  queueDataAssistOcrVerification,
  reorderDataAssistScreenshots,
  reviewMyDataAssistOcrDraft,
  runMyDataAssistImport,
  saveDataAssistDraftBatch,
  summarizeDataAssistBatch,
  type DataAssistBatchSummary,
  type DataAssistContributorStats,
  type DataAssistImportActionResult,
  type DataAssistImportType,
  type DataAssistPreparedScreenshot,
  type DataAssistSubmission,
} from '@/lib/data-assist'
import { getDataAssistOcrReadiness, type DataAssistAutoAssessment } from '@/lib/data-assist-ocr'
import type { DataAssistScorecardParsedDraft } from '@/lib/data-assist-ocr'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const importTypes: Array<{
  id: DataAssistImportType
  label: string
  detail: string
}> = [
  {
    id: 'scorecard',
    label: 'Scorecard',
    detail: 'Completed match results and lines',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    detail: 'Upcoming team match dates and sites',
  },
  {
    id: 'team_summary',
    label: 'Team summary',
    detail: 'Roster and team page context',
  },
]

export default function DataAssistPage() {
  return (
    <SiteShell active="/data-assist">
      <DataAssistWorkspace />
    </SiteShell>
  )
}

function DataAssistWorkspace() {
  const { userId, authResolved } = useAuth()
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const [importType, setImportType] = useState<DataAssistImportType>('scorecard')
  const [summary, setSummary] = useState<DataAssistBatchSummary | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBatchId, setSavedBatchId] = useState('')
  const [submissions, setSubmissions] = useState<DataAssistSubmission[]>([])
  const [contributorStats, setContributorStats] = useState<DataAssistContributorStats | null>(null)
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [submissionsError, setSubmissionsError] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState('')
  const [importingSubmissionId, setImportingSubmissionId] = useState('')
  const [importResultsBySubmission, setImportResultsBySubmission] = useState<Record<string, DataAssistImportActionResult>>({})

  const confidenceLabel = useMemo(() => {
    if (!summary) return 'Waiting for screenshots'
    if (summary.status === 'layout_detected') return 'Ready for review'
    if (summary.status === 'needs_review') return 'Review recommended'
    return 'Not supported'
  }, [summary])

  async function refreshSubmissions() {
    if (!authResolved || !userId) {
      setSubmissions([])
      return
    }

    setSubmissionsLoading(true)
    setSubmissionsError('')
    try {
      const [nextSubmissions, nextStats] = await Promise.all([
        listMyDataAssistSubmissions(),
        getMyDataAssistContributorStats(),
      ])
      setSubmissions(nextSubmissions)
      setContributorStats(nextStats)
    } catch (err) {
      setSubmissionsError(err instanceof Error ? err.message : 'Your Data Assist submissions could not be loaded.')
    } finally {
      setSubmissionsLoading(false)
    }
  }

  useEffect(() => {
    void refreshSubmissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved, userId])

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    setPreparing(true)
    setSavedBatchId('')
    setMessage('')
    setError('')

    try {
      const nextSummary = await prepareDataAssistBatch(files, importType)
      setSummary(nextSummary)
      if (nextSummary.status === 'rejected') {
        setError(nextSummary.rejectionReason)
      } else if (nextSummary.status === 'needs_review') {
        setMessage('Screenshots are staged. Full-page captures are accepted, but cropped scorecard screenshots usually OCR better.')
      } else {
        setMessage('TennisLink screenshot signals found. Review the order, then save the draft.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Screenshots could not be prepared.')
    } finally {
      setPreparing(false)
      event.target.value = ''
    }
  }

  function moveScreenshot(fromIndex: number, direction: -1 | 1) {
    if (!summary) return
    const toIndex = fromIndex + direction
    if (toIndex < 0 || toIndex >= summary.screenshots.length) return
    const nextScreenshots = reorderDataAssistScreenshots(summary.screenshots, fromIndex, toIndex)
    setSummary(summarizeDataAssistBatch(importType, nextScreenshots))
    setSavedBatchId('')
  }

  function removeScreenshot(id: string) {
    if (!summary) return
    const nextScreenshots = summary.screenshots
      .filter((screenshot) => screenshot.id !== id)
      .map((screenshot, index) => ({ ...screenshot, uploadOrder: index + 1 }))
    setSummary(summarizeDataAssistBatch(importType, nextScreenshots))
    setSavedBatchId('')
  }

  async function saveDraft() {
    if (!summary || saving) return
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const result = await saveDataAssistDraftBatch(summary)
      setSavedBatchId(result.batchId)
      const readiness = getDataAssistOcrReadiness()
      if (summary.requestedImportType === 'scorecard' && readiness.canRun && readiness.provider === 'tesseract') {
        setMessage(`Saved ${result.screenshotCount} screenshot${result.screenshotCount === 1 ? '' : 's'}. Running free OCR now...`)
        const ocrResult = await queueDataAssistOcrVerification({
          batchId: result.batchId,
          draftId: result.draftId,
        })
        setMessage(getAutoAssessmentMessage(ocrResult.autoAssessment, ocrResult.autoImport))
      } else {
        setMessage(`Data Assist draft saved with ${result.screenshotCount} stored screenshot${result.screenshotCount === 1 ? '' : 's'}. Nothing has been imported yet.`)
      }
      await refreshSubmissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data Assist draft could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function reviewSubmission(submission: DataAssistSubmission, decision: 'confirmed' | 'flagged') {
    if (!submission.draftId || reviewingSubmissionId) return
    setReviewingSubmissionId(submission.id)
    setMessage('')
    setError('')

    try {
      const result = await reviewMyDataAssistOcrDraft({
        batchId: submission.id,
        draftId: submission.draftId,
        decision,
      })
      setMessage(result.message || (decision === 'confirmed'
        ? 'Scorecard confirmed. Contribution credit updated.'
        : 'Scorecard flagged for exception review.'))
      await refreshSubmissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review this Data Assist draft.')
    } finally {
      setReviewingSubmissionId('')
    }
  }

  async function runSubmissionImport(submission: DataAssistSubmission, action: 'preview' | 'commit') {
    if (!submission.draftId || importingSubmissionId) return
    setImportingSubmissionId(submission.id)
    setMessage('')
    setError('')

    try {
      const result = await runMyDataAssistImport({
        batchId: submission.id,
        draftId: submission.draftId,
        action,
      })
      setImportResultsBySubmission((current) => ({
        ...current,
        [submission.id]: result,
      }))
      setMessage(result.message)
      if (action === 'commit') await refreshSubmissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run this Data Assist import.')
    } finally {
      setImportingSubmissionId('')
    }
  }

  return (
    <section style={pageStyle(isMobile)}>
      <section style={heroStyle(isTablet, isMobile)}>
        <div style={heroCopyStyle}>
          <div className="section-kicker">TenAceIQ Data Assist</div>
          <h1 style={titleStyle(isSmallMobile)}>Upload TennisLink screenshots. Review them. Improve the read.</h1>
          <p style={heroTextStyle}>
            Data Assist starts with trusted TennisLink screenshots only. Scorecards, schedules, and team summaries
            become draft imports first, then verified tennis intelligence.
          </p>
          <div style={heroActionRowStyle}>
            <a href="#upload" style={primaryButtonStyle}>Start upload</a>
            <Link href="/messages?compose=support&category=data&subject=Data%20Assist%20question" style={secondaryButtonStyle}>
              Ask support
            </Link>
          </div>
        </div>

        <div style={trustPanelStyle}>
          <div style={trustStatStyle}>
            <span>Source</span>
            <strong>TennisLink only</strong>
          </div>
          <div style={trustStatStyle}>
            <span>Commit path</span>
            <strong>Review first</strong>
          </div>
          <div style={trustStatStyle}>
            <span>Reward basis</span>
            <strong>Verified quality</strong>
          </div>
        </div>
      </section>

      <MySubmissionsPanel
        authResolved={authResolved}
        userId={userId}
        submissions={submissions}
        contributorStats={contributorStats}
        loading={submissionsLoading}
        error={submissionsError}
        onRefresh={() => void refreshSubmissions()}
        reviewingSubmissionId={reviewingSubmissionId}
        onReviewSubmission={(submission, decision) => void reviewSubmission(submission, decision)}
        importingSubmissionId={importingSubmissionId}
        importResultsBySubmission={importResultsBySubmission}
        onRunImport={(submission, action) => void runSubmissionImport(submission, action)}
      />

      <section style={workspaceStyle(isTablet)}>
        <section id="upload" style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div className="section-kicker">Upload batch</div>
              <h2 style={sectionTitleStyle}>Choose the TennisLink page you captured.</h2>
            </div>
            <span style={pillStyle}>{authResolved && userId ? 'Signed in' : 'Sign in needed'}</span>
          </div>

          <div style={typeGridStyle(isMobile)}>
            {importTypes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setImportType(item.id)
                  setSummary((current) => current ? summarizeDataAssistBatch(item.id, current.screenshots) : null)
                  setSavedBatchId('')
                  setMessage('')
                  setError('')
                }}
                style={typeButtonStyle(importType === item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </button>
            ))}
          </div>

          <label style={dropzoneStyle(summary?.status || '')}>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void handleFiles(event)}
              style={fileInputStyle}
            />
            <span style={dropzoneKickerStyle}>TennisLink screenshots only</span>
            <strong>{preparing ? 'Checking screenshots...' : 'Tap or drag screenshots here'}</strong>
            <small>JPG, PNG, or WebP. Scorecard-area screenshots work best; full-page captures are okay.</small>
          </label>

          <div style={guardrailListStyle}>
            {[
              'No manual data entry',
              'No CSV, PDF, pasted text, or arbitrary screenshots',
              'Confirm the OCR read before import',
              'Multiple mobile screenshots stay ordered and deduplicatable',
            ].map((item) => (
              <span key={item} style={guardrailStyle}>{item}</span>
            ))}
          </div>

          <div style={tutorialPanelStyle}>
            <div className="section-kicker">Quick capture guide</div>
            <div style={tutorialGridStyle}>
              <TutorialStep label="Chrome / Edge" text="Use the browser snip tool and capture the scorecard table plus match header." />
              <TutorialStep label="Mobile" text="Take ordered screenshots while scrolling from the header through the final team score." />
              <TutorialStep label="Best read" text="Crop out ads and footer when easy; keep team names, date, lines, scores, and winners visible." />
            </div>
          </div>

          {!authResolved || !userId ? (
            <div style={noticeStyle}>
              Sign in before saving a Data Assist draft. You can still stage screenshots on this screen.
            </div>
          ) : null}
        </section>

        <aside style={panelStyle}>
          <div className="section-kicker">Quality read</div>
          <h2 style={sectionTitleStyle}>{confidenceLabel}</h2>
          <div style={confidenceMeterStyle}>
            <span style={confidenceFillStyle(summary?.confidenceScore || 0)} />
          </div>
          <p style={copyStyle}>
            {summary
              ? summary.status === 'layout_detected'
                  ? 'Ready to save. TenAceIQ will scan scorecards automatically when free OCR is enabled.'
                : summary.status === 'needs_review'
                  ? 'This looks image-safe. Save it if it is TennisLink; a cleaner scorecard crop may OCR better.'
                  : summary.rejectionReason
              : 'Upload TennisLink screenshots to stage them for review.'}
          </p>

          <div style={impactBoxStyle}>
            <span>What this improves</span>
            <strong>{getDataAssistImportTypeLabel(importType)}</strong>
            <p>{summary?.contributionValue || getDataAssistContributionValue(importType)}</p>
          </div>

          <div style={achievementBoxStyle}>
            <span>Contributor path</span>
            <strong>Quality over volume</strong>
            <p>Badges and future perks should unlock from verified, accurate uploads, not raw upload count.</p>
          </div>
        </aside>
      </section>

      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div className="section-kicker">Review before save</div>
            <h2 style={sectionTitleStyle}>Confirm order and support status.</h2>
          </div>
          {summary ? <span style={pillStyle}>{summary.screenshots.length} screenshot{summary.screenshots.length === 1 ? '' : 's'}</span> : null}
        </div>

        {summary?.screenshots.length ? (
          <div style={screenshotGridStyle(isTablet)}>
            {summary.screenshots.map((screenshot, index) => (
              <ScreenshotCard
                key={screenshot.id}
                screenshot={screenshot}
                index={index}
                total={summary.screenshots.length}
                onMove={moveScreenshot}
                onRemove={removeScreenshot}
              />
            ))}
          </div>
        ) : (
          <div style={emptyStateStyle}>
            Upload TennisLink screenshots to build a draft. The future parser will merge ordered screenshots into one logical page.
          </div>
        )}

        <div style={draftActionRowStyle}>
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={!summary || !userId || saving || summary.status === 'rejected' || !summary.screenshots.length}
            style={{
              ...primaryButtonStyle,
              ...((!summary || !userId || saving || summary.status === 'rejected' || !summary.screenshots.length) ? disabledStyle : {}),
            }}
          >
            {saving ? 'Saving and scanning...' : 'Save and scan'}
          </button>
          <span style={hintStyle}>Scorecards scan automatically. Import stays locked until the parsed read is trusted.</span>
        </div>

        {savedBatchId ? (
          <div style={successStyle}>Draft saved: {savedBatchId.slice(0, 8).toUpperCase()}</div>
        ) : null}
        {message ? <div style={successStyle}>{message}</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}
      </section>
    </section>
  )
}

function getAutoAssessmentMessage(
  assessment: DataAssistAutoAssessment | undefined,
  autoImport: DataAssistImportActionResult | undefined,
) {
  if (autoImport?.ok && autoImport.action === 'commit') {
    return autoImport.message || 'Free OCR finished and TenAceIQ imported this scorecard automatically.'
  }
  if (autoImport && !autoImport.ok) {
    return `Free OCR finished, but automatic import paused: ${autoImport.message}`
  }
  if (!assessment) {
    return 'Free OCR finished. Review the parsed draft before any import is committed.'
  }
  if (assessment.decision === 'auto_ready') {
    return 'Free OCR finished. This scorecard passed auto-checks and is ready without admin review.'
  }
  if (assessment.decision === 'member_confirm') {
    return 'Free OCR finished. TenAceIQ found a usable scorecard draft; confirm the read before import.'
  }
  if (assessment.decision === 'admin_exception') {
    return 'Free OCR finished, but this one needs exception review because key details were uncertain.'
  }
  return 'Free OCR could not safely read this scorecard. Try a cleaner crop of the scorecard area.'
}

function ScreenshotCard({
  screenshot,
  index,
  total,
  onMove,
  onRemove,
}: {
  screenshot: DataAssistPreparedScreenshot
  index: number
  total: number
  onMove: (fromIndex: number, direction: -1 | 1) => void
  onRemove: (id: string) => void
}) {
  const supported = screenshot.detectionStatus === 'supported'
  const rejected = screenshot.detectionStatus === 'rejected'

  return (
    <article style={screenshotCardStyle}>
      <div style={thumbnailWrapStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={screenshot.previewUrl} alt={`Screenshot ${screenshot.uploadOrder}`} style={thumbnailStyle} />
        <span style={orderBadgeStyle}>{screenshot.uploadOrder}</span>
      </div>
      <div style={screenshotBodyStyle}>
        <div style={screenshotHeaderStyle}>
          <strong>{screenshot.fileName}</strong>
          <span style={rejected ? pillDangerStyle : supported ? pillGreenStyle : pillAmberStyle}>
            {rejected ? 'Rejected' : supported ? 'Supported' : 'Review'}
          </span>
        </div>
        <p style={copyStyle}>
          {screenshot.imageWidth} x {screenshot.imageHeight} - {(screenshot.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
        </p>
        {screenshot.rejectionReason ? <p style={warningStyle}>{screenshot.rejectionReason}</p> : null}
        <div style={signalListStyle}>
          {screenshot.visualSignals.slice(0, 5).map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>
        <div style={cardActionRowStyle}>
          <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} style={smallButtonStyle}>
            Up
          </button>
          <button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1} style={smallButtonStyle}>
            Down
          </button>
          <button type="button" onClick={() => onRemove(screenshot.id)} style={smallDangerButtonStyle}>
            Remove
          </button>
        </div>
      </div>
    </article>
  )
}

function MySubmissionsPanel({
  authResolved,
  userId,
  submissions,
  contributorStats,
  loading,
  error,
  onRefresh,
  reviewingSubmissionId,
  onReviewSubmission,
  importingSubmissionId,
  importResultsBySubmission,
  onRunImport,
}: {
  authResolved: boolean
  userId: string | null
  submissions: DataAssistSubmission[]
  contributorStats: DataAssistContributorStats | null
  loading: boolean
  error: string
  onRefresh: () => void
  reviewingSubmissionId: string
  onReviewSubmission: (submission: DataAssistSubmission, decision: 'confirmed' | 'flagged') => void
  importingSubmissionId: string
  importResultsBySubmission: Record<string, DataAssistImportActionResult>
  onRunImport: (submission: DataAssistSubmission, action: 'preview' | 'commit') => void
}) {
  const pendingCount = contributorStats?.pendingReviewCount ?? submissions.filter((submission) => submission.status !== 'verified' && submission.status !== 'imported' && submission.status !== 'rejected').length
  const verifiedCount = contributorStats?.verifiedImportCount ?? submissions.filter((submission) => submission.status === 'verified' || submission.status === 'imported').length
  const rejectedCount = contributorStats?.rejectedImportCount ?? submissions.filter((submission) => submission.status === 'rejected').length
  const accuracyScore = Math.round((contributorStats?.contributionAccuracyScore ?? 0) * 100)

  return (
    <section style={panelStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <div className="section-kicker">My submissions</div>
          <h2 style={sectionTitleStyle}>Track what you have contributed.</h2>
        </div>
        <button type="button" onClick={onRefresh} disabled={!authResolved || !userId || loading} style={smallButtonStyle}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {!authResolved || !userId ? (
        <div style={noticeStyle}>Sign in to track your Data Assist submissions and review status.</div>
      ) : submissions.length ? (
        <>
          <div style={submissionStatsStyle}>
            <SubmissionStat label="Pending review" value={pendingCount} />
            <SubmissionStat label="Verified quality" value={verifiedCount} />
            <SubmissionStat label="Accuracy score" value={`${accuracyScore}%`} />
            <SubmissionStat label="Rejected" value={rejectedCount} />
          </div>
          <ContributorBadges stats={contributorStats} />
          <div style={submissionListStyle}>
            {submissions.slice(0, 6).map((submission) => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                busy={reviewingSubmissionId === submission.id}
                onReview={onReviewSubmission}
                importing={importingSubmissionId === submission.id}
                importResult={importResultsBySubmission[submission.id]}
                onRunImport={onRunImport}
              />
            ))}
          </div>
        </>
      ) : loading ? (
        <div style={emptyStateStyle}>Loading your submissions...</div>
      ) : (
        <div style={emptyStateStyle}>Your saved Data Assist drafts will appear here after upload.</div>
      )}

      {error ? <div style={errorStyle}>{error}</div> : null}
    </section>
  )
}

function TutorialStep({ label, text }: { label: string; text: string }) {
  return (
    <div style={tutorialStepStyle}>
      <strong>{label}</strong>
      <span>{text}</span>
    </div>
  )
}

function SubmissionStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={submissionStatStyle}>
      <span>{label}</span>
      <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
    </div>
  )
}

function ContributorBadges({ stats }: { stats: DataAssistContributorStats | null }) {
  const badges = stats?.badges ?? []

  return (
    <div style={badgePanelStyle}>
      <div>
        <div className="section-kicker">Contributor badges</div>
        <p style={copyStyle}>
          Badges unlock from verified upload quality, not upload volume.
        </p>
      </div>
      {badges.length ? (
        <div style={badgeListStyle}>
          {badges.map((badge) => (
            <div key={badge.id} style={badgeCardStyle}>
              <strong>{badge.label}</strong>
              <span>{badge.detail}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={badgeEmptyStyle}>
          First badge unlocks after one verified Data Assist upload.
        </div>
      )}
    </div>
  )
}

function SubmissionCard({
  submission,
  busy,
  onReview,
  importing,
  importResult,
  onRunImport,
}: {
  submission: DataAssistSubmission
  busy: boolean
  onReview: (submission: DataAssistSubmission, decision: 'confirmed' | 'flagged') => void
  importing: boolean
  importResult?: DataAssistImportActionResult
  onRunImport: (submission: DataAssistSubmission, action: 'preview' | 'commit') => void
}) {
  const status = getSubmissionStatusCopy(submission)
  const reviewNote = submission.draftReviewNote || submission.reviewNote || submission.rejectionReason
  const parsedDraft = toScorecardParsedDraft(submission.parsedPayload)
  const canReviewParsedDraft =
    parsedDraft &&
    submission.draftId &&
    submission.draftOcrStatus === 'processed' &&
    submission.draftStatus === 'ready_for_verification' &&
    (submission.status === 'ready_to_import' || submission.status === 'needs_review')
  const canPreviewImport = Boolean(parsedDraft && submission.draftId && (submission.status === 'verified' || submission.status === 'imported'))
  const canCommitImport = Boolean(canPreviewImport && submission.status === 'verified')

  return (
    <article style={submissionCardStyle}>
      <div style={submissionCardTopStyle}>
        <div>
          <strong>{getDataAssistImportTypeLabel(submission.requestedImportType)}</strong>
          <p style={copyStyle}>
            {submission.screenshotCount} screenshot{submission.screenshotCount === 1 ? '' : 's'} saved - {Math.round(submission.confidenceScore * 100)}% confidence
          </p>
        </div>
        <span style={status.tone === 'green' ? pillGreenStyle : status.tone === 'red' ? pillDangerStyle : pillAmberStyle}>
          {status.label}
        </span>
      </div>
      <p style={copyStyle}>{status.detail}</p>
      {reviewNote ? <p style={warningStyle}>{reviewNote}</p> : null}
      {parsedDraft ? (
        <ScorecardReviewPanel
          parsedDraft={parsedDraft}
          canReview={Boolean(canReviewParsedDraft)}
          busy={busy}
          onConfirm={() => onReview(submission, 'confirmed')}
          onFlag={() => onReview(submission, 'flagged')}
        />
      ) : null}
      {parsedDraft && canPreviewImport ? (
        <ImportPreviewPanel
          result={importResult}
          importing={importing}
          canCommit={canCommitImport}
          onPreview={() => onRunImport(submission, 'preview')}
          onCommit={() => onRunImport(submission, 'commit')}
        />
      ) : null}
      <div style={submissionMetaStyle}>
        <span>{formatDate(submission.createdAt)}</span>
        <span>{submission.draftOcrStatus.replace(/_/g, ' ')}</span>
      </div>
    </article>
  )
}

function ImportPreviewPanel({
  result,
  importing,
  canCommit,
  onPreview,
  onCommit,
}: {
  result: DataAssistImportActionResult | undefined
  importing: boolean
  canCommit: boolean
  onPreview: () => void
  onCommit: () => void
}) {
  const preview = result?.importPreview
  const unresolvedWinnerCount = preview?.unresolvedWinnerCount ?? 0
  const newPlayers = preview?.playerMappings.filter((mapping) => mapping.status === 'unknown').length ?? 0
  const likelyPlayers = preview?.playerMappings.filter((mapping) => mapping.status === 'likely').length ?? 0
  const commitBlocked = unresolvedWinnerCount > 0 || !canCommit

  return (
    <div style={importPanelStyle}>
      <div style={submissionCardTopStyle}>
        <div>
          <strong>Import preview</strong>
          <p style={copyStyle}>
            Check match, player mapping, and line readiness before TenAceIQ writes match records.
          </p>
        </div>
        {result ? <span style={pillGreenStyle}>{result.action}</span> : null}
      </div>
      {preview ? (
        <>
          <div style={scorecardHeaderGridStyle}>
            <ReviewFact label="Lines" value={String(preview.row.lines.length)} />
            <ReviewFact label="Winners" value={unresolvedWinnerCount ? `${unresolvedWinnerCount} unresolved` : 'Ready'} />
            <ReviewFact label="Players" value={newPlayers ? `${newPlayers} new` : likelyPlayers ? `${likelyPlayers} likely` : 'Matched'} />
          </div>
          <div style={parsedLineListStyle}>
            {preview.playerMappings.slice(0, 6).map((mapping) => (
              <div key={mapping.name} style={parsedLineStyle}>
                <span>{mapping.name}</span>
                <strong>{mapping.status}</strong>
                <small>{mapping.matchedPlayerName || 'Will be created from TennisLink name'}</small>
              </div>
            ))}
          </div>
          {result?.importResult?.result.rows[0]?.message ? (
            <p style={copyStyle}>{result.importResult.result.rows[0].message}</p>
          ) : null}
        </>
      ) : (
        <p style={copyStyle}>Run preview to see what will be created or updated.</p>
      )}
      <div style={cardActionRowStyle}>
        <button type="button" onClick={onPreview} disabled={importing} style={{ ...smallButtonStyle, ...(importing ? disabledStyle : {}) }}>
          {importing ? 'Running...' : 'Preview import'}
        </button>
        <button type="button" onClick={onCommit} disabled={importing || commitBlocked} style={{ ...smallButtonStyle, ...(importing || commitBlocked ? disabledStyle : {}) }}>
          Commit import
        </button>
      </div>
      {commitBlocked && preview ? (
        <p style={warningStyle}>Commit unlocks after winners are resolved and the parsed read is confirmed.</p>
      ) : null}
    </div>
  )
}

function ScorecardReviewPanel({
  parsedDraft,
  canReview,
  busy,
  onConfirm,
  onFlag,
}: {
  parsedDraft: DataAssistScorecardParsedDraft
  canReview: boolean
  busy: boolean
  onConfirm: () => void
  onFlag: () => void
}) {
  return (
    <div style={scorecardReviewStyle}>
      <div style={scorecardHeaderGridStyle}>
        <ReviewFact label="Match" value={parsedDraft.externalMatchId || 'Needs read'} />
        <ReviewFact label="Date" value={parsedDraft.matchDate || 'Needs read'} />
        <ReviewFact label="Lines" value={String(parsedDraft.lineCount || parsedDraft.lines.length)} />
      </div>
      <div style={teamMatchupStyle}>
        <strong>{parsedDraft.homeTeam || 'Home team'}</strong>
        <span>vs</span>
        <strong>{parsedDraft.awayTeam || 'Visiting team'}</strong>
      </div>
      <div style={parsedLineListStyle}>
        {parsedDraft.lines.slice(0, 5).map((line, index) => (
          <div key={`${line.lineLabel}-${index}`} style={parsedLineStyle}>
            <span>{line.lineLabel}</span>
            <strong>{line.score || 'No score'}</strong>
            <small>
              {line.homePlayers.join(' / ') || 'Home players'} vs {line.awayPlayers.join(' / ') || 'Away players'}
            </small>
          </div>
        ))}
      </div>
      {parsedDraft.parserWarnings.length ? (
        <div style={warningStyle}>{parsedDraft.parserWarnings.slice(0, 2).join(' ')}</div>
      ) : null}
      <div style={cardActionRowStyle}>
        <button type="button" onClick={onConfirm} disabled={!canReview || busy} style={{ ...smallButtonStyle, ...(!canReview || busy ? disabledStyle : {}) }}>
          {busy ? 'Importing...' : 'Looks right - import'}
        </button>
        <button type="button" onClick={onFlag} disabled={!canReview || busy} style={{ ...smallDangerButtonStyle, ...(!canReview || busy ? disabledStyle : {}) }}>
          Needs fix
        </button>
      </div>
    </div>
  )
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={reviewFactStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function toScorecardParsedDraft(value: DataAssistSubmission['parsedPayload']): DataAssistScorecardParsedDraft | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as Partial<DataAssistScorecardParsedDraft>
  if (!Array.isArray(draft.lines) || !draft.lines.length) return null
  return {
    externalMatchId: typeof draft.externalMatchId === 'string' ? draft.externalMatchId : '',
    homeTeam: typeof draft.homeTeam === 'string' ? draft.homeTeam : '',
    awayTeam: typeof draft.awayTeam === 'string' ? draft.awayTeam : '',
    matchDate: typeof draft.matchDate === 'string' ? draft.matchDate : '',
    lineCount: typeof draft.lineCount === 'number' ? draft.lineCount : draft.lines.length,
    parserWarnings: Array.isArray(draft.parserWarnings)
      ? draft.parserWarnings.filter((warning): warning is string => typeof warning === 'string')
      : [],
    lines: draft.lines as DataAssistScorecardParsedDraft['lines'],
    rawTextPreview: typeof draft.rawTextPreview === 'string' ? draft.rawTextPreview : '',
    sourceScreenshotCount: typeof draft.sourceScreenshotCount === 'number' ? draft.sourceScreenshotCount : 0,
    provider: draft.provider || 'manual_review',
    confidenceScore: typeof draft.confidenceScore === 'number' ? draft.confidenceScore : 0,
    ocrQuality: draft.ocrQuality,
  }
}

function getSubmissionStatusCopy(submission: DataAssistSubmission) {
  if (submission.status === 'ready_to_import') {
    return {
      label: 'Confirm read',
      detail: 'TenAceIQ scanned this upload. Confirm the parsed scorecard or flag it for exception review.',
      tone: 'amber' as const,
    }
  }
  if (submission.status === 'imported') {
    return {
      label: 'Imported',
      detail: 'TenAceIQ read this scorecard and refreshed the match, player links, and ratings.',
      tone: 'green' as const,
    }
  }
  if (submission.status === 'verified') {
    return {
      label: 'Verified',
      detail: 'The parsed read was confirmed and contribution credit has been applied.',
      tone: 'green' as const,
    }
  }
  if (submission.status === 'rejected') {
    return {
      label: 'Rejected',
      detail: 'This batch will not be parsed. Upload a clearer supported TennisLink screenshot set.',
      tone: 'red' as const,
    }
  }
  if (submission.status === 'layout_detected') {
    return {
      label: 'Ready to scan',
      detail: 'Strong TennisLink layout signals were detected. Scorecards scan automatically when OCR is enabled.',
      tone: 'amber' as const,
    }
  }
  return {
    label: 'Needs review',
    detail: 'This upload is saved, but it needs stronger layout or OCR confidence before it can move forward.',
    tone: 'amber' as const,
  }
}

function formatDate(value: string) {
  if (!value) return 'Unknown date'
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

const pageStyle = (isMobile: boolean): CSSProperties => ({
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: 1280,
  margin: '0 auto',
  padding: isMobile ? '14px 12px 28px' : '20px 24px 38px',
  display: 'grid',
  gap: 18,
})

const heroStyle = (isTablet: boolean, isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.12fr) minmax(320px, 0.88fr)',
  gap: isMobile ? 14 : 18,
  alignItems: 'stretch',
})

const heroCopyStyle: CSSProperties = {
  borderRadius: 28,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
  padding: 'clamp(22px, 4vw, 38px)',
  display: 'grid',
  alignContent: 'center',
  gap: 16,
}

const titleStyle = (isSmallMobile: boolean): CSSProperties => ({
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: isSmallMobile ? 38 : 'clamp(2.55rem, 5vw, 4.5rem)',
  lineHeight: 0.96,
  fontWeight: 950,
  letterSpacing: 0,
  maxWidth: 760,
})

const heroTextStyle: CSSProperties = {
  margin: 0,
  maxWidth: 700,
  color: 'var(--shell-copy-muted)',
  fontSize: 17,
  lineHeight: 1.75,
  fontWeight: 700,
}

const heroActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const trustPanelStyle: CSSProperties = {
  borderRadius: 28,
  border: '1px solid var(--shell-panel-border)',
  background:
    'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-green) 15%, transparent) 0%, transparent 45%), var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-card)',
  padding: 18,
  display: 'grid',
  alignContent: 'center',
  gap: 12,
}

const trustStatStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  padding: 16,
  minHeight: 116,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
  textTransform: 'uppercase',
}

const workspaceStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.35fr) minmax(300px, 0.65fr)',
  gap: 18,
  alignItems: 'start',
})

const panelStyle: CSSProperties = {
  borderRadius: 24,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-card)',
  padding: 18,
  display: 'grid',
  gap: 14,
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
}

const sectionTitleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.1,
  fontWeight: 950,
}

const typeGridStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  gap: 10,
})

const typeButtonStyle = (active: boolean): CSSProperties => ({
  minHeight: 92,
  borderRadius: 18,
  border: active
    ? '1px solid color-mix(in srgb, var(--brand-green) 32%, var(--shell-panel-border) 68%)'
    : '1px solid var(--shell-panel-border)',
  background: active
    ? 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)'
    : 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: 14,
  textAlign: 'left',
  display: 'grid',
  gap: 6,
  cursor: 'pointer',
})

const dropzoneStyle = (status: string): CSSProperties => ({
  minHeight: 190,
  borderRadius: 22,
  border: status === 'rejected'
    ? '1px dashed rgba(248,113,113,0.55)'
    : '1px dashed color-mix(in srgb, var(--brand-blue-2) 42%, var(--shell-panel-border) 58%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-chip-bg) 93%)',
  color: 'var(--foreground-strong)',
  padding: 18,
  display: 'grid',
  placeItems: 'center',
  textAlign: 'center',
  gap: 8,
  cursor: 'pointer',
})

const fileInputStyle: CSSProperties = {
  display: 'none',
}

const dropzoneKickerStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const guardrailListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const guardrailStyle: CSSProperties = {
  minHeight: 32,
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 850,
}

const pillStyle: CSSProperties = {
  width: 'fit-content',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  padding: '7px 10px',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const confidenceMeterStyle: CSSProperties = {
  height: 12,
  borderRadius: 999,
  overflow: 'hidden',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const confidenceFillStyle = (value: number): CSSProperties => ({
  display: 'block',
  width: `${Math.round(value * 100)}%`,
  height: '100%',
  background: 'linear-gradient(90deg, var(--brand-blue-2), var(--brand-green))',
})

const impactBoxStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 14,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const achievementBoxStyle: CSSProperties = {
  ...impactBoxStyle,
  border: '1px solid color-mix(in srgb, var(--brand-green) 22%, var(--shell-panel-border) 78%)',
}

const tutorialPanelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 14,
  display: 'grid',
  gap: 10,
}

const tutorialGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: 10,
}

const tutorialStepStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  display: 'grid',
  gap: 6,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
}

const screenshotGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  gap: 12,
})

const submissionStatsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 10,
}

const submissionStatStyle: CSSProperties = {
  minHeight: 82,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 14,
  display: 'grid',
  gap: 6,
  alignContent: 'center',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const submissionListStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
  gap: 12,
}

const submissionCardStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 14,
  display: 'grid',
  gap: 10,
}

const submissionCardTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
}

const submissionMetaStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const scorecardReviewStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  display: 'grid',
  gap: 10,
}

const importPanelStyle: CSSProperties = {
  ...scorecardReviewStyle,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
}

const scorecardHeaderGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
  gap: 8,
}

const reviewFactStyle: CSSProperties = {
  minHeight: 58,
  borderRadius: 12,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 9,
  display: 'grid',
  gap: 4,
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const teamMatchupStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
  gap: 8,
  alignItems: 'center',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.35,
}

const parsedLineListStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
}

const parsedLineStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 9,
  display: 'grid',
  gridTemplateColumns: 'auto auto',
  gap: 6,
  color: 'var(--foreground-strong)',
  fontSize: 12,
}

const badgePanelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-green) 6%, var(--shell-chip-bg) 94%)',
  padding: 14,
  display: 'grid',
  gap: 12,
}

const badgeListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const badgeCardStyle: CSSProperties = {
  minHeight: 74,
  minWidth: 190,
  flex: '1 1 190px',
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-green) 22%, var(--shell-panel-border) 78%)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  display: 'grid',
  gap: 6,
  color: 'var(--foreground-strong)',
}

const badgeEmptyStyle: CSSProperties = {
  minHeight: 56,
  display: 'grid',
  alignItems: 'center',
  borderRadius: 14,
  border: '1px dashed var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
}

const screenshotCardStyle: CSSProperties = {
  borderRadius: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  overflow: 'hidden',
  display: 'grid',
  gridTemplateColumns: 'minmax(108px, 0.34fr) minmax(0, 0.66fr)',
}

const thumbnailWrapStyle: CSSProperties = {
  position: 'relative',
  minHeight: 190,
  background: 'var(--shell-panel-bg-strong)',
}

const thumbnailStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

const orderBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: 10,
  left: 10,
  width: 30,
  height: 30,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--brand-green)',
  color: 'var(--text-dark)',
  fontWeight: 950,
}

const screenshotBodyStyle: CSSProperties = {
  padding: 13,
  display: 'grid',
  gap: 9,
}

const screenshotHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  alignItems: 'flex-start',
}

const signalListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
}

const cardActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const smallButtonStyle: CSSProperties = {
  minHeight: 32,
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  color: 'var(--foreground-strong)',
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
}

const smallDangerButtonStyle: CSSProperties = {
  ...smallButtonStyle,
  border: '1px solid rgba(248,113,113,0.26)',
  color: '#fecaca',
}

const draftActionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'fit-content',
  minHeight: 44,
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 30%, var(--shell-panel-border) 70%)',
  background: 'linear-gradient(135deg, var(--brand-green) 0%, #4ade80 100%)',
  color: 'var(--text-dark)',
  padding: '0 16px',
  fontWeight: 950,
  textDecoration: 'none',
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
}

const disabledStyle: CSSProperties = {
  opacity: 0.52,
  cursor: 'not-allowed',
}

const pillGreenStyle: CSSProperties = {
  ...pillStyle,
}

const pillAmberStyle: CSSProperties = {
  ...pillStyle,
  border: '1px solid rgba(251,191,36,0.32)',
  background: 'rgba(251,191,36,0.12)',
  color: '#fde68a',
}

const pillDangerStyle: CSSProperties = {
  ...pillStyle,
  border: '1px solid rgba(248,113,113,0.32)',
  background: 'rgba(248,113,113,0.12)',
  color: '#fecaca',
}

const copyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 750,
}

const hintStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
}

const warningStyle: CSSProperties = {
  ...hintStyle,
  color: '#fde68a',
}

const noticeStyle: CSSProperties = {
  ...hintStyle,
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const emptyStateStyle: CSSProperties = {
  minHeight: 160,
  borderRadius: 18,
  border: '1px dashed var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  display: 'grid',
  placeItems: 'center',
  padding: 18,
  textAlign: 'center',
  fontWeight: 800,
}

const successStyle: CSSProperties = {
  color: '#bbf7d0',
  fontSize: 13,
  fontWeight: 900,
}

const errorStyle: CSSProperties = {
  color: '#fecaca',
  fontSize: 13,
  fontWeight: 900,
}
