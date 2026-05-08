'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import TiqLoader from '@/components/TiqLoader'
import {
  getMyDataAssistContributorStats,
  getDataAssistContributionValue,
  getDataAssistImportTypeLabel,
  deleteMyDataAssistSubmission,
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
import type { DataAssistScheduleParsedDraft } from '@/lib/data-assist-schedule-parser'
import type { DataAssistTeamSummaryParsedDraft } from '@/lib/data-assist-team-summary-parser'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const importTypes: Array<{
  id: DataAssistImportType
  label: string
  detail: string
  badge?: string
}> = [
  {
    id: 'scorecard',
    label: 'Scorecard',
    detail: 'Fastest path from a phone',
    badge: 'Recommended',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    detail: 'Optional season context',
  },
  {
    id: 'team_summary',
    label: 'Team summary',
    detail: 'Optional roster context',
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
  const [selectedFileCount, setSelectedFileCount] = useState(0)
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
  const [deletingSubmissionId, setDeletingSubmissionId] = useState('')
  const [bulkDeletingHistory, setBulkDeletingHistory] = useState(false)
  const [importResultsBySubmission, setImportResultsBySubmission] = useState<Record<string, DataAssistImportActionResult>>({})
  const [latestScan, setLatestScan] = useState<{
    batchId: string
    draftId: string
    parsedDraft: DataAssistScorecardParsedDraft | DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft
    autoAssessment?: DataAssistAutoAssessment
    autoImport?: DataAssistImportActionResult
  } | null>(null)
  const scanRunRef = useRef(0)

  const confidenceLabel = useMemo(() => {
    if (!summary) return 'Waiting for screenshots'
    if (summary.status === 'layout_detected') return 'Ready for review'
    if (summary.status === 'needs_review') return 'Review recommended'
    return 'Not supported'
  }, [summary])
  const hasPreparedScreenshots = Boolean(summary?.screenshots.length)
  const showUploadStep = !hasPreparedScreenshots && !saving && !latestScan
  const showOrderStep = hasPreparedScreenshots && !saving && !latestScan
  const showScanStep = saving
  const showLatestReviewStep = Boolean(latestScan)
  const showHistoryStep = !hasPreparedScreenshots && !saving && !latestScan
  const activeImportType = importTypes.find((item) => item.id === importType) || importTypes[0]

  function resetUploadFlow() {
    scanRunRef.current += 1
    setSummary(null)
    setLatestScan(null)
    setSavedBatchId('')
    setMessage('')
    setError('')
  }

  function updateImportType(nextType: DataAssistImportType) {
    setImportType(nextType)
    setSummary((current) => current ? summarizeDataAssistBatch(nextType, current.screenshots) : null)
    setSavedBatchId('')
    setMessage('')
    setError('')
  }

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
    if (!files.length) return
    setSelectedFileCount(files.length)
    setPreparing(true)
    setSavedBatchId('')
    setMessage(`Preparing ${files.length} screenshot${files.length === 1 ? '' : 's'}...`)
    setError('')

    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
      const preparedSummary = await prepareDataAssistBatch(files, importType)
      const existingScreenshots = summary?.screenshots || []
      const appendedScreenshots = [
        ...existingScreenshots,
        ...preparedSummary.screenshots.map((screenshot, index) => ({
          ...screenshot,
          uploadOrder: existingScreenshots.length + index + 1,
        })),
      ]
      const nextSummary = summarizeDataAssistBatch(importType, appendedScreenshots)
      setSummary(nextSummary)
      if (nextSummary.status === 'rejected') {
        setError(nextSummary.rejectionReason)
      } else if (nextSummary.status === 'needs_review') {
        setMessage(`${nextSummary.screenshots.length} screenshot${nextSummary.screenshots.length === 1 ? '' : 's'} staged. Add more if needed, then scan when the order looks right.`)
      } else {
        setMessage(`${nextSummary.screenshots.length} TennisLink screenshot${nextSummary.screenshots.length === 1 ? '' : 's'} staged. Add more if needed, then scan when ready.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Screenshots could not be prepared.')
    } finally {
      setPreparing(false)
      setSelectedFileCount(0)
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
    const draftSummary = summary
    if (!draftSummary || saving) return
    const scanRunId = scanRunRef.current + 1
    scanRunRef.current = scanRunId
    setSaving(true)
    setError('')
    setMessage('')
    setLatestScan(null)

    try {
      const result = await withTimeout(
        saveDataAssistDraftBatch(draftSummary),
        30_000,
        'Saving the screenshot is taking longer than expected. Check your connection and try scanning again.',
      )
      setSavedBatchId(result.batchId)
      const readiness = getDataAssistOcrReadiness()
      if ((draftSummary.requestedImportType === 'scorecard' || draftSummary.requestedImportType === 'schedule' || draftSummary.requestedImportType === 'team_summary') && readiness.canRun && readiness.provider === 'tesseract') {
        const readingLabel = draftSummary.requestedImportType === 'schedule'
          ? 'team schedule'
          : draftSummary.requestedImportType === 'team_summary'
            ? 'team roster'
            : 'scorecard'
        setMessage(`Draft saved with ${result.screenshotCount} screenshot${result.screenshotCount === 1 ? '' : 's'}. TenAceIQ is reading the ${readingLabel} now.`)
        const ocrResult = await withTimeout(
          queueDataAssistOcrVerification({
            batchId: result.batchId,
            draftId: result.draftId,
          }),
          30_000,
          `${draftSummary.requestedImportType === 'schedule' ? 'Schedule' : draftSummary.requestedImportType === 'team_summary' ? 'Team roster' : 'Scorecard'} reading is taking longer than expected. The draft was saved; try scanning it again from history in a moment.`,
        )
        if (scanRunRef.current !== scanRunId) return
        setLatestScan({
          batchId: result.batchId,
          draftId: result.draftId,
          parsedDraft: ocrResult.parsedDraft,
          autoAssessment: ocrResult.autoAssessment,
          autoImport: ocrResult.autoImport,
        })
        setMessage(isScheduleParsedDraft(ocrResult.parsedDraft)
          ? ocrResult.autoImport?.ok
            ? ocrResult.autoImport.message || 'Team schedule imported.'
            : 'Team schedule read complete. Review the visible matches before import.'
          : isTeamSummaryParsedDraft(ocrResult.parsedDraft)
            ? ocrResult.autoImport?.ok
              ? ocrResult.autoImport.message || 'Team roster imported.'
              : 'Team summary read complete. Review the roster before import.'
          : getAutoAssessmentMessage(ocrResult.autoAssessment, ocrResult.autoImport))
        window.setTimeout(() => {
          document.getElementById('latest-data-assist-read')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 120)
      } else {
        if (scanRunRef.current !== scanRunId) return
        setMessage(`Data Assist draft saved with ${result.screenshotCount} stored screenshot${result.screenshotCount === 1 ? '' : 's'}. Nothing has been imported yet.`)
      }
      if (scanRunRef.current === scanRunId) setSaving(false)
      void refreshSubmissions()
    } catch (err) {
      if (scanRunRef.current === scanRunId) {
        setError(err instanceof Error ? err.message : 'Data Assist draft could not be saved.')
      }
    } finally {
      if (scanRunRef.current === scanRunId) setSaving(false)
    }
  }

  async function reviewLatestScan(decision: 'confirmed' | 'flagged') {
    if (!latestScan || reviewingSubmissionId) return
    setReviewingSubmissionId(latestScan.batchId)
    setMessage('')
    setError('')

    try {
      const result = await reviewMyDataAssistOcrDraft({
        batchId: latestScan.batchId,
        draftId: latestScan.draftId,
        decision,
      })
      setMessage(result.message || (decision === 'confirmed'
        ? 'Scorecard confirmed. TenAceIQ is preparing this result.'
        : 'Thanks. This scorecard is marked for a closer look.'))
      setLatestScan(null)
      setSummary(null)
      setSavedBatchId('')
      await refreshSubmissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this scorecard review.')
    } finally {
      setReviewingSubmissionId('')
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
        : 'Thanks. This scorecard is marked for a closer look.'))
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

  async function deleteSubmission(submission: DataAssistSubmission) {
    if (deletingSubmissionId) return
    if (!window.confirm('Remove this Data Assist draft from your history?')) return

    setDeletingSubmissionId(submission.id)
    setMessage('')
    setError('')

    try {
      const result = await deleteMyDataAssistSubmission(submission.id)
      setMessage(result.message)
      setSubmissions((current) => current.filter((item) => item.id !== submission.id))
      await refreshSubmissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this Data Assist draft.')
    } finally {
      setDeletingSubmissionId('')
    }
  }

  async function deleteAllDraftSubmissions() {
    if (bulkDeletingHistory) return
    const removableSubmissions = submissions.filter((submission) => submission.status !== 'imported')
    if (!removableSubmissions.length) {
      setMessage('No removable drafts in history. Imported items stay available as references.')
      return
    }
    if (!window.confirm(`Remove ${removableSubmissions.length} saved draft${removableSubmissions.length === 1 ? '' : 's'} from your Data Assist history? Imported items will stay.`)) return

    setBulkDeletingHistory(true)
    setMessage('')
    setError('')

    try {
      for (const submission of removableSubmissions) {
        await deleteMyDataAssistSubmission(submission.id)
      }
      setMessage(`Removed ${removableSubmissions.length} saved draft${removableSubmissions.length === 1 ? '' : 's'}. Imported references stayed in history.`)
      setSubmissions((current) => current.filter((submission) => submission.status === 'imported'))
      await refreshSubmissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove all saved drafts.')
    } finally {
      setBulkDeletingHistory(false)
    }
  }

  return (
    <section style={pageStyle(isMobile)}>
      <section style={heroStyle(isMobile)}>
        <div style={heroCopyStyle}>
          <div className="section-kicker">TenAceIQ Data Assist</div>
          <h1 style={titleStyle(isSmallMobile)}>Import from your phone.</h1>
          <p style={heroTextStyle}>
            A scorecard screenshot is enough to start. Add schedule or roster screenshots later only when they are easy to capture.
          </p>
          <div style={heroActionRowStyle}>
            <a href="#upload" style={primaryButtonStyle}>Start upload</a>
            <Link href="/messages?compose=support&category=data&subject=Data%20Assist%20question" style={secondaryButtonStyle}>
              Ask support
            </Link>
          </div>
        </div>
      </section>

      {!showOrderStep && message ? <div style={successStyle}>{message}</div> : null}
      {!showOrderStep && error ? <div style={errorStyle}>{error}</div> : null}

      <section style={workspaceStyle(isTablet)}>
        {showUploadStep ? (
          <section id="upload" style={panelStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <StepBadge step={1} label="Select type" />
                <h2 style={sectionTitleStyle}>What are you uploading?</h2>
                <p style={copyStyle}>Pick the TennisLink page so TenAceIQ uses the right reader.</p>
              </div>
              <span style={pillStyle}>{authResolved && userId ? 'Signed in' : 'Sign in needed'}</span>
            </div>

            <label style={typeSelectWrapStyle}>
              <span>Upload type</span>
              <select
                value={importType}
                onChange={(event) => updateImportType(event.target.value as DataAssistImportType)}
                style={typeSelectStyle}
              >
                {importTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}{item.badge ? ` - ${item.badge}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div style={typeSelectedCardStyle}>
              <span style={typeButtonHeaderStyle}>
                <strong>{activeImportType.label}</strong>
                {activeImportType.badge ? <small style={typeRecommendedBadgeStyle}>{activeImportType.badge}</small> : null}
              </span>
              <span>{activeImportType.detail}</span>
            </div>

            <div style={stepDividerStyle}>
              <StepBadge step={2} label="Add screenshots" />
              <strong>Add one or more screenshots</strong>
            </div>

            <label style={dropzoneStyle(summary?.status || '')}>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(event) => void handleFiles(event)}
                style={fileInputStyle}
              />
              <span style={dropzoneKickerStyle}>TennisLink screenshots only</span>
              <strong>{preparing ? `Preparing ${selectedFileCount || ''} screenshot${selectedFileCount === 1 ? '' : 's'}...` : 'Tap to choose screenshots'}</strong>
              <small>{getUploadHint(importType)}</small>
            </label>

            {!hasPreparedScreenshots ? (
              <>
                <div style={simpleHelpStyle}>
                  <strong>{getUploadHelpTitle(importType)}</strong>
                  <span>{getUploadHelpText(importType)}</span>
                </div>
              </>
            ) : null}

            {!authResolved || !userId ? (
              <div style={noticeStyle}>
                Sign in before saving a Data Assist draft. You can still stage screenshots on this screen.
              </div>
            ) : null}
          </section>
        ) : null}

      </section>

      {showOrderStep ? (
      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <StepBadge step={3} label="Scan setup" />
            <h2 style={sectionTitleStyle}>Ready to scan.</h2>
            <p style={copyStyle}>{summary ? getScanSetupText(summary.requestedImportType, summary.screenshots.length) : 'Screenshots are staged.'}</p>
          </div>
          {summary ? <span style={pillStyle}>{summary.screenshots.length} screenshot{summary.screenshots.length === 1 ? '' : 's'}</span> : null}
        </div>

        <label style={compactDropzoneStyle}>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(event) => void handleFiles(event)}
            style={fileInputStyle}
          />
          <span style={dropzoneKickerStyle}>Add screenshots</span>
          <strong>{preparing ? `Preparing ${selectedFileCount || ''}...` : 'Add another or select several'}</strong>
          <small>Use this when a phone screenshot only captures part of the TennisLink table.</small>
        </label>

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
            {saving ? `Reading ${summary?.requestedImportType === 'schedule' ? 'schedule' : summary?.requestedImportType === 'team_summary' ? 'roster' : 'scorecard'}...` : 'Scan now'}
          </button>
          <button type="button" onClick={resetUploadFlow} style={secondaryButtonStyle}>Start over</button>
          <span style={hintStyle}>Clean reads import automatically. Anything uncertain stops here for review.</span>
        </div>

        {saving ? (
          <div style={scanLoadingStyle}>
            <TiqLoader label="Preparing review" size="sm" />
            <p style={scanLoadingCopyStyle}>
              TenAceIQ is reading the screenshot and building a draft for review.
            </p>
          </div>
        ) : null}

        {savedBatchId ? (
          <div style={successStyle}>Draft saved: {savedBatchId.slice(0, 8).toUpperCase()}</div>
        ) : null}
        {message ? <div style={successStyle}>{message}</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}
      </section>
      ) : null}

      {showScanStep ? (
        <section style={panelStyle}>
          <div style={scanLoadingStyle}>
            <TiqLoader label="Preparing review" size="sm" />
            <p style={scanLoadingCopyStyle}>
              TenAceIQ is reading the screenshot and building a draft for review.
            </p>
          </div>
        </section>
      ) : null}

        {showLatestReviewStep && latestScan ? (
          <section id="latest-data-assist-read" style={latestReadStyle}>
            {latestScan.autoImport?.importPreview?.duplicateMatch ? (
              <DuplicateImportBanner
                matchId={isScorecardParsedDraft(latestScan.parsedDraft) ? latestScan.parsedDraft.externalMatchId : ''}
                message={latestScan.autoImport.message}
              />
            ) : null}
            <div style={submissionCardTopStyle}>
              <div>
                <StepBadge step={4} label={getLatestReadStepLabel(latestScan)} />
                <strong>{getLatestReadTitle(latestScan)}</strong>
                <p style={copyStyle}>{getLatestReadDescription(latestScan)}</p>
              </div>
              <span style={latestScan.autoImport?.ok || latestScan.autoImport?.importPreview?.duplicateMatch || isParsedDraftReady(latestScan.parsedDraft) ? pillGreenStyle : pillAmberStyle}>
                {latestScan.autoImport?.ok
                  ? 'Imported'
                  : latestScan.autoImport?.importPreview?.duplicateMatch
                    ? 'Already imported'
                    : isParsedDraftReady(latestScan.parsedDraft)
                      ? 'Ready'
                      : 'Needs check'}
              </span>
            </div>
            {isTeamSummaryParsedDraft(latestScan.parsedDraft) && latestScan.autoImport?.ok ? (
              <TeamSummaryImportedPanel result={latestScan.autoImport} parsedDraft={latestScan.parsedDraft} />
            ) : isScheduleParsedDraft(latestScan.parsedDraft) && latestScan.autoImport?.ok ? (
              <ScheduleImportedSummaryPanel result={latestScan.autoImport} parsedDraft={latestScan.parsedDraft} />
            ) : latestScan.autoImport?.importPreview?.duplicateMatch && isScorecardParsedDraft(latestScan.parsedDraft) ? (
              <ImportedSummaryPanel
                summary={{
                  importedAt: new Date().toISOString(),
                  linkedPlayers: 0,
                  createdPlayers: 0,
                  lineCount: latestScan.parsedDraft.lineCount || latestScan.parsedDraft.lines.length,
                  message: latestScan.autoImport.message,
                  duplicate: true,
                }}
                parsedDraft={latestScan.parsedDraft}
              />
            ) : isScheduleParsedDraft(latestScan.parsedDraft) ? (
              <ScheduleReviewPanel parsedDraft={latestScan.parsedDraft} />
            ) : isTeamSummaryParsedDraft(latestScan.parsedDraft) ? (
              <TeamSummaryReviewPanel parsedDraft={latestScan.parsedDraft} />
            ) : (
              <ScorecardReviewPanel
                parsedDraft={latestScan.parsedDraft}
                canReview={Boolean(latestScan.autoAssessment?.memberConfirmationRequired && canConfirmScorecardRead(latestScan.parsedDraft))}
                busy={reviewingSubmissionId === latestScan.batchId}
                onConfirm={() => void reviewLatestScan('confirmed')}
                onFlag={() => void reviewLatestScan('flagged')}
              />
            )}
            <div style={draftActionRowStyle}>
              <button type="button" onClick={resetUploadFlow} style={primaryButtonStyle}>Upload another</button>
            </div>
          </section>
        ) : null}

      {showHistoryStep ? (
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
        deletingSubmissionId={deletingSubmissionId}
        bulkDeleting={bulkDeletingHistory}
        importResultsBySubmission={importResultsBySubmission}
        onRunImport={(submission, action) => void runSubmissionImport(submission, action)}
        onDeleteSubmission={(submission) => void deleteSubmission(submission)}
        onDeleteAllDrafts={() => void deleteAllDraftSubmissions()}
      />
      ) : null}
    </section>
  )
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs)
    promise
      .then((value) => {
        window.clearTimeout(timeout)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timeout)
        reject(error)
      })
  })
}

function getAutoAssessmentMessage(
  assessment: DataAssistAutoAssessment | undefined,
  autoImport: DataAssistImportActionResult | undefined,
) {
  if (autoImport?.ok && autoImport.action === 'commit') {
    return autoImport.message || 'Scorecard read complete. TenAceIQ imported this result automatically.'
  }
  if (autoImport && !autoImport.ok) {
    return `Scorecard read complete, but automatic import paused: ${autoImport.message}`
  }
  if (!assessment) {
    return 'Scorecard read complete. Review the parsed draft before any import is committed.'
  }
  if (assessment.decision === 'auto_ready') {
    return 'Scorecard read complete. This scorecard passed auto-checks and is ready without admin review.'
  }
  if (assessment.decision === 'member_confirm') {
    return 'Scorecard read complete. TenAceIQ found a usable scorecard draft; confirm the read before import.'
  }
  if (assessment.decision === 'admin_exception') {
    return 'Scorecard read complete. Some details need a closer look before import.'
  }
  return 'TenAceIQ could not safely read this scorecard. Try a cleaner crop of the scorecard area.'
}

function getUploadHint(importType: DataAssistImportType) {
  if (importType === 'schedule') return 'Optional. Use this only if the Match Schedule tab is easy to capture.'
  if (importType === 'team_summary') return 'Optional. Use this only if the roster section is visible.'
  return 'Use the Score Card tab. One clear table screenshot is enough when the full match is visible.'
}

function getUploadHelpTitle(importType: DataAssistImportType) {
  if (importType === 'schedule') return 'Best schedule screenshot'
  if (importType === 'team_summary') return 'Best roster screenshot'
  return 'Best scorecard screenshot'
}

function getUploadHelpText(importType: DataAssistImportType) {
  if (importType === 'schedule') {
    return 'Many phones make this hard. Skip it unless dates, teams, and sites are visible in one or two screenshots.'
  }
  if (importType === 'team_summary') {
    return 'Helpful for full rosters, but not required. Scorecards still create match and player records.'
  }
  return 'Capture the match header, all lines, scores, and winner check marks. If the table is tall, add screenshots from top to bottom.'
}

function getScanSetupText(importType: DataAssistImportType, screenshotCount: number) {
  const plural = screenshotCount === 1 ? 'screenshot' : 'screenshots'
  if (importType === 'schedule') return `${screenshotCount} ${plural} staged. TenAceIQ will read the visible schedule rows.`
  if (importType === 'team_summary') return `${screenshotCount} ${plural} staged. TenAceIQ will read roster names and ratings.`
  return `${screenshotCount} ${plural} staged. TenAceIQ will read the match result, line players, scores, and winners.`
}

function getLatestReadStepLabel(scan: {
  parsedDraft: DataAssistScorecardParsedDraft | DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft
  autoImport?: DataAssistImportActionResult
}) {
  if (scan.autoImport?.ok) return 'Import complete'
  if (scan.autoImport?.importPreview?.duplicateMatch) return 'Already imported'
  return 'Review read'
}

function getLatestReadTitle(scan: {
  parsedDraft: DataAssistScorecardParsedDraft | DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft
  autoImport?: DataAssistImportActionResult
}) {
  if (scan.autoImport?.ok) {
    if (isTeamSummaryParsedDraft(scan.parsedDraft)) return 'Team roster imported'
    if (isScheduleParsedDraft(scan.parsedDraft)) return 'Team schedule imported'
    return 'Scorecard imported'
  }
  if (scan.autoImport?.importPreview?.duplicateMatch) return 'Scorecard already imported'
  if (isScheduleParsedDraft(scan.parsedDraft)) return 'Check the team schedule'
  if (isTeamSummaryParsedDraft(scan.parsedDraft)) return 'Check the team roster'
  return 'Check the scorecard read'
}

function getLatestReadDescription(scan: {
  parsedDraft: DataAssistScorecardParsedDraft | DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft
  autoImport?: DataAssistImportActionResult
}) {
  if (scan.autoImport?.ok) {
    if (isTeamSummaryParsedDraft(scan.parsedDraft)) {
      return 'Roster names and starting ratings are now available across TenAceIQ.'
    }
    if (isScheduleParsedDraft(scan.parsedDraft)) {
      return 'Visible schedule rows are now available for team and captain planning.'
    }
    return 'Match results, player links, line winners, and team score are ready now. Schedule and roster context can be added later.'
  }
  if (scan.autoImport?.importPreview?.duplicateMatch) {
    return 'TenAceIQ found this TennisLink match in your records and kept the existing result.'
  }
  if (isScheduleParsedDraft(scan.parsedDraft)) {
    return 'TenAceIQ found a team schedule screenshot. Review the visible match rows before importing.'
  }
  if (isTeamSummaryParsedDraft(scan.parsedDraft)) {
    return 'TenAceIQ found a team summary screenshot. Review roster names and ratings before importing.'
  }
  return getScorecardReviewLead(scan.parsedDraft)
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
  deletingSubmissionId,
  bulkDeleting,
  importResultsBySubmission,
  onRunImport,
  onDeleteSubmission,
  onDeleteAllDrafts,
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
  deletingSubmissionId: string
  bulkDeleting: boolean
  importResultsBySubmission: Record<string, DataAssistImportActionResult>
  onRunImport: (submission: DataAssistSubmission, action: 'preview' | 'commit') => void
  onDeleteSubmission: (submission: DataAssistSubmission) => void
  onDeleteAllDrafts: () => void
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const pendingCount = contributorStats?.pendingReviewCount ?? submissions.filter((submission) => submission.status !== 'verified' && submission.status !== 'imported' && submission.status !== 'rejected').length
  const verifiedCount = contributorStats?.verifiedImportCount ?? submissions.filter((submission) => submission.status === 'verified' || submission.status === 'imported').length
  const rejectedCount = contributorStats?.rejectedImportCount ?? submissions.filter((submission) => submission.status === 'rejected').length
  const accuracyScore = Math.round((contributorStats?.contributionAccuracyScore ?? 0) * 100)
  const removableCount = submissions.filter((submission) => submission.status !== 'imported').length

  return (
    <section style={panelStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <div className="section-kicker">History</div>
          <h2 style={sectionTitleStyle}>Saved Data Assist drafts.</h2>
        </div>
        <div style={cardActionRowStyle}>
          <button type="button" onClick={() => setHistoryOpen((current) => !current)} style={smallButtonStyle}>
            {historyOpen ? 'Hide history' : `Show history${submissions.length ? ` (${submissions.length})` : ''}`}
          </button>
          <button type="button" onClick={onRefresh} disabled={!authResolved || !userId || loading} style={smallButtonStyle}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={onDeleteAllDrafts}
            disabled={!authResolved || !userId || loading || bulkDeleting || removableCount === 0}
            style={{ ...smallDangerButtonStyle, ...((!authResolved || !userId || loading || bulkDeleting || removableCount === 0) ? disabledStyle : {}) }}
          >
            {bulkDeleting ? 'Removing...' : 'Remove all drafts'}
          </button>
        </div>
      </div>

      {!authResolved || !userId ? (
        <div style={noticeStyle}>Sign in to track your Data Assist submissions and review status.</div>
      ) : !historyOpen ? (
        <div style={historyCollapsedStyle}>
          {submissions.length
            ? `${submissions.length} saved draft${submissions.length === 1 ? '' : 's'} in history.`
            : 'No saved drafts yet.'}
        </div>
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
            {submissions.map((submission) => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                busy={reviewingSubmissionId === submission.id}
                onReview={onReviewSubmission}
                importing={importingSubmissionId === submission.id}
                deleting={deletingSubmissionId === submission.id}
                importResult={importResultsBySubmission[submission.id]}
                onRunImport={onRunImport}
                onDelete={onDeleteSubmission}
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

function StepBadge({ step, label }: { step: number; label: string }) {
  return (
    <div style={stepBadgeStyle}>
      <span style={stepBadgeNumberStyle}>{step}</span>
      <strong>{label}</strong>
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
  deleting,
  importResult,
  onRunImport,
  onDelete,
}: {
  submission: DataAssistSubmission
  busy: boolean
  onReview: (submission: DataAssistSubmission, decision: 'confirmed' | 'flagged') => void
  importing: boolean
  deleting: boolean
  importResult?: DataAssistImportActionResult
  onRunImport: (submission: DataAssistSubmission, action: 'preview' | 'commit') => void
  onDelete: (submission: DataAssistSubmission) => void
}) {
  const status = getSubmissionStatusCopy(submission)
  const reviewNote = submission.draftReviewNote || submission.reviewNote || submission.rejectionReason
  const parsedDraft = toScorecardParsedDraft(submission.parsedPayload)
  const parsedSchedule = toScheduleParsedDraft(submission.parsedPayload)
  const parsedTeamSummary = toTeamSummaryParsedDraft(submission.parsedPayload)
  const importSummary = getSubmissionImportSummary(submission)
  const isImported = submission.status === 'imported'
  const [detailsOpen, setDetailsOpen] = useState(!isImported)
  const canReviewParsedDraft =
    parsedDraft &&
    !isImported &&
    submission.draftId &&
    submission.draftOcrStatus === 'processed' &&
    submission.draftStatus === 'ready_for_verification' &&
    canConfirmScorecardRead(parsedDraft) &&
    (submission.status === 'ready_to_import' || submission.status === 'needs_review')
  const canPreviewImport = Boolean(parsedDraft && submission.draftId && submission.status === 'verified' && !isImported)
  const canCommitImport = Boolean(canPreviewImport && submission.status === 'verified')
  const canDelete = !isImported

  return (
    <article style={submissionCardStyle}>
      <div style={submissionCardTopStyle}>
        <div>
          <strong>{getDataAssistImportTypeLabel(submission.requestedImportType)}</strong>
          <p style={copyStyle}>
            {formatDate(submission.createdAt)} - {submission.screenshotCount} screenshot{submission.screenshotCount === 1 ? '' : 's'} - {Math.round(submission.confidenceScore * 100)}% confidence
          </p>
        </div>
        <div style={cardActionRowStyle}>
          <span style={status.tone === 'green' ? pillGreenStyle : status.tone === 'red' ? pillDangerStyle : pillAmberStyle}>
            {status.label}
          </span>
          {isImported ? (
            <button type="button" onClick={() => setDetailsOpen((current) => !current)} style={smallButtonStyle}>
              {detailsOpen ? 'Collapse' : 'Open'}
            </button>
          ) : null}
        </div>
      </div>
      {isImported && !detailsOpen ? (
        <p style={copyStyle}>
          Imported reference saved. Open it when you need the parsed details from this upload.
        </p>
      ) : null}
      {detailsOpen ? (
        <>
          {!isImported ? <p style={copyStyle}>{status.detail}</p> : null}
          {!isImported && reviewNote ? <p style={warningStyle}>{reviewNote}</p> : null}
          {parsedDraft && !isImported ? (
            <ScorecardReviewPanel
              parsedDraft={parsedDraft}
              canReview={Boolean(canReviewParsedDraft)}
              busy={busy}
              onConfirm={() => onReview(submission, 'confirmed')}
              onFlag={() => onReview(submission, 'flagged')}
            />
          ) : null}
          {parsedSchedule && !isImported ? (
            <ScheduleReviewPanel parsedDraft={parsedSchedule} />
          ) : null}
          {parsedTeamSummary && !isImported ? (
            <TeamSummaryReviewPanel parsedDraft={parsedTeamSummary} />
          ) : null}
          {isImported && parsedTeamSummary ? (
            <TeamSummaryImportedPanel
              result={{
                ok: true,
                action: 'commit',
                message: importSummary.message,
              }}
              parsedDraft={parsedTeamSummary}
            />
          ) : isImported && parsedSchedule ? (
            <ScheduleImportedSummaryPanel
              result={{
                ok: true,
                action: 'commit',
                message: importSummary.message,
              }}
              parsedDraft={parsedSchedule}
            />
          ) : isImported ? (
            <ImportedSummaryPanel summary={importSummary} parsedDraft={parsedDraft} />
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
        </>
      ) : null}
      {canDelete && detailsOpen ? (
        <div style={cardActionRowStyle}>
          <button
            type="button"
            onClick={() => onDelete(submission)}
            disabled={deleting}
            style={{ ...smallDangerButtonStyle, ...(deleting ? disabledStyle : {}) }}
          >
            {deleting ? 'Removing...' : 'Remove draft'}
          </button>
        </div>
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
  const isDuplicate = Boolean(preview?.duplicateMatch)
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
            <ReviewFact label="Status" value={isDuplicate ? 'Already imported' : unresolvedWinnerCount ? `${unresolvedWinnerCount} unresolved` : 'Ready'} />
            <ReviewFact label="Players" value={newPlayers ? `${newPlayers} new` : likelyPlayers ? `${likelyPlayers} likely` : 'Matched'} />
          </div>
          {isDuplicate ? (
            <div style={readyImportNoteStyle}>
              <strong>Duplicate found</strong>
              <span>This TennisLink match is already in TenAceIQ. Import will not create a second result.</span>
            </div>
          ) : null}
          <div style={parsedLineListStyle}>
            {preview.playerMappings.slice(0, 6).map((mapping) => (
              <div key={mapping.name} style={parsedLineStyle}>
                <span>{mapping.name}</span>
                <strong>{mapping.status}</strong>
                <small>{mapping.matchedPlayerName || 'Will be created from TennisLink name'}</small>
              </div>
            ))}
          </div>
          {result?.importResult?.kind === 'scorecard' && result.importResult.result.rows[0]?.message ? (
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

function ImportedSummaryPanel({
  summary,
  parsedDraft,
}: {
  summary: SubmissionImportSummary
  parsedDraft: DataAssistScorecardParsedDraft | null
}) {
  const lineCount = summary.lineCount || parsedDraft?.lineCount || parsedDraft?.lines.length || 0
  const teamScore = parsedDraft ? getParsedTeamScore(parsedDraft) : null
  const playerValue = !summary.linkedPlayers && !summary.createdPlayers
    ? 'Refreshed'
    : summary.createdPlayers
    ? `${summary.linkedPlayers} linked, ${summary.createdPlayers} new`
    : `${summary.linkedPlayers} linked`

  return (
    <div style={importPanelStyle}>
      <div style={submissionCardTopStyle}>
        <div>
          <strong>{summary.duplicate ? 'Already imported' : 'Import complete'}</strong>
          <p style={copyStyle}>
            {summary.duplicate
              ? 'This TennisLink match was already in TenAceIQ, so no duplicate result was created.'
              : 'This scorecard is enough to power match results, player links, line winners, and team analytics now.'}
          </p>
        </div>
        <span style={pillGreenStyle}>Done</span>
      </div>
      <div style={scorecardHeaderGridStyle}>
        <ReviewFact label="Result" value={teamScore ? `${teamScore.home}-${teamScore.away}` : 'Imported'} />
        <ReviewFact label="Lines" value={String(lineCount)} />
        <ReviewFact label="Players" value={playerValue} />
        <ReviewFact label="Imported" value={summary.importedAt ? formatDate(summary.importedAt) : 'Complete'} />
      </div>
      <div style={readyImportNoteStyle}>
        <strong>{summary.duplicate ? 'Duplicate protected' : 'Scorecard-first ready'}</strong>
        <span>{summary.message || (summary.duplicate
          ? 'The existing TenAceIQ result was kept.'
          : 'Schedule and roster uploads can enrich this later, but this result is ready now.')}</span>
      </div>
    </div>
  )
}

function DuplicateImportBanner({
  matchId,
  message,
}: {
  matchId: string
  message: string
}) {
  return (
    <div style={duplicateBannerStyle}>
      <div>
        <strong>Already in TenAceIQ</strong>
        <p>This upload matches TennisLink match {matchId}. No duplicate result was created.</p>
      </div>
      <span>{message}</span>
    </div>
  )
}

function ScheduleReviewPanel({ parsedDraft }: { parsedDraft: DataAssistScheduleParsedDraft }) {
  const needsCheckCount = parsedDraft.matches.filter((match) => match.reviewNotes.length).length

  return (
    <div style={scorecardReviewStyle}>
      <div style={scorecardHeaderGridStyle}>
        <ReviewFact label="Team" value={parsedDraft.teamName || 'Check team'} />
        <ReviewFact label="League" value={parsedDraft.leagueName || 'Check league'} />
        <ReviewFact label="Flight" value={parsedDraft.flight || 'Check flight'} />
        <ReviewFact label="Matches" value={String(parsedDraft.matchCount)} />
      </div>
      <p style={copyStyle}>
        This is a team schedule read. TenAceIQ is capturing the visible match IDs, dates, times, opponents, and sites for this team.
      </p>
      <div style={parsedLineListStyle}>
        {parsedDraft.matches.map((match) => (
          <div key={match.externalMatchId} style={scheduleMatchRowStyle}>
            <div style={parsedLineMainStyle}>
              <span style={lineHeaderStyle}>
                {match.externalMatchId || 'Match'}
                {match.reviewNotes.length ? <small style={lineCheckStyle}>Review</small> : null}
              </span>
              <strong style={lineScoreStyle}>{match.matchDate || 'Check date'}</strong>
            </div>
            <div style={scheduleMatchGridStyle}>
              <ReviewFact label="Time" value={match.matchTime || 'Check time'} />
              <ReviewFact label="Home" value={match.homeTeam || 'Check home team'} />
              <ReviewFact label="Visiting" value={match.awayTeam || 'Check visiting team'} />
              <ReviewFact label="Site" value={match.facility || 'Check site'} />
            </div>
          </div>
        ))}
      </div>
      <div style={needsCheckCount ? reviewChecklistStyle : readyImportNoteStyle}>
        <strong>{needsCheckCount ? 'Before importing' : 'Schedule ready'}</strong>
        <span>{needsCheckCount ? `${needsCheckCount} visible match row${needsCheckCount === 1 ? '' : 's'} need review.` : 'Visible team schedule rows are captured for one final check.'}</span>
      </div>
    </div>
  )
}

function ScheduleImportedSummaryPanel({
  result,
  parsedDraft,
}: {
  result: DataAssistImportActionResult
  parsedDraft: DataAssistScheduleParsedDraft
}) {
  const scheduleResult = result.importResult?.kind === 'schedule' ? result.importResult.result : null
  const imported = scheduleResult ? scheduleResult.successCount + scheduleResult.updatedCount : parsedDraft.matchCount
  const updated = scheduleResult?.updatedCount ?? 0

  return (
    <div style={importPanelStyle}>
      <div style={submissionCardTopStyle}>
        <div>
          <strong>Schedule imported</strong>
          <p style={copyStyle}>
            Scheduled matches are now available for league, team, and captain planning views.
          </p>
        </div>
        <span style={pillGreenStyle}>Done</span>
      </div>
      <div style={scorecardHeaderGridStyle}>
        <ReviewFact label="Team" value={parsedDraft.teamName || 'Team schedule'} />
        <ReviewFact label="Matches" value={String(imported)} />
        <ReviewFact label="Updated" value={String(updated)} />
        <ReviewFact label="League" value={parsedDraft.leagueName || 'Imported'} />
      </div>
      <div style={readyImportNoteStyle}>
        <strong>All set</strong>
        <span>{result.message || 'Team schedule imported to TenAceIQ.'}</span>
      </div>
    </div>
  )
}

function TeamSummaryReviewPanel({ parsedDraft }: { parsedDraft: DataAssistTeamSummaryParsedDraft }) {
  const missingRatingCount = parsedDraft.players.filter((player) => player.ntrp === null).length

  return (
    <div style={scorecardReviewStyle}>
      <div style={scorecardHeaderGridStyle}>
        <ReviewFact label="Team" value={parsedDraft.rosterTeamName || 'Check team'} />
        <ReviewFact label="League" value={parsedDraft.leagueName || 'Check league'} />
        <ReviewFact label="Flight" value={parsedDraft.flight || 'Check flight'} />
        <ReviewFact label="Players" value={String(parsedDraft.playerCount)} />
      </div>
      <p style={copyStyle}>
        TenAceIQ is capturing roster player names and starting NTRP ratings for team and captain workflows.
      </p>
      <div style={parsedLineListStyle}>
        {parsedDraft.players.map((player) => (
          <div key={`${player.name}-${player.ntrp ?? 'rating'}`} style={scheduleMatchRowStyle}>
            <div style={parsedLineMainStyle}>
              <span style={lineHeaderStyle}>
                {player.name}
                {player.ntrp === null ? <small style={lineCheckStyle}>Review</small> : null}
              </span>
              <strong style={lineScoreStyle}>{player.ntrp === null ? 'Check rating' : player.ntrp.toFixed(1)}</strong>
            </div>
            <div style={scheduleMatchGridStyle}>
              <ReviewFact label="Team" value={player.teamName || parsedDraft.rosterTeamName || 'Check team'} />
            </div>
          </div>
        ))}
      </div>
      <div style={missingRatingCount ? reviewChecklistStyle : readyImportNoteStyle}>
        <strong>{missingRatingCount ? 'Before importing' : 'Roster ready'}</strong>
        <span>{missingRatingCount ? `${missingRatingCount} player rating${missingRatingCount === 1 ? '' : 's'} need review.` : 'Roster names and ratings are captured for import.'}</span>
      </div>
    </div>
  )
}

function TeamSummaryImportedPanel({
  result,
  parsedDraft,
}: {
  result: DataAssistImportActionResult
  parsedDraft: DataAssistTeamSummaryParsedDraft
}) {
  const rosterResult = result.importResult?.kind === 'team_summary' ? result.importResult.result : null

  return (
    <div style={importPanelStyle}>
      <div style={submissionCardTopStyle}>
        <div>
          <strong>Roster imported</strong>
          <p style={copyStyle}>
            Team roster records and starting ratings are now available for player, team, and captain tools.
          </p>
        </div>
        <span style={pillGreenStyle}>Done</span>
      </div>
      <div style={scorecardHeaderGridStyle}>
        <ReviewFact label="Team" value={parsedDraft.rosterTeamName || 'Team roster'} />
        <ReviewFact label="Players" value={String(rosterResult?.totalPlayers ?? parsedDraft.playerCount)} />
        <ReviewFact label="Created" value={String(rosterResult?.createdCount ?? 0)} />
        <ReviewFact label="Updated" value={String(rosterResult?.updatedCount ?? 0)} />
      </div>
      <div style={readyImportNoteStyle}>
        <strong>All set</strong>
        <span>{result.message || 'Team roster imported to TenAceIQ.'}</span>
      </div>
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
  const reviewItems = getScorecardReviewItems(parsedDraft)
  const winnerCount = parsedDraft.lines.filter((line) => line.winner === 'home' || line.winner === 'away').length
  const teamScore = getParsedTeamScore(parsedDraft)
  const requiredReady = getBlockingScorecardReviewItems(parsedDraft).length === 0

  return (
    <div style={scorecardReviewStyle}>
      <div style={scorecardHeaderGridStyle}>
        <ReviewFact label="Match" value={parsedDraft.externalMatchId || 'Needs read'} />
        <ReviewFact label="Date" value={parsedDraft.matchDate || 'Needs read'} />
        <ReviewFact label="Lines" value={String(parsedDraft.lineCount || parsedDraft.lines.length)} />
        <ReviewFact label="Result" value={teamScore ? `${teamScore.home}-${teamScore.away}` : `${winnerCount}/${parsedDraft.lines.length || parsedDraft.lineCount || 0}`} />
      </div>
      <div style={teamMatchupStyle}>
        <ParsedTeam
          name={parsedDraft.homeTeam || 'Home team'}
          wins={teamScore?.home}
          won={teamScore ? teamScore.home > teamScore.away : false}
        />
        <span>vs</span>
        <ParsedTeam
          name={parsedDraft.awayTeam || 'Visiting team'}
          wins={teamScore?.away}
          won={teamScore ? teamScore.away > teamScore.home : false}
        />
      </div>
      <p style={copyStyle}>
        TenAceIQ captured both player side names and the winning side for each line. Import uses these player records,
        scores, and winners to refresh analytics across the platform.
      </p>
      <div style={parsedLineListStyle}>
        {parsedDraft.lines.slice(0, 5).map((line, index) => (
          <div key={`${line.lineLabel}-${index}`} style={parsedScorecardLineStyle(line.winner)}>
            <div style={parsedLineMainStyle}>
              <span style={lineHeaderStyle}>
                {line.lineLabel}
                {lineNeedsCheck(line) ? <small style={lineCheckStyle}>{getLineReviewLabel(line)}</small> : null}
              </span>
              <strong style={lineScoreStyle}>{line.score || 'Check score'}</strong>
            </div>
            <div style={playerSidesGridStyle}>
              <ParsedSidePlayers
                label={parsedDraft.homeTeam || 'Home'}
                players={line.homePlayers}
                won={line.winner === 'home'}
              />
              <ParsedSidePlayers
                label={parsedDraft.awayTeam || 'Visiting'}
                players={line.awayPlayers}
                won={line.winner === 'away'}
              />
            </div>
          </div>
        ))}
      </div>
      {reviewItems.length && !requiredReady ? (
        <div style={reviewChecklistStyle}>
          <strong>Before importing</strong>
          {reviewItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : requiredReady ? (
        <div style={readyImportNoteStyle}>
          <strong>Ready to import</strong>
          <span>Players, scores, and line winners are captured. Give the read one final check.</span>
        </div>
      ) : null}
      {canReview ? (
        <div style={cardActionRowStyle}>
          <button type="button" onClick={onConfirm} disabled={busy} style={{ ...smallButtonStyle, ...(busy ? disabledStyle : {}) }}>
            {busy ? 'Importing...' : 'Looks right - import'}
          </button>
          <button type="button" onClick={onFlag} disabled={busy} style={{ ...smallDangerButtonStyle, ...(busy ? disabledStyle : {}) }}>
            Needs fix
          </button>
        </div>
      ) : getBlockingScorecardReviewItems(parsedDraft).length ? (
        <p style={copyStyle}>Upload a tighter crop from the match header through Total Team Score when you want TenAceIQ to try again.</p>
      ) : null}
    </div>
  )
}

function getScorecardReviewItems(parsedDraft: DataAssistScorecardParsedDraft) {
  const items: string[] = []
  items.push(...getBlockingScorecardReviewItems(parsedDraft))
  if (items.length && parsedDraft.lines.some((line) => line.confidenceScore < 0.9)) {
    items.push('Review highlighted lines before importing.')
  }
  return items
}

function getBlockingScorecardReviewItems(parsedDraft: DataAssistScorecardParsedDraft) {
  const items: string[] = []
  if (!parsedDraft.externalMatchId || !parsedDraft.matchDate || !parsedDraft.homeTeam || !parsedDraft.awayTeam) {
    items.push('Confirm the match details.')
  }
  if (parsedDraft.lines.some((line) => !line.homePlayers.length || !line.awayPlayers.length)) {
    items.push('Check player names against the screenshot.')
  }
  if (parsedDraft.lines.some((line) => !line.score)) {
    items.push('Add any missing scores before import.')
  }
  if (parsedDraft.lines.some((line) => line.winner !== 'home' && line.winner !== 'away')) {
    items.push('Confirm each line winner.')
  }
  return items
}

function canConfirmScorecardRead(parsedDraft: DataAssistScorecardParsedDraft) {
  return getBlockingScorecardReviewItems(parsedDraft).length === 0
}

function lineNeedsCheck(line: DataAssistScorecardParsedDraft['lines'][number]) {
  return !line.score || !line.homePlayers.length || !line.awayPlayers.length || (line.winner !== 'home' && line.winner !== 'away')
}

function getLineReviewLabel(line: DataAssistScorecardParsedDraft['lines'][number]) {
  return !line.score || !line.homePlayers.length || !line.awayPlayers.length || (line.winner !== 'home' && line.winner !== 'away') ? 'Check' : 'Review'
}

function getScorecardReviewLead(parsedDraft: DataAssistScorecardParsedDraft) {
  return getBlockingScorecardReviewItems(parsedDraft).length
    ? 'TenAceIQ found the match. Some scorecard fields need a cleaner look before import.'
    : 'TenAceIQ found the match. Review the highlighted lines, then confirm the read or mark it needs a fix.'
}

function formatParsedLinePlayers(line: DataAssistScorecardParsedDraft['lines'][number]) {
  const matchup = `${line.homePlayers.join(' / ') || 'Check home players'} vs ${line.awayPlayers.join(' / ') || 'Check visiting players'}`
  return lineNeedsCheck(line) ? `Draft read: ${matchup}` : matchup
}

function getParsedTeamScore(parsedDraft: DataAssistScorecardParsedDraft) {
  let home = 0
  let away = 0
  for (const line of parsedDraft.lines) {
    if (line.winner === 'home') home += 1
    if (line.winner === 'away') away += 1
  }
  return home || away ? { home, away } : null
}

function ParsedTeam({
  name,
  wins,
  won,
}: {
  name: string
  wins?: number
  won: boolean
}) {
  return (
    <div style={parsedTeamStyle(won)}>
      <span>{name}{wins !== undefined ? ` (${wins})` : ''}</span>
      {won ? <strong>Team win</strong> : null}
    </div>
  )
}

function ParsedSidePlayers({
  label,
  players,
  won,
}: {
  label: string
  players: string[]
  won: boolean
}) {
  return (
    <div style={parsedSideStyle(won)}>
      <div style={parsedSideHeaderStyle}>
        <span>{label}</span>
        {won ? <strong>Won</strong> : null}
      </div>
      <p>{players.join(' / ') || 'Check players'}</p>
    </div>
  )
}

function getLineWinnerLabel(
  line: DataAssistScorecardParsedDraft['lines'][number],
  parsedDraft: DataAssistScorecardParsedDraft,
) {
  if (line.winner === 'home') return `Winner: ${parsedDraft.homeTeam || 'Home'}`
  if (line.winner === 'away') return `Winner: ${parsedDraft.awayTeam || 'Visiting'}`
  return 'Winner: check'
}

function getWinnerBadgeStyle(winner: string): CSSProperties {
  const isResolved = winner === 'home' || winner === 'away'
  return {
    justifySelf: 'start',
    borderRadius: 999,
    border: isResolved
      ? '1px solid color-mix(in srgb, var(--brand-green) 32%, var(--shell-panel-border) 68%)'
      : '1px solid rgba(251,191,36,0.32)',
    background: isResolved
      ? 'color-mix(in srgb, var(--brand-green) 12%, transparent)'
      : 'rgba(251,191,36,0.12)',
    color: isResolved
      ? 'color-mix(in srgb, var(--brand-green) 80%, white 20%)'
      : '#fde68a',
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 950,
  }
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={reviewFactStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function isScheduleParsedDraft(value: unknown): value is DataAssistScheduleParsedDraft {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as Partial<DataAssistScheduleParsedDraft>).matches))
}

function isTeamSummaryParsedDraft(value: unknown): value is DataAssistTeamSummaryParsedDraft {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as Partial<DataAssistTeamSummaryParsedDraft>).players))
}

function isScorecardParsedDraft(value: unknown): value is DataAssistScorecardParsedDraft {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as Partial<DataAssistScorecardParsedDraft>).lines))
}

function isParsedDraftReady(value: DataAssistScorecardParsedDraft | DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft) {
  if (isScheduleParsedDraft(value)) return value.matches.length > 0 && value.matches.every((match) => match.reviewNotes.length === 0)
  if (isTeamSummaryParsedDraft(value)) return value.players.length > 0 && value.players.every((player) => player.name && player.ntrp !== null)
  return getBlockingScorecardReviewItems(value).length === 0
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

function toScheduleParsedDraft(value: DataAssistSubmission['parsedPayload']): DataAssistScheduleParsedDraft | null {
  if (!isScheduleParsedDraft(value) || !value.matches.length) return null
  return {
    draftKind: 'schedule',
    teamName: typeof value.teamName === 'string' ? value.teamName : '',
    leagueName: typeof value.leagueName === 'string' ? value.leagueName : '',
    flight: typeof value.flight === 'string' ? value.flight : '',
    ustaSection: typeof value.ustaSection === 'string' ? value.ustaSection : '',
    districtArea: typeof value.districtArea === 'string' ? value.districtArea : '',
    matches: value.matches,
    matchCount: typeof value.matchCount === 'number' ? value.matchCount : value.matches.length,
    parserWarnings: Array.isArray(value.parserWarnings)
      ? value.parserWarnings.filter((warning): warning is string => typeof warning === 'string')
      : [],
    rawTextPreview: typeof value.rawTextPreview === 'string' ? value.rawTextPreview : '',
    sourceScreenshotCount: typeof value.sourceScreenshotCount === 'number' ? value.sourceScreenshotCount : 0,
    provider: value.provider || 'manual_review',
    confidenceScore: typeof value.confidenceScore === 'number' ? value.confidenceScore : 0,
  }
}

function toTeamSummaryParsedDraft(value: DataAssistSubmission['parsedPayload']): DataAssistTeamSummaryParsedDraft | null {
  if (!isTeamSummaryParsedDraft(value) || !value.players.length) return null
  return {
    draftKind: 'team_summary',
    rosterTeamName: typeof value.rosterTeamName === 'string' ? value.rosterTeamName : '',
    leagueName: typeof value.leagueName === 'string' ? value.leagueName : '',
    flight: typeof value.flight === 'string' ? value.flight : '',
    ustaSection: typeof value.ustaSection === 'string' ? value.ustaSection : '',
    districtArea: typeof value.districtArea === 'string' ? value.districtArea : '',
    teams: Array.isArray(value.teams) ? value.teams : [],
    players: value.players,
    playerCount: typeof value.playerCount === 'number' ? value.playerCount : value.players.length,
    teamCount: typeof value.teamCount === 'number' ? value.teamCount : Array.isArray(value.teams) ? value.teams.length : 0,
    parserWarnings: Array.isArray(value.parserWarnings)
      ? value.parserWarnings.filter((warning): warning is string => typeof warning === 'string')
      : [],
    rawTextPreview: typeof value.rawTextPreview === 'string' ? value.rawTextPreview : '',
    sourceScreenshotCount: typeof value.sourceScreenshotCount === 'number' ? value.sourceScreenshotCount : 0,
    provider: value.provider || 'manual_review',
    confidenceScore: typeof value.confidenceScore === 'number' ? value.confidenceScore : 0,
  }
}

type SubmissionImportSummary = {
  importedAt: string
  linkedPlayers: number
  createdPlayers: number
  lineCount: number
  message: string
  duplicate: boolean
}

function getSubmissionImportSummary(submission: DataAssistSubmission): SubmissionImportSummary {
  const validation = toRecord(submission.validationSummary)
  const importSummary = toRecord(validation.importSummary)
  const importResult = toRecord(importSummary.importResult)
  const result = toRecord(importResult.result)
  const rows = Array.isArray(result.rows) ? result.rows : []

  return {
    importedAt: cleanSummaryText(importSummary.importedAt),
    linkedPlayers: toFiniteNumber(result.linkedPlayersCount),
    createdPlayers: toFiniteNumber(result.createdPlayersCount),
    lineCount: toFiniteNumber(result.totalRows) || rows.length,
    message: cleanSummaryText(rows[0] ? toRecord(rows[0]).message : '') || submission.reviewNote || submission.draftReviewNote,
    duplicate: importSummary.duplicate === true,
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function toFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function cleanSummaryText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function getSubmissionStatusCopy(submission: DataAssistSubmission) {
  if (submission.status === 'ready_to_import') {
    return {
      label: 'Check scorecard',
      detail: 'TenAceIQ found the match. Check the highlighted names and scores before importing.',
      tone: 'amber' as const,
    }
  }
  if (submission.status === 'imported') {
    return {
      label: 'Imported',
      detail: 'Done. This result is now available to match, player, team, and rating workflows.',
      tone: 'green' as const,
    }
  }
  if (submission.status === 'verified') {
    return {
      label: 'Ready to import',
      detail: 'The read is confirmed. Preview or commit the import when you are ready.',
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
      detail: 'This looks like a TennisLink scorecard. Save it to build a review draft.',
      tone: 'amber' as const,
    }
  }
  return {
    label: 'Needs a closer look',
    detail: 'This upload is saved. A cleaner scorecard crop may produce a better read.',
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

const heroStyle = (isMobile: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: isMobile ? 14 : 18,
  alignItems: 'stretch',
})

const heroCopyStyle: CSSProperties = {
  borderRadius: 'clamp(18px, 5vw, 28px)',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
  padding: 'clamp(16px, 4vw, 38px)',
  display: 'grid',
  alignContent: 'center',
  gap: 16,
}

const titleStyle = (isSmallMobile: boolean): CSSProperties => ({
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: isSmallMobile ? 31 : 'clamp(2rem, 5vw, 4.5rem)',
  lineHeight: 1.04,
  fontWeight: 950,
  letterSpacing: 0,
  maxWidth: 760,
})

const heroTextStyle: CSSProperties = {
  margin: 0,
  maxWidth: 700,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.55,
  fontWeight: 700,
}

const heroActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const workspaceStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 18,
  alignItems: 'start',
})

const panelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-card)',
  padding: 'clamp(13px, 4vw, 18px)',
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
  fontSize: 'clamp(20px, 5vw, 24px)',
  lineHeight: 1.18,
  fontWeight: 950,
}

const typeSelectWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 950,
}

const typeSelectStyle: CSSProperties = {
  width: '100%',
  minHeight: 52,
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-green) 30%, var(--shell-panel-border) 70%)',
  background: 'var(--shell-panel-bg-strong)',
  color: 'var(--foreground-strong)',
  padding: '0 12px',
  fontSize: 16,
  fontWeight: 900,
}

const typeSelectedCardStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-green) 26%, var(--shell-panel-border) 74%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
  color: 'var(--foreground-strong)',
  padding: 12,
  display: 'grid',
  gap: 5,
  minWidth: 0,
}

const stepDividerStyle: CSSProperties = {
  borderTop: '1px solid var(--shell-panel-border)',
  paddingTop: 14,
  display: 'grid',
  gap: 8,
  color: 'var(--foreground-strong)',
}

const stepBadgeStyle: CSSProperties = {
  width: 'fit-content',
  border: '1px solid color-mix(in srgb, var(--brand-green) 45%, var(--shell-panel-border) 55%)',
  borderRadius: 999,
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 34%, #0f2a26 66%), color-mix(in srgb, var(--brand-blue-2) 38%, #10261f 62%))',
  color: 'white',
  boxShadow: '0 12px 26px rgba(20, 184, 116, 0.18)',
  padding: '5px 10px 5px 6px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  maxWidth: '100%',
  whiteSpace: 'normal',
}

const stepBadgeNumberStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.18)',
  display: 'grid',
  placeItems: 'center',
  fontSize: 12,
}

const typeButtonHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const typeRecommendedBadgeStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 35%, var(--shell-panel-border) 65%)',
  background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-panel-bg) 86%)',
  color: 'var(--foreground-strong)',
  padding: '3px 7px',
  fontSize: 10,
  fontWeight: 950,
}

const dropzoneStyle = (status: string): CSSProperties => ({
  minHeight: 150,
  borderRadius: 16,
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

const compactDropzoneStyle: CSSProperties = {
  ...dropzoneStyle(''),
  minHeight: 92,
  padding: 12,
}

const fileInputStyle: CSSProperties = {
  width: '100%',
  maxWidth: 360,
  minHeight: 44,
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 850,
}

const dropzoneKickerStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
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
  flexWrap: 'wrap',
  minWidth: 0,
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

const historyCollapsedStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  padding: 12,
  fontSize: 13,
  fontWeight: 800,
}

const scorecardReviewStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  display: 'grid',
  gap: 10,
}

const latestReadStyle: CSSProperties = {
  ...scorecardReviewStyle,
  marginTop: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 5%, var(--shell-panel-bg) 95%)',
}

const importPanelStyle: CSSProperties = {
  ...scorecardReviewStyle,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
}

const scorecardHeaderGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const teamMatchupStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 8,
  alignItems: 'center',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.35,
}

const parsedTeamStyle = (won: boolean): CSSProperties => ({
  borderRadius: 12,
  border: won
    ? '1px solid color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)'
    : '1px solid var(--shell-panel-border)',
  background: won
    ? 'color-mix(in srgb, var(--brand-green) 13%, var(--shell-chip-bg) 87%)'
    : 'var(--shell-chip-bg)',
  padding: 10,
  display: 'grid',
  gap: 4,
  minHeight: 54,
  alignContent: 'center',
  fontWeight: 950,
})

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
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 6,
  color: 'var(--foreground-strong)',
  fontSize: 12,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const parsedScorecardLineStyle = (winner: string): CSSProperties => ({
  borderRadius: 14,
  border: winner === 'home' || winner === 'away'
    ? '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)'
    : '1px solid rgba(251,191,36,0.32)',
  background: winner === 'home' || winner === 'away'
    ? 'color-mix(in srgb, var(--brand-green) 5%, var(--shell-chip-bg) 95%)'
    : 'rgba(251,191,36,0.08)',
  padding: 11,
  display: 'grid',
  gap: 9,
  color: 'var(--foreground-strong)',
  fontSize: 12,
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const scheduleMatchRowStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 92%, var(--brand-green) 8%)',
  padding: 11,
  display: 'grid',
  gap: 9,
  color: 'var(--foreground-strong)',
  fontSize: 12,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const scheduleMatchGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
}

const parsedLineMainStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const lineScoreStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 950,
}

const playerSidesGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 8,
}

const parsedSideStyle = (won: boolean): CSSProperties => ({
  borderRadius: 10,
  border: won
    ? '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)'
    : '1px solid var(--shell-panel-border)',
  background: won
    ? 'color-mix(in srgb, var(--brand-green) 12%, transparent)'
    : 'rgba(255,255,255,0.02)',
  padding: 8,
  display: 'grid',
  gap: 4,
})

const parsedSideHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const lineHeaderStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const lineCheckStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid rgba(251,191,36,0.32)',
  background: 'rgba(251,191,36,0.12)',
  color: 'var(--foreground-strong)',
  padding: '1px 6px',
  fontSize: 9,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const reviewChecklistStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(251,191,36,0.22)',
  background: 'rgba(251,191,36,0.08)',
  color: 'var(--foreground-strong)',
  padding: 10,
  display: 'grid',
  gap: 5,
  fontSize: 12,
  fontWeight: 850,
}

const simpleHelpStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
  color: 'var(--shell-copy-muted)',
  padding: 14,
  display: 'grid',
  gap: 5,
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 800,
}

const readyImportNoteStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
  color: 'var(--foreground-strong)',
  padding: 10,
  display: 'grid',
  gap: 4,
  fontSize: 12,
  fontWeight: 850,
}

const duplicateBannerStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-green) 44%, var(--shell-panel-border) 56%)',
  background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-panel-bg) 86%)',
  color: 'var(--foreground-strong)',
  padding: 14,
  display: 'grid',
  gap: 8,
  boxShadow: '0 14px 36px rgba(0,0,0,0.22)',
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
  flexWrap: 'wrap',
  minWidth: 0,
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
  minWidth: 0,
}

const smallButtonStyle: CSSProperties = {
  minHeight: 40,
  borderRadius: 12,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 28%, var(--shell-panel-border) 72%)',
  background: 'var(--shell-panel-bg-strong)',
  color: 'var(--foreground-strong)',
  padding: '0 12px',
  fontSize: 13,
  fontWeight: 950,
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
}

const smallDangerButtonStyle: CSSProperties = {
  ...smallButtonStyle,
  border: '1px solid rgba(248,113,113,0.26)',
  color: 'var(--foreground-strong)',
}

const draftActionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
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
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
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
  color: 'var(--foreground-strong)',
}

const pillDangerStyle: CSSProperties = {
  ...pillStyle,
  border: '1px solid rgba(248,113,113,0.32)',
  background: 'rgba(248,113,113,0.12)',
  color: 'var(--foreground-strong)',
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

const scanLoadingStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginTop: 18,
  padding: 16,
  border: '1px solid var(--shell-panel-border)',
  borderRadius: 8,
  background: 'var(--shell-chip-bg)',
}

const scanLoadingCopyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 800,
}

const warningStyle: CSSProperties = {
  ...hintStyle,
  color: 'var(--foreground-strong)',
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
