'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import PlayerSuitePanel from '@/app/components/player-suite-panel'
import { useAuth } from '@/app/components/auth-provider'
import TiqLoader from '@/components/TiqLoader'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import {
  getMyDataAssistContributorStats,
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
import { detectDataAssistExportType } from '@/lib/data-assist-export-detection'
import type { DataAssistScheduleParsedDraft } from '@/lib/data-assist-schedule-parser'
import { isTeamSummaryDraftReadyForImport, type DataAssistTeamSummaryParsedDraft } from '@/lib/data-assist-team-summary-parser'
import { encodeTeamRouteSegment } from '@/lib/team-routes'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { buildSupportMessageHref } from '@/lib/message-links'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'
import {
  buildCaptainImportHandoff,
  buildCaptainImportReturnHref,
  isCaptainImportDraft,
} from '@/lib/captain-import-handoff'
import { acceptCaptainImportConnection } from '@/lib/team-profile-links-client'

const DATA_ASSIST_OCR_TIMEOUT_MS = 100_000
const DATA_ASSIST_MAX_BULK_SCORECARDS = 10
const newPlayerActions = [
  { href: '/data-assist#upload', label: 'Upload tennis data', detail: 'Scorecard, schedule, or Player Roster' },
  { href: '/explore/leagues', label: 'Local leagues', detail: 'Find a first match lane' },
  { href: '/league-coordinator', label: 'Create TIQ league', detail: 'Start your own group' },
  { href: '/explore/players', label: 'Find players', detail: 'Build your tennis map' },
]

const emptyHistoryActions = [
  { href: '/data-assist#upload', label: 'Upload first file' },
  { href: '/mylab', label: 'Open My Lab' },
  { href: '/profile', label: 'Check profile' },
] as const

const dataAssistTrustSignals = [
  { label: 'Source', value: 'USTA / TIQ / user upload / admin reviewed / public data' },
  { label: 'Freshness', value: 'Updated today / last refreshed / pending review' },
  { label: 'Confidence', value: 'High / medium / limited' },
  { label: 'Status', value: 'Verified / needs review / imported / disputed' },
] as const

const dataAssistPlayerIdSignalPath = [
  {
    label: 'Player ID',
    title: 'Match the source to the right tennis identity.',
    body: 'Scorecards and Player Rosters should strengthen the correct player profile, not create mystery records.',
  },
  {
    label: 'Reviewed signal',
    title: 'Keep unreviewed uploads out of ratings.',
    body: 'A file can be saved immediately, but profiles, rankings, Matchup, My Lab, and Coach Hub wait for a clean review path.',
  },
  {
    label: 'Next use',
    title: 'Turn clean data into useful tennis actions.',
    body: 'Once reviewed, the same signal can support profile confidence, Level Up context, matchup prep, and team decisions.',
  },
] as const

const dataAssistReviewFlow = [
  {
    step: '1',
    title: 'Upload source',
    body: 'Add a scorecard, schedule, Player Roster, or correction source.',
  },
  {
    step: '2',
    title: 'Read the signals',
    body: 'TenAceIQ checks source, freshness, confidence, and review status before using it.',
  },
  {
    step: '3',
    title: 'Confirm or flag',
    body: 'Clean reads can import. Unclear rows stop for review instead of quietly changing records.',
  },
  {
    step: '4',
    title: 'Feed tennis context',
    body: 'Reviewed data can improve players, teams, leagues, rankings, Matchup, My Lab, and Coach Hub.',
  },
] as const

const dataAssistUploadStateProof = [
  {
    label: 'Saved upload',
    body: 'Files are tied to the signed-in profile and remain in upload history for review.',
  },
  {
    label: 'Review state',
    body: 'Clean reads can import; uncertain, duplicate, rejected, or flagged reads stay visible as review items.',
  },
  {
    label: 'Trust boundary',
    body: 'Unreviewed uploads do not change players, teams, leagues, rankings, Matchup, My Lab, or Coach Hub.',
  },
] as const

const DATA_ASSIST_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')
const DATA_ASSIST_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(DATA_ASSIST_PLAYER_IDENTITY)
const DATA_ASSIST_LEVEL_UP_HREF = `/level-up/${DATA_ASSIST_PLAYER_IDENTITY.slug}#level-up-flow`
const DATA_ASSIST_PLAYER_DEVELOPMENT_HREF = `/player-development/${DATA_ASSIST_PLAYER_IDENTITY.slug}`
const dataAssistPlayerIdStarterRead = [
  { label: 'Train first', value: DATA_ASSIST_PLAYER_IDENTITY_READ.trainingPriority },
  { label: 'Proof target', value: DATA_ASSIST_PLAYER_IDENTITY_READ.proofTarget },
  { label: 'Match test', value: DATA_ASSIST_PLAYER_IDENTITY_READ.matchTrigger },
] as const

const dataAssistSourcePathJobs = [
  {
    id: 'scorecard',
    icon: 'dataUpload',
    question: 'What result should update first?',
    title: 'Scorecard',
    body: 'Use after match day so scores, winners, players, teams, and standings can move from one reviewed source.',
    cta: 'Match result and line scores',
  },
  {
    id: 'schedule',
    icon: 'schedule',
    question: 'What is the season schedule?',
    title: 'Schedule',
    body: 'Use the schedule export when teams, courts, dates, times, and sites need one cleaner place to live.',
    cta: 'Dates, courts, and sites',
  },
  {
    id: 'team_summary',
    icon: 'lineupBuilder',
    question: 'Who is on the roster?',
    title: 'Player roster',
    body: 'Import players, starting ratings, and available contact details from one TennisLink export.',
    cta: 'Players, ratings, and contacts',
  },
] as const satisfies ReadonlyArray<{
  id: DataAssistImportType
  icon: TiqFeatureIconName
  question: string
  title: string
  body: string
  cta: string
}>

const uploadJourneySteps = [
  { step: '1', label: 'Choose source', active: true },
  { step: '2', label: 'Add file', active: false },
  { step: '3', label: 'Review & import', active: false },
] as const

const importTypes: Array<{
  id: DataAssistImportType
  label: string
}> = [
  {
    id: 'scorecard',
    label: 'Scorecard',
  },
  {
    id: 'schedule',
    label: 'Schedule',
  },
  {
    id: 'team_summary',
    label: 'Player Roster',
  },
]

type BulkScorecardResult = {
  batchId: string
  draftId: string
  fileName: string
  status: 'pending' | 'imported' | 'duplicate' | 'review' | 'failed'
  detail: string
  matchId: string
  matchDate: string
  matchup: string
}

type DataAssistIntent = 'upload-source' | 'report-issue' | 'request-review'

type DataAssistOutcome = {
  tone: 'success' | 'review' | 'duplicate'
  title: string
  detail: string
  batchId?: string
  target: 'history' | 'latest-read'
}

function getDataAssistIntent(value: string | null): DataAssistIntent | null {
  if (value === 'upload-source' || value === 'report-issue' || value === 'request-review') return value
  return null
}

function getDataAssistContext(value: string | null): string {
  return (value || '').trim().slice(0, 80)
}

function getDataAssistQuery(value: string | null): string {
  return (value || '').trim().slice(0, 120)
}

function getRequestedImportType(value: string | null): DataAssistImportType | null {
  if (value === 'scorecard' || value === 'schedule' || value === 'team_summary') return value
  return null
}

function getSafeDataAssistReturnTo(value: string | null): string {
  const path = (value || '').trim()
  if (!path || path.length > 500 || path.startsWith('//')) return ''
  if (path === '/captain' || path.startsWith('/captain/')) return path
  if (path === '/team-room' || path.startsWith('/team-room?')) return path
  if (path === '/clubs' || path.startsWith('/clubs?')) return path
  return ''
}

function buildScorecardImportReturnHref(returnTo: string, externalMatchId: string) {
  const safeReturnTo = getSafeDataAssistReturnTo(returnTo)
  if (!safeReturnTo) return ''
  const url = new URL(safeReturnTo, 'https://tenaceiq.local')
  url.searchParams.set('result', 'updated')
  if (externalMatchId.trim()) url.searchParams.set('resultMatch', externalMatchId.trim())
  return `${url.pathname}${url.search}${url.hash}`
}

function buildDataAssistIssueHref(context = '', query = '') {
  const details = [
    context ? `Source context: ${context}` : '',
    query ? `Search phrase: ${query}` : '',
  ].filter(Boolean)

  return buildSupportMessageHref({
    category: 'data',
    subject: context ? `Data issue: ${context}` : 'Data issue',
    body: details.length
      ? `Please review this TenAceIQ data issue.\n\n${details.join('\n')}\n\nWhat looks wrong: `
      : 'Please review this TenAceIQ data issue.\n\nWhat looks wrong: ',
  })
}

export default function DataAssistPage() {
  return (
    <SiteShell active="/data-assist">
      <JsonLd id="data-assist-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Data Assist', '/data-assist')} />
      <DataAssistWorkspace />
    </SiteShell>
  )
}

function DataAssistWorkspace() {
  const { userId, authResolved, session } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isTablet, isMobile } = useViewportBreakpoints()
  const intent = getDataAssistIntent(searchParams.get('intent'))
  const intentContext = getDataAssistContext(searchParams.get('context'))
  const intentQuery = getDataAssistQuery(searchParams.get('q'))
  const requestedImportType = getRequestedImportType(searchParams.get('type'))
  const exportHelpRequested = searchParams.get('help') === '1'
  const scorecardCameraRequested = searchParams.get('capture') === 'camera'
  const returnTo = getSafeDataAssistReturnTo(searchParams.get('returnTo'))
  const [importType, setImportType] = useState<DataAssistImportType>(requestedImportType || 'scorecard')
  const [typeOverrideActive, setTypeOverrideActive] = useState(false)
  const [summary, setSummary] = useState<DataAssistBatchSummary | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [, setSelectedFileCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedBatchId, setSavedBatchId] = useState('')
  const [submissions, setSubmissions] = useState<DataAssistSubmission[]>([])
  const [contributorStats, setContributorStats] = useState<DataAssistContributorStats | null>(null)
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [submissionsError, setSubmissionsError] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [outcome, setOutcome] = useState<DataAssistOutcome | null>(null)
  const [bulkScorecardResults, setBulkScorecardResults] = useState<BulkScorecardResult[]>([])
  const [focusedSubmissionId, setFocusedSubmissionId] = useState('')
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
  const latestReadRef = useRef<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const hasPreparedScreenshots = Boolean(summary?.screenshots.length)
  const showUploadStep = !hasPreparedScreenshots && !saving && !latestScan
  const showOrderStep = hasPreparedScreenshots && !saving && !latestScan
  const showScanStep = saving
  const showLatestReviewStep = Boolean(latestScan)
  const showHistoryStep = !hasPreparedScreenshots && !saving && !latestScan
  const showBulkScorecardResults = !hasPreparedScreenshots && !latestScan && bulkScorecardResults.length > 0
  const scorecardUploadsPaused = contributorStats?.canUploadScorecards === false
  const scorecardUploadPausedMessage =
    contributorStats?.uploadSuspensionReason || 'Scorecard uploads are paused while admins review recent match accuracy reports.'
  const scorecardUploadBlocked = typeOverrideActive && importType === 'scorecard' && scorecardUploadsPaused
  const summaryScorecardUploadBlocked = summary?.requestedImportType === 'scorecard' && scorecardUploadsPaused
  const scorecardPhotoReaderReady = importType === 'scorecard' && getDataAssistOcrReadiness().canRun
  const acceptedUploadTypes = scorecardPhotoReaderReady
    ? '.xls,.html,application/vnd.ms-excel,text/html,image/jpeg,image/png,image/webp'
    : '.xls,.html,application/vnd.ms-excel,text/html'
  const isCompactViewport = isMobile || isTablet
  const scorecardCaptureReady = scorecardCameraRequested && scorecardPhotoReaderReady
  const scorecardCaptureUnavailable = scorecardCameraRequested && !scorecardPhotoReaderReady
  const scorecardCaptureButtonLabel = isCompactViewport ? 'Take scorecard photo' : 'Choose scorecard photo'
  const dynamicPanelStyle = isCompactViewport ? compactPanelStyle : panelStyle
  const dynamicSectionHeaderStyle = isCompactViewport ? compactSectionHeaderStyle : sectionHeaderStyle
  const dynamicImportTypeSelectWrapStyle = isCompactViewport ? compactImportTypeSelectWrapStyle : importTypeSelectWrapStyle
  const dynamicImportTypeSelectStyle = isCompactViewport ? compactImportTypeSelectStyle : importTypeSelectStyle
  const dynamicImportTypeSelectHintStyle = isCompactViewport ? compactImportTypeSelectHintStyle : importTypeSelectHintStyle
  const focusedHistoryFilter: DataAssistHistoryFilter = outcome?.tone === 'success' || outcome?.tone === 'duplicate'
    ? 'imported'
    : 'needs_review'

  async function finishCaptainImport(input: {
    batchId: string
    parsedDraft: DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft
    result?: DataAssistImportActionResult
  }) {
    if (!returnTo || !isCaptainImportDraft(input.parsedDraft)) return false
    const handoff = buildCaptainImportHandoff(input)
    if (session?.access_token) {
      await acceptCaptainImportConnection({
        accessToken: session.access_token,
        batchId: input.batchId,
      })
    }
    router.replace(buildCaptainImportReturnHref(returnTo, handoff))
    return true
  }

  function finishScorecardImport(parsedDraft: DataAssistScorecardParsedDraft) {
    const href = buildScorecardImportReturnHref(returnTo, parsedDraft.externalMatchId)
    if (!href) return false
    router.replace(href)
    return true
  }

  function resetUploadFlow() {
    scanRunRef.current += 1
    setPreparing(false)
    setSelectedFileCount(0)
    setSaving(false)
    setSummary(null)
    setLatestScan(null)
    setSavedBatchId('')
    setMessage('')
    setError('')
    setOutcome(null)
    setBulkScorecardResults([])
    setFocusedSubmissionId('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function completeUploadFlow(completionMessage = 'Upload complete.', nextOutcome: DataAssistOutcome | null = null) {
    setPreparing(false)
    setSelectedFileCount(0)
    setSaving(false)
    setSummary(null)
    setLatestScan(null)
    setSavedBatchId('')
    setBulkScorecardResults([])
    setFocusedSubmissionId(nextOutcome?.batchId || '')
    setError('')
    setMessage(completionMessage)
    setOutcome(nextOutcome)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function updateImportType(nextType: DataAssistImportType) {
    void trackProductUsageEvent({
      eventName: 'upload_type_selected',
      surface: 'data_assist',
      metadata: {
        importType: nextType,
      },
    })
    setTypeOverrideActive(true)
    setImportType(nextType)
    setSummary((current) => current ? summarizeDataAssistBatch(nextType, current.screenshots) : null)
    setSavedBatchId('')
    setMessage('')
    setError('')
    setOutcome(null)
    setBulkScorecardResults([])
    setFocusedSubmissionId('')
  }

  function chooseImportType(nextType: DataAssistImportType) {
    updateImportType(nextType)
    if (nextType === 'scorecard' && scorecardUploadsPaused) {
      setError(scorecardUploadPausedMessage)
      return
    }
    fileInputRef.current?.click()
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

  useEffect(() => {
    if (!requestedImportType) return

    scanRunRef.current += 1
    setTypeOverrideActive(true)
    setImportType(requestedImportType)
    setSummary(null)
    setLatestScan(null)
    setSavedBatchId('')
    setMessage('')
    setError('')
    setOutcome(null)
    setBulkScorecardResults([])
    setFocusedSubmissionId('')
  }, [requestedImportType])

  useEffect(() => {
    void trackProductUsageEvent({
      eventName: 'data_assist_opened',
      surface: 'data_assist',
      metadata: intent || requestedImportType || intentContext || intentQuery
        ? { intent, importType: requestedImportType, context: intentContext, query: intentQuery }
        : undefined,
    })
  }, [intent, intentContext, intentQuery, requestedImportType])

  useEffect(() => {
    if (!latestScan) return
    window.setTimeout(() => {
      latestReadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }, [latestScan])

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    setSelectedFileCount(files.length)
    setPreparing(true)
    setSavedBatchId('')
    setMessage(`Checking ${files.length} TennisLink export${files.length === 1 ? '' : 's'}...`)
    setError('')
    setOutcome(null)
    setBulkScorecardResults([])

    const detected = await detectDataAssistExportType(files, importType)
    if (detected.importType === 'scorecard' && scorecardUploadsPaused) {
      setError(scorecardUploadPausedMessage)
      setPreparing(false)
      setSelectedFileCount(0)
      event.target.value = ''
      return
    }
    if (files.length > 1 && detected.importType !== 'scorecard') {
      setError('Choose one schedule or Player Roster export at a time. You can select several scorecard exports when catching up on match results.')
      setPreparing(false)
      setSelectedFileCount(0)
      event.target.value = ''
      return
    }
    if (detected.mixed) {
      setError('These look like different TennisLink export types. Upload scorecards together, but keep schedules and Player Rosters separate.')
      setPreparing(false)
      setSelectedFileCount(0)
      event.target.value = ''
      return
    }
    if (!detected.recognized && !typeOverrideActive) {
      setError('TenAceIQ could not identify this export. Open “Having trouble?” below, choose the file type, then upload it again.')
      setPreparing(false)
      setSelectedFileCount(0)
      event.target.value = ''
      return
    }
    if (files.length > DATA_ASSIST_MAX_BULK_SCORECARDS && detected.importType === 'scorecard') {
      setError(`Choose up to ${DATA_ASSIST_MAX_BULK_SCORECARDS} scorecard exports at a time. Run another batch for the rest.`)
      setPreparing(false)
      setSelectedFileCount(0)
      event.target.value = ''
      return
    }
    if (summary && detected.importType !== summary.requestedImportType) {
      setError(`This looks like a ${getShortImportTypeLabel(detected.importType)} export. Finish or start over before uploading a different export type.`)
      setPreparing(false)
      setSelectedFileCount(0)
      event.target.value = ''
      return
    }
    const changedType = detected.importType !== importType
    if (detected.recognized) setTypeOverrideActive(false)
    void trackProductUsageEvent({
      eventName: detected.importType === 'schedule'
        ? 'schedule_upload_started'
        : detected.importType === 'team_summary'
          ? 'team_summary_upload_started'
          : 'scorecard_upload_started',
      surface: 'data_assist',
      metadata: {
        importType: detected.importType,
        fileCount: files.length,
        mixed: detected.mixed,
        changedType,
      },
    })
    setImportType(detected.importType)
    if (files.length > 1) {
      setPreparing(false)
      event.target.value = ''
      await importScorecardExports(files)
      return
    }
    setMessage(`Preparing ${getShortImportTypeLabel(detected.importType)} export...`)

    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
      const preparedSummary = await prepareDataAssistBatch(files, detected.importType)
      const appendedScreenshots = preparedSummary.screenshots.map((screenshot, index) => ({
        ...screenshot,
        uploadOrder: index + 1,
      }))
      const nextSummary = summarizeDataAssistBatch(detected.importType, appendedScreenshots)
      setSummary(nextSummary)
      if (nextSummary.status === 'rejected') {
        setError(nextSummary.rejectionReason)
      } else {
        const exportLabel = 'TennisLink export'
        if (userId) {
          setMessage(`${exportLabel} ${changedType ? 'auto-detected' : 'detected'} as ${getShortImportTypeLabel(detected.importType)}. TenAceIQ is importing from the table data now.`)
          window.setTimeout(() => void saveDraft(nextSummary), 0)
        } else {
          setMessage(`${exportLabel} ${changedType ? 'auto-detected' : 'detected'} as ${getShortImportTypeLabel(detected.importType)}. Sign in to import it.`)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Exports could not be prepared.')
    } finally {
      setPreparing(false)
      setSelectedFileCount(0)
      event.target.value = ''
    }
  }

  async function importScorecardExports(files: File[]) {
    if (scorecardUploadsPaused) {
      setSelectedFileCount(0)
      setError(scorecardUploadPausedMessage)
      return
    }
    if (!userId) {
      setSelectedFileCount(0)
      setMessage(`${files.length} scorecard exports selected. Sign in to import them.`)
      return
    }

    const scanRunId = scanRunRef.current + 1
    scanRunRef.current = scanRunId
    setSaving(true)
    setSummary(null)
    setLatestScan(null)
    setSavedBatchId('')
    setError('')
    const pendingResults = files.map((file): BulkScorecardResult => ({
      batchId: '',
      draftId: '',
      fileName: file.name,
      status: 'pending',
      detail: 'Waiting to import',
      matchId: '',
      matchDate: '',
      matchup: '',
    }))
    setBulkScorecardResults(pendingResults)

    let importedCount = 0
    let duplicateCount = 0
    let reviewCount = 0
    let failedCount = 0

    try {
      for (let index = 0; index < files.length; index += 1) {
        if (scanRunRef.current !== scanRunId) return
        const file = files[index]
        setMessage(`Importing scorecard ${index + 1} of ${files.length}...`)
        try {
          const preparedSummary = await prepareDataAssistBatch([file], 'scorecard')
          const nextSummary = summarizeDataAssistBatch('scorecard', preparedSummary.screenshots)
          if (nextSummary.status === 'rejected') {
            failedCount += 1
            updateBulkScorecardResult(index, {
              batchId: '',
              draftId: '',
              fileName: file.name,
              status: 'failed',
              detail: nextSummary.rejectionReason || 'TenAceIQ could not read this export.',
              matchId: '',
              matchDate: '',
              matchup: '',
            })
            continue
          }

          const saved = await withTimeout(
            saveDataAssistDraftBatch(nextSummary),
            30_000,
            'Saving a scorecard export is taking longer than expected. Check your connection and try again.',
          )
          const ocrResult = await withTimeout(
            queueDataAssistOcrVerification({
              batchId: saved.batchId,
              draftId: saved.draftId,
            }),
            DATA_ASSIST_OCR_TIMEOUT_MS,
            'Scorecard reading is taking longer than expected. The upload was saved; try it again from history in a moment.',
          )

          if (ocrResult.autoImport?.ok) {
            importedCount += 1
            const matchMeta = getBulkScorecardMatchMeta(ocrResult.parsedDraft)
            updateBulkScorecardResult(index, {
              batchId: saved.batchId,
              draftId: saved.draftId,
              fileName: file.name,
              status: 'imported',
              detail: ocrResult.autoImport.message || 'Imported',
              ...matchMeta,
            })
            if (files.length === 1 && isScorecardParsedDraft(ocrResult.parsedDraft) && finishScorecardImport(ocrResult.parsedDraft)) return
          } else if (ocrResult.autoImport?.importPreview?.duplicateMatch) {
            duplicateCount += 1
            const matchMeta = getBulkScorecardMatchMeta(ocrResult.parsedDraft)
            updateBulkScorecardResult(index, {
              batchId: saved.batchId,
              draftId: saved.draftId,
              fileName: file.name,
              status: 'duplicate',
              detail: ocrResult.autoImport.message || 'Already imported',
              ...matchMeta,
            })
          } else {
            reviewCount += 1
            const matchMeta = getBulkScorecardMatchMeta(ocrResult.parsedDraft)
            updateBulkScorecardResult(index, {
              batchId: saved.batchId,
              draftId: saved.draftId,
              fileName: file.name,
              status: 'review',
              detail: 'Check the highlighted names and scores, then confirm. League stats update only after confirmation.',
              ...matchMeta,
            })
          }
        } catch (err) {
          failedCount += 1
          updateBulkScorecardResult(index, {
            batchId: '',
            draftId: '',
            fileName: file.name,
            status: 'failed',
            detail: err instanceof Error ? err.message : 'Import failed',
            matchId: '',
            matchDate: '',
            matchup: '',
          })
        }
      }

      if (scanRunRef.current !== scanRunId) return
      if (reviewCount === 0 && failedCount === 0) {
        const duplicateOnly = duplicateCount === files.length
        completeUploadFlow(
          duplicateOnly ? 'Already uploaded. No changes were needed.' : 'Upload complete.',
          {
            tone: duplicateOnly ? 'duplicate' : 'success',
            title: duplicateOnly ? 'Scorecards already in TiQ' : `${importedCount} scorecard${importedCount === 1 ? '' : 's'} imported`,
            detail: duplicateOnly
              ? 'Every scorecard matched a saved result, so TiQ protected the existing records.'
              : 'The completed batch is saved below with each scorecard and its final status.',
            target: 'history',
          },
        )
      } else {
        setMessage(buildBulkScorecardMessage({
          total: files.length,
          importedCount,
          duplicateCount,
          reviewCount,
          failedCount,
        }))
      }
      await refreshSubmissions()
    } finally {
      if (scanRunRef.current === scanRunId) {
        setSaving(false)
        setSelectedFileCount(0)
      }
    }
  }

  function updateBulkScorecardResult(index: number, result: BulkScorecardResult) {
    setBulkScorecardResults((current) => current.map((item, itemIndex) => (
      itemIndex === index ? result : item
    )))
  }

  function openBulkScorecardReview(submissionId: string) {
    setFocusedSubmissionId(submissionId)
    window.setTimeout(() => {
      const target = document.getElementById(submissionId ? `data-assist-submission-${submissionId}` : 'history')
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
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

  async function saveDraft(summaryOverride?: DataAssistBatchSummary) {
    const draftSummary = summaryOverride || summary
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
        'Saving the export is taking longer than expected. Check your connection and try again.',
      )
      setSavedBatchId(result.batchId)
      if (draftSummary.requestedImportType === 'scorecard' || draftSummary.requestedImportType === 'schedule' || draftSummary.requestedImportType === 'team_summary') {
        const readingLabel = draftSummary.requestedImportType === 'schedule'
          ? 'team schedule'
          : draftSummary.requestedImportType === 'team_summary'
            ? 'team roster'
            : 'scorecard'
        setMessage(`${result.screenshotCount} export${result.screenshotCount === 1 ? '' : 's'} uploaded. TenAceIQ is reading the ${readingLabel} now.`)
        const ocrResult = await withTimeout(
          queueDataAssistOcrVerification({
            batchId: result.batchId,
            draftId: result.draftId,
          }),
          DATA_ASSIST_OCR_TIMEOUT_MS,
          `${draftSummary.requestedImportType === 'schedule' ? 'Schedule' : draftSummary.requestedImportType === 'team_summary' ? 'Team roster' : 'Scorecard'} reading is taking longer than expected. The upload was saved; try it again from history in a moment.`,
        )
        if (scanRunRef.current !== scanRunId) return
        if (ocrResult.effectiveImportType && ocrResult.effectiveImportType !== draftSummary.requestedImportType) {
          setImportType(ocrResult.effectiveImportType)
        }
        const typeCorrection = ocrResult.effectiveImportType && ocrResult.effectiveImportType !== draftSummary.requestedImportType
          ? `TenAceIQ detected this as a ${getShortImportTypeLabel(ocrResult.effectiveImportType)} export. `
          : ''
        if (ocrResult.autoImport?.ok) {
          const didReturn = isScorecardParsedDraft(ocrResult.parsedDraft)
            ? finishScorecardImport(ocrResult.parsedDraft)
            : isCaptainImportDraft(ocrResult.parsedDraft)
              ? await finishCaptainImport({
                  batchId: result.batchId,
                  parsedDraft: ocrResult.parsedDraft,
                  result: ocrResult.autoImport,
                })
              : false
          if (didReturn) return
          completeUploadFlow(
            'Upload complete.',
            buildImportedDataAssistOutcome(ocrResult.parsedDraft, result.batchId),
          )
          void refreshSubmissions()
          return
        }
        if (ocrResult.autoImport?.importPreview?.duplicateMatch) {
          completeUploadFlow(
            'Already uploaded. No changes were needed.',
            buildImportedDataAssistOutcome(ocrResult.parsedDraft, result.batchId, true),
          )
          void refreshSubmissions()
          return
        }
        setLatestScan({
          batchId: result.batchId,
          draftId: result.draftId,
          parsedDraft: ocrResult.parsedDraft,
          autoAssessment: ocrResult.autoAssessment,
          autoImport: ocrResult.autoImport,
        })
        setOutcome(buildReviewDataAssistOutcome(ocrResult.parsedDraft, result.batchId))
        setMessage(typeCorrection + (isScheduleParsedDraft(ocrResult.parsedDraft)
          ? 'Team schedule read complete. Review the visible matches before import.'
          : isTeamSummaryParsedDraft(ocrResult.parsedDraft)
            ? 'Player Roster read complete. Review the players before import.'
            : getAutoAssessmentMessage(ocrResult.autoAssessment, ocrResult.autoImport)))
        window.setTimeout(() => {
          document.getElementById('latest-data-assist-read')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 120)
      } else {
        if (scanRunRef.current !== scanRunId) return
        setMessage(`Data Assist upload saved with ${result.screenshotCount} export${result.screenshotCount === 1 ? '' : 's'}. Nothing has been imported yet.`)
      }
      if (scanRunRef.current === scanRunId) setSaving(false)
      void refreshSubmissions()
    } catch (err) {
      if (scanRunRef.current === scanRunId) {
        setError(err instanceof Error ? err.message : 'Data Assist upload could not be saved.')
      }
    } finally {
      if (scanRunRef.current === scanRunId) setSaving(false)
    }
  }

  async function reviewLatestScan(decision: 'confirmed' | 'flagged') {
    if (!latestScan || reviewingSubmissionId) return
    const reviewLabel = getParsedDraftReviewLabel(latestScan.parsedDraft)
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
        ? `${reviewLabel} confirmed. TenAceIQ is preparing this upload.`
        : `Thanks. This ${reviewLabel.toLowerCase()} is marked for a closer look.`))
      if (decision === 'confirmed' && result.autoImport?.ok) {
        const didReturn = isScorecardParsedDraft(latestScan.parsedDraft)
          ? finishScorecardImport(latestScan.parsedDraft)
          : isCaptainImportDraft(latestScan.parsedDraft)
            ? await finishCaptainImport({
                batchId: latestScan.batchId,
                parsedDraft: latestScan.parsedDraft,
                result: result.autoImport,
              })
            : false
        if (didReturn) return
        completeUploadFlow(
          'Upload complete.',
          buildImportedDataAssistOutcome(latestScan.parsedDraft, latestScan.batchId),
        )
        await refreshSubmissions()
        return
      } else {
        setLatestScan(null)
      }
      setSummary(null)
      setSavedBatchId('')
      setFocusedSubmissionId(latestScan.batchId)
      setOutcome({
        tone: 'review',
        title: decision === 'flagged' ? `${reviewLabel} sent for review` : `${reviewLabel} review saved`,
        detail: decision === 'flagged'
          ? 'TiQ saved your note for a closer check. This upload will not change records until it is resolved.'
          : 'Your review is saved. Open the upload below whenever you need to check its status.',
        batchId: latestScan.batchId,
        target: 'history',
      })
      await refreshSubmissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this Data Assist review.')
    } finally {
      setReviewingSubmissionId('')
    }
  }

  async function reviewSubmission(submission: DataAssistSubmission, decision: 'confirmed' | 'flagged') {
    if (!submission.draftId || reviewingSubmissionId) return
    const reviewLabel = getDataAssistImportTypeLabel(submission.requestedImportType)
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
        ? `${reviewLabel} confirmed. Contribution credit updated.`
        : `Thanks. This ${reviewLabel.toLowerCase()} is marked for a closer look.`))
      if (decision === 'confirmed' && result.autoImport?.ok) {
        const didReturn = isScorecardParsedDraft(submission.parsedPayload)
          ? finishScorecardImport(submission.parsedPayload)
          : isCaptainImportDraft(submission.parsedPayload)
            ? await finishCaptainImport({
                batchId: submission.id,
                parsedDraft: submission.parsedPayload,
                result: result.autoImport,
              })
            : false
        if (didReturn) return
      }
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
      if (action === 'commit' && result.ok) {
        const didReturn = isScorecardParsedDraft(submission.parsedPayload)
          ? finishScorecardImport(submission.parsedPayload)
          : isCaptainImportDraft(submission.parsedPayload)
            ? await finishCaptainImport({
                batchId: submission.id,
                parsedDraft: submission.parsedPayload,
                result,
              })
            : false
        if (didReturn) return
      }
      if (action === 'commit') await refreshSubmissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not run this Data Assist import.')
    } finally {
      setImportingSubmissionId('')
    }
  }

  async function deleteSubmission(submission: DataAssistSubmission) {
    if (deletingSubmissionId) return
    if (!window.confirm('Remove this saved Data Assist upload from your history?')) return

    setDeletingSubmissionId(submission.id)
    setMessage('')
    setError('')

    try {
      const result = await deleteMyDataAssistSubmission(submission.id)
      setMessage(result.message)
      setSubmissions((current) => current.filter((item) => item.id !== submission.id))
      await refreshSubmissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this saved Data Assist upload.')
    } finally {
      setDeletingSubmissionId('')
    }
  }

  async function deleteAllDraftSubmissions() {
    if (bulkDeletingHistory) return
    const removableSubmissions = submissions.filter((submission) => submission.status !== 'imported')
    if (!removableSubmissions.length) {
      setMessage('No removable uploads in history. Imported items stay available as references.')
      return
    }
    if (!window.confirm(`Remove ${removableSubmissions.length} saved upload${removableSubmissions.length === 1 ? '' : 's'} from your Data Assist history? Imported items will stay.`)) return

    setBulkDeletingHistory(true)
    setMessage('')
    setError('')

    try {
      for (const submission of removableSubmissions) {
        await deleteMyDataAssistSubmission(submission.id)
      }
      setMessage(`Removed ${removableSubmissions.length} saved upload${removableSubmissions.length === 1 ? '' : 's'}. Imported references stayed in history.`)
      setSubmissions((current) => current.filter((submission) => submission.status === 'imported'))
      await refreshSubmissions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove all saved uploads.')
    } finally {
      setBulkDeletingHistory(false)
    }
  }

  return (
    <section style={pageStyle(isMobile)}>
      {!showOrderStep && message && !outcome ? <div style={successStyle}>{message}</div> : null}
      {!showOrderStep && error ? <UploadIssueNotice message={error} onStartOver={resetUploadFlow} /> : null}
      {intent ? <DataAssistIntentPanel intent={intent} context={intentContext} query={intentQuery} /> : null}
      {outcome ? <DataAssistOutcomePanel outcome={outcome} onUploadAnother={resetUploadFlow} /> : null}
      {showBulkScorecardResults ? (
        <BulkScorecardResultsPanel
          results={bulkScorecardResults}
          onStartOver={resetUploadFlow}
          onReviewNow={openBulkScorecardReview}
        />
      ) : null}

      <section style={workspaceStyle()}>
        {showUploadStep ? (
          <section id="upload" style={dynamicPanelStyle}>
            <div style={dynamicSectionHeaderStyle}>
              <div style={headerCopyStyle}>
                <StepBadge step={1} label="Data Assist" />
                <h1 style={sectionTitleStyle}>Add new tennis data.</h1>
                <p style={copyStyle}>{scorecardPhotoReaderReady
                  ? 'Add a TennisLink export or a clear scorecard photo. TiQ reads it first; you confirm it before it changes a match.'
                  : 'Choose the source, add its TennisLink export, then review what TiQ found.'}</p>
              </div>
              <span style={pillStyle}>{userId ? 'Account ready' : authResolved ? 'Sign in needed' : 'Checking account'}</span>
            </div>

            <UploadJourneyRail />

            <DataAssistWalkthroughHelp />

            {authResolved && !userId ? (
              <div style={noticeStyle}>
                Sign in first, then choose the supported export. Data Assist saves it to your TenAceIQ account for review.
                <Link href="/login?redirect=/data-assist" style={inlineLinkStyle}>Sign in</Link>
              </div>
            ) : null}

            {scorecardUploadBlocked ? (
              <ScorecardUploadPausedPanel message={scorecardUploadPausedMessage} />
            ) : null}

            {scorecardCameraRequested ? (
              <section id="capture-scorecard" style={scorecardCapturePanelStyle} aria-labelledby="scorecard-capture-title">
                <div style={headerCopyStyle}>
                  <span style={dropzoneKickerStyle}>Scorecard camera</span>
                  <h2 id="scorecard-capture-title" style={capturePanelTitleStyle}>
                    {scorecardCaptureReady ? 'Ready to capture.' : 'Use the verified scorecard.'}
                  </h2>
                  <p style={copyStyle}>
                    {scorecardCaptureReady
                      ? 'Take a clear, straight-on photo of the completed scorecard. TiQ reads it first, then you review every court before it changes a match.'
                      : 'Photo reading is not enabled here yet. Record final scores manually or upload a TennisLink scorecard export.'}
                  </p>
                </div>
                {scorecardCaptureReady ? (
                  <button
                    type="button"
                    style={{ ...primaryButtonStyle, ...(scorecardUploadBlocked || preparing ? disabledStyle : {}) }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={scorecardUploadBlocked || preparing}
                  >
                    {preparing ? 'Preparing…' : scorecardCaptureButtonLabel}
                  </button>
                ) : scorecardCaptureUnavailable && returnTo ? (
                  <Link href={returnTo} style={secondaryButtonStyle}>Record results</Link>
                ) : null}
              </section>
            ) : null}

            <DataAssistSourcePathPanel
              selectedImportType={importType}
              onSelectImportType={chooseImportType}
              issueHref={buildDataAssistIssueHref(intentContext, intentQuery)}
            />

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={scorecardCaptureReady ? 'image/jpeg,image/png,image/webp' : acceptedUploadTypes}
              capture={scorecardPhotoReaderReady && scorecardCameraRequested ? 'environment' : undefined}
              onChange={(event) => void handleFiles(event)}
              style={hiddenFileInputStyle}
            />

            <details style={typeOverrideDetailsStyle}>
              <summary style={typeOverrideSummaryStyle}>
                <span>Having trouble?</span>
                <strong>Choose file type</strong>
              </summary>
              <label style={dynamicImportTypeSelectWrapStyle}>
                <span style={dropzoneKickerStyle}>File type override</span>
                <select
                  value={importType}
                  onChange={(event) => updateImportType(event.target.value as DataAssistImportType)}
                  style={dynamicImportTypeSelectStyle}
                >
                  {importTypes.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <small style={dynamicImportTypeSelectHintStyle}>
                  {scorecardUploadBlocked ? 'Scorecard uploads are temporarily paused.' : 'Only use this when TenAceIQ cannot identify the export.'}
                </small>
              </label>
            </details>

            {!hasPreparedScreenshots ? (
              isCompactViewport ? (
                <DataAssistDetailsSection
                  eyebrow="Export help"
                  title="Need upload help?"
                  cue="Show steps"
                  defaultOpen={exportHelpRequested}
                >
                  <div style={mobileUploadHelpStackStyle}>
                    <div style={simpleHelpStyle}>
                      <strong>{getUploadHelpTitle(importType)}</strong>
                      <span>{getUploadHelpText(importType)}</span>
                    </div>
                    {!exportHelpRequested ? (
                      <div style={seasonGuideStyle}>
                        <strong>Scorecards can stand alone</strong>
                        <span>A scorecard import will not break if schedule or roster setup is missing. TenAceIQ links what it can and creates the missing player/match context it needs.</span>
                      </div>
                    ) : null}
                    <ExportHelpPanel importType={importType} defaultOpen={exportHelpRequested} />
                    {!exportHelpRequested ? (
                      <>
                        <DataAssistReviewFlowPanel />
                        <DataAssistTrustEnginePanel />
                      </>
                    ) : null}
                  </div>
                </DataAssistDetailsSection>
              ) : (
                <>
                  <div style={simpleHelpStyle}>
                    <strong>{getUploadHelpTitle(importType)}</strong>
                    <span>{getUploadHelpText(importType)}</span>
                  </div>
                  {!exportHelpRequested ? (
                    <div style={seasonGuideStyle}>
                      <strong>Scorecards can stand alone</strong>
                      <span>A scorecard import will not break if schedule or roster setup is missing. TenAceIQ links what it can and creates the missing player/match context it needs.</span>
                    </div>
                  ) : null}
                  <ExportHelpPanel importType={importType} defaultOpen={exportHelpRequested} />
                </>
              )
            ) : null}

            {!isCompactViewport ? (
              <>
                <DataAssistDetailsSection
                  eyebrow="Review-first upload"
                  title="What happens after an upload?"
                  cue="Show review steps"
                >
                  <DataAssistReviewFlowPanel />
                </DataAssistDetailsSection>
                <DataAssistDetailsSection
                  eyebrow="Trust signals"
                  title="Know what changes records."
                  cue="Show data-quality details"
                >
                  <DataAssistTrustEnginePanel />
                </DataAssistDetailsSection>
              </>
            ) : null}

          </section>
        ) : null}

      </section>

      {showOrderStep ? (
      <section style={dynamicPanelStyle}>
        <div style={sectionHeaderStyle}>
          <div style={headerCopyStyle}>
            <StepBadge step={3} label="Scan setup" />
            <h2 style={sectionTitleStyle}>Ready to scan.</h2>
            <p style={copyStyle}>{summary ? getScanSetupText(summary.requestedImportType, summary.screenshots.length) : 'TennisLink exports are ready.'}</p>
          </div>
          {summary ? <span style={pillStyle}>{summary.screenshots.length} export{summary.screenshots.length === 1 ? '' : 's'}</span> : null}
        </div>

        <label style={replaceExportPickerStyle}>
            <input
              type="file"
              multiple={summary?.requestedImportType === 'scorecard'}
              accept={acceptedUploadTypes}
              capture={scorecardPhotoReaderReady && scorecardCameraRequested ? 'environment' : undefined}
            onChange={(event) => void handleFiles(event)}
            disabled={summaryScorecardUploadBlocked}
            style={replaceExportInputStyle}
          />
          <span style={dropzoneKickerStyle}>Replace export</span>
          <strong>{summaryScorecardUploadBlocked ? 'Scorecard uploads paused' : preparing ? 'Preparing...' : 'Choose a different supported export'}</strong>
          <small>{summaryScorecardUploadBlocked ? 'Start over and choose Schedule or Player Roster, or wait for admins to restore scorecard upload access.' : summary?.requestedImportType === 'scorecard' ? `You can also choose up to ${DATA_ASSIST_MAX_BULK_SCORECARDS} scorecard exports to catch up.` : 'Use a separate upload for each schedule or roster export.'}</small>
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
            Upload a supported export from the page you want TenAceIQ to import.
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
              {saving ? `Reading ${summary?.requestedImportType === 'schedule' ? 'schedule' : summary?.requestedImportType === 'team_summary' ? 'roster' : 'scorecard'}...` : 'Import now'}
          </button>
          <button type="button" onClick={resetUploadFlow} style={secondaryButtonStyle}>Cancel upload</button>
          <span style={hintStyle}>Clean exports import automatically. Anything uncertain stops here for review.</span>
        </div>

        {saving ? (
          <div style={scanLoadingStyle}>
            <TiqLoader label="Preparing review" size="sm" />
            <p style={scanLoadingCopyStyle}>
              TenAceIQ is reading the export and importing table data.
            </p>
          </div>
        ) : null}

        {savedBatchId ? (
          <div style={successStyle}>Upload saved: {savedBatchId.slice(0, 8).toUpperCase()}</div>
        ) : null}
        {message ? <div style={successStyle}>{message}</div> : null}
        {error ? <UploadIssueNotice message={error} onStartOver={resetUploadFlow} /> : null}
      </section>
      ) : null}

      {showScanStep ? (
        <section style={dynamicPanelStyle}>
          <div style={scanLoadingStyle}>
            <TiqLoader label="Preparing review" size="sm" />
            <p style={scanLoadingCopyStyle}>
              TenAceIQ is reading the export and importing table data.
            </p>
            <button type="button" onClick={resetUploadFlow} style={secondaryButtonStyle}>Cancel upload</button>
          </div>
        </section>
      ) : null}

        {showLatestReviewStep && latestScan ? (
          <section id="latest-data-assist-read" ref={latestReadRef} style={latestReadStyle}>
            {latestScan.autoImport?.importPreview?.duplicateMatch ? (
              <DuplicateImportBanner
                matchId={isScorecardParsedDraft(latestScan.parsedDraft) ? latestScan.parsedDraft.externalMatchId : ''}
                message={latestScan.autoImport.message}
              />
            ) : null}
            <div style={submissionCardTopStyle}>
              <div style={headerCopyStyle}>
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
              <TeamSummaryImportedPanel
                result={latestScan.autoImport}
                parsedDraft={latestScan.parsedDraft}
                context={intentContext}
                returnTo={returnTo}
              />
            ) : isScheduleParsedDraft(latestScan.parsedDraft) && latestScan.autoImport?.ok ? (
              <ScheduleImportedSummaryPanel
                result={latestScan.autoImport}
                parsedDraft={latestScan.parsedDraft}
                context={intentContext}
              />
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
                returnTo={returnTo}
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
        key={focusedSubmissionId || (outcome ? `data-assist-history-${outcome.tone}` : 'data-assist-history')}
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
        focusedSubmissionId={focusedSubmissionId}
        forceHistoryOpen={Boolean(outcome)}
        initialHistoryFilter={focusedHistoryFilter}
        isMobile={isMobile}
        returnTo={returnTo}
      />
      ) : null}
      {showUploadStep ? (
        <DataAssistDetailsSection
          eyebrow="Player tools"
          title="Want the player path around this data?"
          cue="Show player paths"
        >
          <PlayerSuitePanel active="refresh" playerLabel="Data refresh" />
          <section style={newPlayerActionPanelStyle} aria-label="New player next steps">
            <div style={newPlayerActionCopyStyle}>
              <strong>New player path</strong>
              <span>Get enough verified tennis context for a useful TIQ read.</span>
            </div>
            <div style={newPlayerActionGridStyle}>
              {newPlayerActions.map((action) => (
                <Link key={action.href} href={action.href} style={newPlayerActionLinkStyle}>
                  <strong>{action.label}</strong>
                  <span>{action.detail}</span>
                </Link>
              ))}
            </div>
          </section>
        </DataAssistDetailsSection>
      ) : null}
    </section>
  )
}

function DataAssistDetailsSection({
  eyebrow,
  title,
  cue,
  defaultOpen = false,
  children,
}: {
  eyebrow: string
  title: string
  cue: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const { isMobile, isTablet } = useViewportBreakpoints()
  const [open, setOpen] = useState(defaultOpen)
  const isCompactViewport = isMobile || isTablet
  const dynamicSummaryStyle: CSSProperties = {
    ...dataAssistDetailsSummaryStyle,
    display: isCompactViewport ? 'grid' : dataAssistDetailsSummaryStyle.display,
    gridTemplateColumns: isCompactViewport ? 'minmax(0, 1fr) minmax(0, auto)' : undefined,
    gap: isCompactViewport ? 7 : dataAssistDetailsSummaryStyle.gap,
    padding: isCompactViewport ? '7px 8px' : dataAssistDetailsSummaryStyle.padding,
    borderRadius: isCompactViewport ? 10 : dataAssistDetailsSummaryStyle.borderRadius,
  }
  const dynamicEyebrowStyle: CSSProperties = {
    ...dataAssistDetailsEyebrowStyle,
    fontSize: isCompactViewport ? 9 : dataAssistDetailsEyebrowStyle.fontSize,
  }
  const dynamicTitleStyle: CSSProperties = {
    ...dataAssistDetailsTitleStyle,
    fontSize: isCompactViewport ? 13 : dataAssistDetailsTitleStyle.fontSize,
  }
  const dynamicCueStyle: CSSProperties = {
    ...dataAssistDetailsCueStyle,
    fontSize: isCompactViewport ? 10 : dataAssistDetailsCueStyle.fontSize,
  }

  return (
    <details
      className="dataAssistDetailsSection"
      style={dataAssistDetailsSectionStyle}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary style={dynamicSummaryStyle}>
        <span style={dataAssistDetailsSummaryCopyStyle}>
          <span style={dynamicEyebrowStyle}>{eyebrow}</span>
          <strong style={dynamicTitleStyle}>{title}</strong>
        </span>
        <span style={dynamicCueStyle}>{isCompactViewport ? 'Open' : cue}</span>
      </summary>
      <div className="dataAssistDetailsBody" style={dataAssistDetailsContentStyle}>{children}</div>
    </details>
  )
}

function DataAssistTrustEnginePanel() {
  return (
    <section style={trustEnginePanelStyle} aria-labelledby="data-assist-trust-title">
      <div style={trustEngineCopyStyle}>
        <span style={trustEngineEyebrowStyle}>Fix Data / Data Assist</span>
        <h2 id="data-assist-trust-title" style={trustEngineTitleStyle}>Help keep TenAceIQ accurate.</h2>
        <p style={copyStyle}>
          Upload scorecards, schedules, Player Rosters, and corrections. Reviewed data can improve player profiles,
          teams, leagues, rankings, matchup reads, and My Lab.
        </p>
      </div>
      <div style={trustSignalGridStyle} aria-label="Data quality signals">
        {dataAssistTrustSignals.map((signal) => (
          <div key={signal.label} style={trustSignalCardStyle}>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </div>
        ))}
      </div>
      <div style={playerIdSignalPathStyle} aria-label="Data Assist player ID signal path">
        {dataAssistPlayerIdSignalPath.map((item) => (
          <article key={item.label} style={playerIdSignalCardStyle}>
            <span style={playerIdSignalLabelStyle}>{item.label}</span>
            <strong style={playerIdSignalTitleStyle}>{item.title}</strong>
            <p style={playerIdSignalTextStyle}>{item.body}</p>
          </article>
        ))}
      </div>
      <div style={dataAssistPlayerIdStarterStyle} aria-label="Data Assist Player ID starter">
        <div style={dataAssistPlayerIdStarterHeaderStyle}>
          <span style={playerIdSignalLabelStyle}>Player ID starter</span>
          <strong style={playerIdSignalTitleStyle}>{DATA_ASSIST_PLAYER_IDENTITY_READ.label}</strong>
          <p style={playerIdSignalTextStyle}>{DATA_ASSIST_PLAYER_IDENTITY_READ.levelUpNudge}</p>
        </div>
        <div style={dataAssistPlayerIdStarterGridStyle} aria-label="Data Assist Player ID starter read">
          {dataAssistPlayerIdStarterRead.map((item) => (
            <article key={item.label} style={dataAssistPlayerIdStarterCardStyle}>
              <span style={dataAssistPlayerIdStarterLabelStyle}>{item.label}</span>
              <strong style={dataAssistPlayerIdStarterValueStyle}>{item.value}</strong>
            </article>
          ))}
        </div>
        <div style={dataAssistPlayerIdStarterActionRowStyle}>
          <Link
            href={DATA_ASSIST_LEVEL_UP_HREF}
            style={secondaryButtonStyle}
            onClick={() => {
              void trackProductUsageEvent({
                eventName: 'data_assist_opened',
                surface: 'data_assist',
                metadata: {
                  location: 'data_assist_player_id_starter',
                  action: 'start_level_up',
                  identity: DATA_ASSIST_PLAYER_IDENTITY.slug,
                },
              })
            }}
          >
            Start Level Up
          </Link>
          <Link
            href={DATA_ASSIST_PLAYER_DEVELOPMENT_HREF}
            style={secondaryButtonStyle}
            onClick={() => {
              void trackProductUsageEvent({
                eventName: 'data_assist_opened',
                surface: 'data_assist',
                metadata: {
                  location: 'data_assist_player_id_starter',
                  action: 'read_player_id',
                  identity: DATA_ASSIST_PLAYER_IDENTITY.slug,
                },
              })
            }}
          >
            Read Player ID
          </Link>
        </div>
      </div>
      <div style={trustActionRowStyle} aria-label="Data quality actions">
        <a href="#upload" style={primaryButtonStyle}>
          Upload source
        </a>
        <Link
          href={buildDataAssistIssueHref()}
          style={secondaryButtonStyle}
          onClick={() => {
            void trackProductUsageEvent({
              eventName: 'data_issue_reported',
              surface: 'data_assist',
              metadata: {
                location: 'data_assist_trust_panel',
              },
            })
          }}
        >
          Report issue
        </Link>
        <a href="#history" style={secondaryButtonStyle}>
          Request review
        </a>
      </div>
    </section>
  )
}

function DataAssistSourcePathPanel({
  selectedImportType,
  onSelectImportType,
  issueHref,
}: {
  selectedImportType: DataAssistImportType
  onSelectImportType: (importType: DataAssistImportType) => void
  issueHref: string
}) {
  const { isMobile, isTablet } = useViewportBreakpoints()
  const isCompactViewport = isMobile || isTablet
  const dynamicPanelStyle = isCompactViewport ? compactSourcePathPanelStyle : sourcePathPanelStyle
  const dynamicHeaderStyle = isCompactViewport ? compactSourcePathHeaderStyle : sourcePathHeaderStyle
  const dynamicTitleStyle = isCompactViewport ? compactSourcePathTitleStyle : sourcePathTitleStyle
  const dynamicGridStyle = isCompactViewport ? compactSourcePathGridStyle : sourcePathGridStyle
  const dynamicCardStyle = isCompactViewport ? compactSourcePathCardStyle : sourcePathCardStyle

  return (
    <section style={dynamicPanelStyle} aria-labelledby="data-assist-source-path-title">
      <div style={dynamicHeaderStyle}>
        <div>
          <span style={sourcePathEyebrowStyle}>Source refresh path</span>
          <h2 id="data-assist-source-path-title" style={dynamicTitleStyle}>What are you adding?</h2>
          {isCompactViewport ? <p style={sourcePathIntroStyle}>Tap a source to choose its file.</p> : null}
        </div>
        {!isCompactViewport ? <p style={sourcePathIntroStyle}>
          Choose a source to open its file picker. TenAceIQ reviews it before records change.
        </p> : null}
      </div>
      <div style={dynamicGridStyle}>
        {dataAssistSourcePathJobs.map((job) => {
          const selected = selectedImportType === job.id
          return (
            <button
              key={job.id}
              type="button"
              style={{ ...dynamicCardStyle, ...(selected ? sourcePathSelectedCardStyle : {}) }}
              onClick={() => onSelectImportType(job.id)}
              data-data-assist-source-path-job={job.id}
              aria-label={`Upload ${job.title}: ${job.cta}`}
              aria-pressed={selected}
            >
              <span style={sourcePathCardTopStyle}>
                <TiqFeatureIcon name={job.icon} size="sm" variant="ghost" />
                <span style={selected ? sourcePathSelectedPillStyle : sourcePathReadyPillStyle}>
                  Upload
                </span>
              </span>
              {!isCompactViewport ? <span style={sourcePathQuestionStyle}>{job.question}</span> : null}
              <strong style={sourcePathCardTitleStyle}>{job.title}</strong>
              <span style={sourcePathCtaStyle}>{job.cta}</span>
              {!isCompactViewport ? <span>{job.body}</span> : null}
            </button>
          )
        })}
      </div>
      <Link
        href={issueHref}
        style={sourcePathSupportLinkStyle}
        onClick={() => {
          void trackProductUsageEvent({
            eventName: 'data_issue_reported',
            surface: 'data_assist',
            metadata: {
              location: 'data_assist_source_path',
            },
          })
        }}
      >
        Something looks wrong? Report a data issue <span aria-hidden="true">→</span>
      </Link>
    </section>
  )
}

function DataAssistReviewFlowPanel() {
  return (
    <section style={reviewFlowPanelStyle} aria-labelledby="data-assist-review-flow-title">
      <div style={reviewFlowHeaderStyle}>
        <span style={reviewFlowEyebrowStyle}>Review-first handoff</span>
        <h2 id="data-assist-review-flow-title" style={reviewFlowTitleStyle}>What happens after an upload?</h2>
        <p style={copyStyle}>
          Data Assist is intentionally review-first. It should make records more useful without hiding uncertainty.
        </p>
      </div>
      <div style={reviewFlowGridStyle}>
        {dataAssistReviewFlow.map((item) => (
          <article key={item.title} style={reviewFlowCardStyle}>
            <span style={reviewFlowStepStyle}>{item.step}</span>
            <strong style={reviewFlowCardTitleStyle}>{item.title}</strong>
            <p style={reviewFlowCardTextStyle}>{item.body}</p>
          </article>
        ))}
      </div>
      <div style={uploadStateProofStyle} aria-label="Upload review status">
        <div style={uploadStateProofHeaderStyle}>
          <span style={reviewFlowEyebrowStyle}>Upload review status</span>
          <strong style={uploadStateProofTitleStyle}>Know what changed and what did not.</strong>
        </div>
        <div style={uploadStateProofGridStyle}>
          {dataAssistUploadStateProof.map((item) => (
            <article key={item.label} style={uploadStateProofCardStyle}>
              <span style={uploadStateProofLabelStyle}>{item.label}</span>
              <p style={reviewFlowCardTextStyle}>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function DataAssistIntentPanel({ intent, context, query }: { intent: DataAssistIntent; context: string; query: string }) {
  const isReportIssue = intent === 'report-issue'
  const isUploadSource = intent === 'upload-source'
  return (
    <section style={intentPanelStyle} aria-label="Data Assist requested action">
      <div style={intentCopyStyle}>
        <span style={intentEyebrowStyle}>
          {isUploadSource ? 'Upload source' : isReportIssue ? 'Report issue' : 'Request review'}
        </span>
        <strong style={intentTitleStyle}>
          {isUploadSource
            ? 'Add the source behind this tennis read.'
            : isReportIssue
              ? 'Tell TenAceIQ what looks wrong.'
              : 'Send a source for review.'}
        </strong>
        <p style={intentTextStyle}>
          {isUploadSource
            ? 'Upload a scorecard, schedule, Player Roster, or correction source so TenAceIQ can connect it to the right player, team, league, tournament, or ranking.'
            : isReportIssue
              ? 'Use the support path for wrong players, teams, scores, ratings, draws, standings, or source labels.'
              : 'Upload a scorecard, schedule, Player Roster, or correction source so the data can move through review.'}
        </p>
        {context ? <span style={intentContextStyle}>From: {context}</span> : null}
        {query ? <span style={intentContextStyle}>Search: {query}</span> : null}
      </div>
      <div style={intentActionRowStyle}>
        {isReportIssue ? (
          <Link
            href={buildDataAssistIssueHref(context, query)}
            style={secondaryButtonStyle}
            onClick={() => {
              void trackProductUsageEvent({
                eventName: 'data_issue_reported',
                surface: 'data_assist',
                metadata: {
                  location: 'data_assist_intent_panel',
                  intent,
                  context,
                  query,
                },
              })
            }}
          >
            Open support report
          </Link>
        ) : null}
        <a href="#upload" style={primaryButtonStyle}>
          Upload source
        </a>
        <a href="#history" style={secondaryButtonStyle}>
          Review history
        </a>
      </div>
    </section>
  )
}

function DataAssistOutcomePanel({
  outcome,
  onUploadAnother,
}: {
  outcome: DataAssistOutcome
  onUploadAnother: () => void
}) {
  const targetId = outcome.target === 'latest-read' ? 'latest-data-assist-read' : 'history'
  const actionLabel = outcome.target === 'latest-read'
    ? 'Review this upload'
    : outcome.batchId
      ? 'Open import record'
      : 'Open import history'

  return (
    <section style={dataAssistOutcomeStyle(outcome.tone)} aria-live="polite" data-data-assist-outcome={outcome.tone}>
      <div style={dataAssistOutcomeHeaderStyle}>
        <div style={headerCopyStyle}>
          <span style={dataAssistOutcomeEyebrowStyle}>{outcome.tone === 'review' ? 'Your next action' : 'Import complete'}</span>
          <h2 style={dataAssistOutcomeTitleStyle}>{outcome.title}</h2>
          <p style={dataAssistOutcomeCopyStyle}>{outcome.detail}</p>
        </div>
        <span style={dataAssistOutcomePillStyle(outcome.tone)}>
          {outcome.tone === 'review' ? 'Needs review' : outcome.tone === 'duplicate' ? 'No duplicate created' : 'Saved'}
        </span>
      </div>
      <div style={dataAssistOutcomeActionRowStyle}>
        <a href={`#${targetId}`} style={primaryButtonStyle}>{actionLabel}</a>
        <button type="button" onClick={onUploadAnother} style={secondaryButtonStyle}>Upload another</button>
      </div>
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
    return 'Scorecard read complete. Review the parsed export before any import is committed.'
  }
  if (assessment.decision === 'auto_ready') {
    return 'Scorecard read complete. This scorecard passed auto-checks; no public records change until the import check finishes.'
  }
  if (assessment.decision === 'member_confirm') {
    return 'Scorecard read complete. TenAceIQ found a usable scorecard export; confirm the read before import.'
  }
  if (assessment.decision === 'admin_exception') {
    return 'Scorecard read complete. Some details need a closer look before import.'
  }
  return 'TenAceIQ could not safely read this scorecard export. Upload the TennisLink Score Card Excel file again.'
}

function buildImportedDataAssistOutcome(
  parsedDraft: DataAssistScorecardParsedDraft | DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft,
  batchId: string,
  duplicate = false,
): DataAssistOutcome {
  if (duplicate) {
    return {
      tone: 'duplicate',
      title: `${getDataAssistImportTypeLabel(getParsedDraftImportType(parsedDraft))} already in TiQ`,
      detail: 'TiQ kept the existing record and saved this upload in your history as proof. No duplicate was created.',
      batchId,
      target: 'history',
    }
  }

  if (isTeamSummaryParsedDraft(parsedDraft)) {
    return {
      tone: 'success',
      title: 'Roster imported',
      detail: `${parsedDraft.playerCount} player${parsedDraft.playerCount === 1 ? '' : 's'}, USTA ratings, and ${parsedDraft.contactCount || 0} available contact${parsedDraft.contactCount === 1 ? '' : 's'} are now connected for team tools.`,
      batchId,
      target: 'history',
    }
  }

  if (isScheduleParsedDraft(parsedDraft)) {
    return {
      tone: 'success',
      title: 'Schedule imported',
      detail: `${parsedDraft.matchCount} scheduled match${parsedDraft.matchCount === 1 ? '' : 'es'} are now ready for your team and captain views.`,
      batchId,
      target: 'history',
    }
  }

  return {
    tone: 'success',
    title: 'Scorecard imported',
    detail: 'The result is saved and ready to support player, team, and league context.',
    batchId,
    target: 'history',
  }
}

function buildReviewDataAssistOutcome(
  parsedDraft: DataAssistScorecardParsedDraft | DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft,
  batchId: string,
): DataAssistOutcome {
  return {
    tone: 'review',
    title: `${getDataAssistImportTypeLabel(getParsedDraftImportType(parsedDraft))} review ready`,
    detail: 'TiQ saved the upload but will not change player, team, league, or rating records until the visible details are checked.',
    batchId,
    target: 'latest-read',
  }
}

function getParsedDraftImportType(
  parsedDraft: DataAssistScorecardParsedDraft | DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft,
): DataAssistImportType {
  if (isTeamSummaryParsedDraft(parsedDraft)) return 'team_summary'
  if (isScheduleParsedDraft(parsedDraft)) return 'schedule'
  return 'scorecard'
}

function buildBulkScorecardMessage({
  total,
  importedCount,
  duplicateCount,
  reviewCount,
  failedCount,
}: {
  total: number
  importedCount: number
  duplicateCount: number
  reviewCount: number
  failedCount: number
}) {
  const parts = [
    importedCount ? `${importedCount} imported` : '',
    duplicateCount ? `${duplicateCount} already in TenAceIQ` : '',
    reviewCount ? `${reviewCount} need your confirmation` : '',
    failedCount ? `${failedCount} need another try` : '',
  ].filter(Boolean)
  return `Scorecard batch complete: ${parts.join(', ') || `${total} processed`}.`
}

function getBulkScorecardStatusLabel(status: BulkScorecardResult['status']) {
  if (status === 'pending') return 'Pending'
  if (status === 'imported') return 'Imported'
  if (status === 'duplicate') return 'Already in'
  if (status === 'review') return 'Confirm to import'
  return 'Retry'
}

function getBulkScorecardMatchMeta(value: unknown): Pick<BulkScorecardResult, 'matchId' | 'matchDate' | 'matchup'> {
  if (!isScorecardParsedDraft(value)) {
    return { matchId: '', matchDate: '', matchup: '' }
  }
  const matchup = value.homeTeam && value.awayTeam ? `${value.homeTeam} vs ${value.awayTeam}` : ''
  return {
    matchId: value.externalMatchId,
    matchDate: value.matchDate,
    matchup,
  }
}

function getBulkScorecardResultTitle(result: BulkScorecardResult) {
  return result.matchup || result.matchId || result.fileName
}

function getBulkScorecardResultDetail(result: BulkScorecardResult) {
  if (!result.matchup && !result.matchId && !result.matchDate) return result.detail
  return [
    result.matchDate,
    result.matchId ? `Match ${result.matchId}` : '',
    result.fileName,
  ].filter(Boolean).join(' - ')
}

function getShortImportTypeLabel(importType: DataAssistImportType) {
  if (importType === 'schedule') return 'schedule'
  if (importType === 'team_summary') return 'Player Roster'
  return 'scorecard'
}

function getUploadHelpTitle(importType: DataAssistImportType) {
  if (importType === 'schedule') return 'Flight or team schedule export'
  if (importType === 'team_summary') return 'Player Roster export'
  return 'Scorecard export'
}

function getUploadHelpText(importType: DataAssistImportType) {
  if (importType === 'schedule') {
    return 'Open the Match Schedule tab and choose Send To Excel. This is season setup; most teams only need it once.'
  }
  if (importType === 'team_summary') {
    return 'Open Player Roster and choose Send To Excel. This imports players, ratings, and the contact details TennisLink includes.'
  }
  return 'Open each Score Card and choose Send To Excel. Import one match after play or select several scorecards to catch up.'
}

function getExportHelpSteps(importType: DataAssistImportType) {
  if (importType === 'schedule') {
    return [
      'Open TennisLink and go to the Match Schedule tab.',
      'Choose Send To Excel.',
      'Upload the MatchSchedule .xls file here.',
    ]
  }
  if (importType === 'team_summary') {
    return [
      'Open TennisLink and go to Player Roster.',
      'Choose Send To Excel.',
      'Upload the PlayerRoster .xls file here.',
    ]
  }
  return [
    'Open the TennisLink scorecard.',
    'Choose Send To Excel.',
    'Upload the Scorecard .xls file here.',
  ]
}

function getExportFileExample(importType: DataAssistImportType) {
  if (importType === 'schedule') return 'MatchSchedule_582026.xls'
  if (importType === 'team_summary') return 'PlayerRoster_812026.xls'
  return 'Scorecard_582026.xls'
}

function DataAssistWalkthroughHelp() {
  return (
    <aside style={walkthroughHelpStyle} aria-labelledby="data-assist-walkthrough-title">
      <div style={walkthroughHelpCopyStyle}>
        <span style={walkthroughHelpKickerStyle}>New to TennisLink exports?</span>
        <strong id="data-assist-walkthrough-title">Watch the phone walkthrough first.</strong>
        <small>See where to tap in USTA, confirm each download, choose the file on your phone, and review it in TenAceIQ.</small>
      </div>
      <Link href="/resources/usta-upload" style={secondaryButtonStyle}>
        Watch walkthrough
      </Link>
    </aside>
  )
}

function ExportHelpPanel({ importType, defaultOpen = false }: { importType: DataAssistImportType; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const steps = getExportHelpSteps(importType)

  return (
    <div style={exportHelpStyle}>
      <button type="button" onClick={() => setOpen((current) => !current)} style={exportHelpToggleStyle}>
        <span>How to get this export</span>
        <strong>{open ? 'Hide' : 'Show'}</strong>
      </button>
      {open ? (
        <div style={exportHelpBodyStyle}>
          {steps.map((step, index) => (
            <div key={step} style={exportHelpStepStyle}>
              <span>{index + 1}</span>
              <span>{step}</span>
            </div>
          ))}
          <div style={exportHelpExampleStyle}>
            Expected file: <strong>{getExportFileExample(importType)}</strong>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function UploadIssueNotice({
  message,
  onStartOver,
}: {
  message: string
  onStartOver: () => void
}) {
  const mixedExportIssue = /one at a time|one TennisLink Excel export|different TennisLink export types|scorecards, schedules, and (?:team summaries|Player Rosters)|schedules and (?:team summaries|Player Rosters)|up to \d+ scorecard/i.test(message)
  return (
    <div style={uploadIssueStyle}>
      <div style={headerCopyStyle}>
        <strong>{mixedExportIssue ? 'Use one export type per import' : 'Upload needs attention'}</strong>
        <p style={uploadIssueCopyStyle}>
          {mixedExportIssue
            ? `Scorecards can be selected together in batches of ${DATA_ASSIST_MAX_BULK_SCORECARDS}. Schedules and Player Rosters should be uploaded one at a time.`
            : message}
        </p>
        {mixedExportIssue ? <small style={hintStyle}>This keeps season setup clean while still supporting scorecard catch-up batches.</small> : null}
      </div>
      {mixedExportIssue ? (
        <button type="button" onClick={onStartOver} style={secondaryButtonStyle}>
          Start fresh
        </button>
      ) : null}
    </div>
  )
}

function ScorecardUploadPausedPanel({ message }: { message: string }) {
  return (
    <div style={scorecardPausedPanelStyle}>
      <div style={headerCopyStyle}>
        <strong>Scorecard uploads are paused</strong>
        <p style={uploadIssueCopyStyle}>{message}</p>
        <small style={hintStyle}>Schedule and Player Roster uploads still work. Admins can restore scorecard upload access after review.</small>
      </div>
      <Link href="/messages?compose=support&category=data&subject=Scorecard%20upload%20access" style={secondaryButtonStyle}>
        Contact support
      </Link>
    </div>
  )
}

function BulkScorecardResultsPanel({
  results,
  onStartOver,
  onReviewNow,
}: {
  results: BulkScorecardResult[]
  onStartOver: () => void
  onReviewNow: (submissionId: string) => void
}) {
  const importedCount = results.filter((result) => result.status === 'imported').length
  const duplicateCount = results.filter((result) => result.status === 'duplicate').length
  const reviewCount = results.filter((result) => result.status === 'review').length
  const failedCount = results.filter((result) => result.status === 'failed').length
  const pendingCount = results.filter((result) => result.status === 'pending').length

  return (
    <section style={panelStyle}>
      <div style={sectionHeaderStyle}>
        <div style={headerCopyStyle}>
          <StepBadge step={4} label="Batch results" />
          <h2 style={sectionTitleStyle}>
            {reviewCount ? `${reviewCount} scorecard${reviewCount === 1 ? '' : 's'} need your confirmation.` : 'Scorecards processed.'}
          </h2>
          <p style={copyStyle}>
            {pendingCount
              ? 'Each export is being saved and read as its own match.'
              : reviewCount
                ? 'Open each review, check the highlighted names and scores, then confirm. Until then, the result will not appear in league stats.'
                : 'Each export was saved and read as its own match.'}
          </p>
        </div>
        <span style={pendingCount || failedCount || reviewCount ? pillAmberStyle : pillGreenStyle}>
          {pendingCount ? 'Working' : failedCount || reviewCount ? 'Action needed' : 'Complete'}
        </span>
      </div>
      {reviewCount ? (
        <div role="alert" style={bulkResultReviewCalloutStyle}>
          <div style={headerCopyStyle}>
            <strong>One last step before the scoreboard moves</strong>
            <span>Confirmation imports the scorecard and updates player, team, and league records.</span>
          </div>
          <button
            type="button"
            onClick={() => onReviewNow(results.find((result) => result.status === 'review')?.batchId || '')}
            style={primaryButtonStyle}
          >
            Review scorecards now
          </button>
        </div>
      ) : null}
      <div style={scorecardHeaderGridStyle}>
        <ReviewFact label="Pending" value={String(pendingCount)} />
        <ReviewFact label="Imported" value={String(importedCount)} />
        <ReviewFact label="Already in" value={String(duplicateCount)} />
        <ReviewFact label="Needs confirmation" value={String(reviewCount)} />
        <ReviewFact label="Retry" value={String(failedCount)} />
      </div>
      <div style={bulkResultListStyle}>
        {results.map((result) => (
          <div key={`${result.batchId}-${result.fileName}-${result.status}-${result.matchId}-${result.matchDate}`} style={bulkResultRowStyle(result.status)}>
            <div style={bulkResultContentStyle}>
              <strong>{getBulkScorecardResultTitle(result)}</strong>
              <span>{getBulkScorecardResultDetail(result)}</span>
              {result.status === 'review' ? <small>{result.detail}</small> : null}
            </div>
            <div style={bulkResultActionStyle}>
              <span style={bulkResultStatusStyle}>{getBulkScorecardStatusLabel(result.status)}</span>
              {result.status === 'review' ? (
                <button type="button" onClick={() => onReviewNow(result.batchId)} style={smallButtonStyle}>
                  Review now
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div style={draftActionRowStyle}>
        <button type="button" onClick={onStartOver} style={primaryButtonStyle}>Upload more scorecards</button>
      </div>
    </section>
  )
}

function getScanSetupText(importType: DataAssistImportType, screenshotCount: number) {
  const plural = screenshotCount === 1 ? 'export' : 'exports'
  if (importType === 'schedule') return `${screenshotCount} ${plural} ready. TenAceIQ will import schedule rows from the table.`
  if (importType === 'team_summary') return `${screenshotCount} ${plural} ready. TenAceIQ will import roster names, ratings, and available contacts.`
  return `${screenshotCount} ${plural} ready. TenAceIQ will import the match result, line players, scores, and winners.`
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
      return 'Roster names, ratings, and available contacts are ready for captain work.'
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
    return 'TenAceIQ found a team schedule export. Review the match rows before importing.'
  }
  if (isTeamSummaryParsedDraft(scan.parsedDraft)) {
    return 'TenAceIQ found a Player Roster export. Review the team and players before importing.'
  }
  return getScorecardReviewLead(scan.parsedDraft)
}

function getParsedDraftReviewLabel(
  parsedDraft: DataAssistScorecardParsedDraft | DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft,
) {
  if (isScheduleParsedDraft(parsedDraft)) return 'Schedule'
  if (isTeamSummaryParsedDraft(parsedDraft)) return 'Roster'
  return 'Scorecard'
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
        {screenshot.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={screenshot.previewUrl} alt={`Export ${screenshot.uploadOrder}`} style={thumbnailStyle} />
        ) : (
          <div style={exportFilePreviewStyle}>XLS</div>
        )}
        <span style={orderBadgeStyle}>{screenshot.uploadOrder}</span>
      </div>
      <div style={screenshotBodyStyle}>
        <div style={screenshotHeaderStyle}>
          <strong style={screenshotFileNameStyle}>{screenshot.fileName}</strong>
          <span style={rejected ? pillDangerStyle : supported ? pillGreenStyle : pillAmberStyle}>
            {rejected ? 'Rejected' : supported ? 'Supported' : 'Review'}
          </span>
        </div>
        <p style={copyStyle}>
          {screenshot.imageWidth && screenshot.imageHeight ? `${screenshot.imageWidth} x ${screenshot.imageHeight} - ` : ''}
          {(screenshot.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
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
  focusedSubmissionId,
  forceHistoryOpen,
  initialHistoryFilter,
  isMobile,
  returnTo,
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
  focusedSubmissionId: string
  forceHistoryOpen: boolean
  initialHistoryFilter: DataAssistHistoryFilter
  isMobile: boolean
  returnTo: string
}) {
  const [historyOpen, setHistoryOpen] = useState(Boolean(focusedSubmissionId) || forceHistoryOpen)
  const [historyFilter, setHistoryFilter] = useState<DataAssistHistoryFilter>(focusedSubmissionId ? initialHistoryFilter : 'all')
  const pendingCount = contributorStats?.pendingReviewCount ?? submissions.filter((submission) => submission.status !== 'verified' && submission.status !== 'imported' && submission.status !== 'rejected').length
  const verifiedCount = contributorStats?.verifiedImportCount ?? submissions.filter((submission) => submission.status === 'verified' || submission.status === 'imported').length
  const importedCount = submissions.filter((submission) => submission.status === 'imported').length
  const accuracyScore = Math.round((contributorStats?.contributionAccuracyScore ?? 0) * 100)
  const removableCount = submissions.filter((submission) => submission.status !== 'imported').length
  const filteredSubmissions = filterDataAssistSubmissions(submissions, historyFilter)

  useEffect(() => {
    if (!focusedSubmissionId || !historyOpen) return
    const timeout = window.setTimeout(() => {
      document.getElementById(`data-assist-submission-${focusedSubmissionId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 80)
    return () => window.clearTimeout(timeout)
  }, [focusedSubmissionId, historyOpen, submissions])

  function openHistory(filter: DataAssistHistoryFilter = 'all') {
    setHistoryFilter(filter)
    setHistoryOpen(true)
    window.setTimeout(() => document.getElementById('data-assist-history-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  if ((!authResolved || !userId) && isMobile) {
    return (
      <section id="history" style={mobileHistoryShellStyle}>
        <DataAssistDetailsSection
          eyebrow="History"
          title="Saved uploads"
          cue="Show history"
        >
          <div style={noticeStyle}>
            Sign in to keep Data Assist uploads tied to your profile across devices.{' '}
            <Link href="/login?redirect=/data-assist" style={noticeLinkStyle}>Sign in</Link>
          </div>
        </DataAssistDetailsSection>
      </section>
    )
  }

  return (
    <section id="history" style={panelStyle}>
      <div style={sectionHeaderStyle}>
        <div style={headerCopyStyle}>
          <div className="section-kicker">Upload activity</div>
          <h2 style={sectionTitleStyle}>Know what happened next.</h2>
        </div>
        <div style={cardActionRowStyle}>
          <button type="button" onClick={() => setHistoryOpen((current) => !current)} style={smallButtonStyle}>
            {historyOpen ? 'Hide history' : `Show history${submissions.length ? ` (${submissions.length})` : ''}`}
          </button>
        </div>
      </div>

      {authResolved && userId ? (
        <DataAssistOperationsPanel
          pendingCount={pendingCount}
          importedCount={importedCount}
          totalCount={submissions.length}
          onOpenReview={() => openHistory('needs_review')}
          onOpenHistory={() => openHistory('all')}
        />
      ) : null}

      {!authResolved || !userId ? (
        <div style={noticeStyle}>
          Sign in to keep Data Assist uploads tied to your profile across devices.{' '}
          <Link href="/login?redirect=/data-assist" style={noticeLinkStyle}>Sign in</Link>
        </div>
      ) : !historyOpen ? (
        <div style={historyCollapsedStyle}>
          {submissions.length
            ? `${submissions.length} saved upload${submissions.length === 1 ? '' : 's'} in history.`
            : 'No saved uploads yet.'}
        </div>
      ) : submissions.length ? (
        <div id="data-assist-history-records" style={historyRecordsStyle}>
          <div style={historyManagementStyle}>
            <span>Imported uploads stay as references. Drafts and review items can be removed.</span>
            <div style={cardActionRowStyle}>
              <button type="button" onClick={onRefresh} disabled={!authResolved || !userId || loading} style={smallButtonStyle}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={onDeleteAllDrafts}
                disabled={!authResolved || !userId || loading || bulkDeleting || removableCount === 0}
                style={{ ...smallDangerButtonStyle, ...((!authResolved || !userId || loading || bulkDeleting || removableCount === 0) ? disabledStyle : {}) }}
              >
                {bulkDeleting ? 'Removing...' : 'Remove saved uploads'}
              </button>
            </div>
          </div>
          <div style={submissionStatsStyle}>
            <SubmissionStat label="Pending review" value={pendingCount} />
            <SubmissionStat label="Verified quality" value={verifiedCount} />
            <SubmissionStat label="Accuracy score" value={`${accuracyScore}%`} />
            <SubmissionStat label="Scorecard uploads" value={contributorStats?.canUploadScorecards === false ? 'Paused' : 'Enabled'} />
          </div>
          {contributorStats?.canUploadScorecards === false ? (
            <div style={noticeStyle}>
              {contributorStats.uploadSuspensionReason || 'Scorecard uploads are paused while admins review recent match accuracy reports.'}
            </div>
          ) : null}
          <HistoryFilterTabs
            activeFilter={historyFilter}
            submissions={submissions}
            onChange={setHistoryFilter}
          />
          <ContributorBadges stats={contributorStats} />
          {filteredSubmissions.length ? (
            <div style={submissionListStyle}>
              {filteredSubmissions.map((submission) => (
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
                  returnTo={returnTo}
                />
              ))}
            </div>
          ) : (
            <div style={emptyStateStyle}>No uploads match this filter.</div>
          )}
        </div>
      ) : loading ? (
        <div style={emptyStateStyle}>Loading your submissions...</div>
      ) : (
        <EmptyDataAssistHistory />
      )}

      {error ? <div style={errorStyle}>{error}</div> : null}
    </section>
  )
}

function EmptyDataAssistHistory() {
  return (
    <div style={emptyHistoryStyle}>
      <div style={emptyHistoryCopyStyle}>
        <strong>First signal starts here.</strong>
        <span>Upload a scorecard, schedule, or Player Roster. After review, it feeds your profile, teams, and league tools.</span>
      </div>
      <div style={emptyHistoryActionRowStyle}>
        {emptyHistoryActions.map((action) => (
          <Link key={action.href} href={action.href} style={emptyHistoryActionStyle}>
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function DataAssistOperationsPanel({
  pendingCount,
  importedCount,
  totalCount,
  onOpenReview,
  onOpenHistory,
}: {
  pendingCount: number
  importedCount: number
  totalCount: number
  onOpenReview: () => void
  onOpenHistory: () => void
}) {
  return (
    <section style={dataAssistOperationsStyle} aria-label="Upload operations">
      <button type="button" onClick={onOpenReview} style={dataAssistOperationCardStyle(pendingCount > 0 ? 'review' : 'clear')} data-data-assist-operation="review">
        <span style={dataAssistOperationLabelStyle}>Needs your review</span>
        <strong style={dataAssistOperationValueStyle}>{pendingCount}</strong>
        <small style={dataAssistOperationDetailStyle}>
          {pendingCount ? 'Open the review queue' : 'Nothing waiting on you'}
        </small>
      </button>
      <button type="button" onClick={onOpenHistory} style={dataAssistOperationCardStyle('history')} data-data-assist-operation="history">
        <span style={dataAssistOperationLabelStyle}>Import history</span>
        <strong style={dataAssistOperationValueStyle}>{totalCount}</strong>
        <small style={dataAssistOperationDetailStyle}>
          {importedCount ? `${importedCount} imported record${importedCount === 1 ? '' : 's'} saved` : 'Open saved uploads'}
        </small>
      </button>
    </section>
  )
}

type DataAssistHistoryFilter = 'all' | 'imported' | 'needs_review' | DataAssistImportType

const historyFilters: Array<{ id: DataAssistHistoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'imported', label: 'Imported' },
  { id: 'needs_review', label: 'Needs review' },
  { id: 'scorecard', label: 'Scorecards' },
  { id: 'schedule', label: 'Schedules' },
  { id: 'team_summary', label: 'Rosters' },
]

function HistoryFilterTabs({
  activeFilter,
  submissions,
  onChange,
}: {
  activeFilter: DataAssistHistoryFilter
  submissions: DataAssistSubmission[]
  onChange: (filter: DataAssistHistoryFilter) => void
}) {
  return (
    <div style={historyFilterStyle}>
      {historyFilters.map((filter) => {
        const count = filterDataAssistSubmissions(submissions, filter.id).length
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onChange(filter.id)}
            style={historyFilterButtonStyle(activeFilter === filter.id)}
          >
            {filter.label}
            <span>{count}</span>
          </button>
        )
      })}
    </div>
  )
}

function filterDataAssistSubmissions(submissions: DataAssistSubmission[], filter: DataAssistHistoryFilter) {
  if (filter === 'all') return submissions
  if (filter === 'imported') return submissions.filter((submission) => submission.status === 'imported')
  if (filter === 'needs_review') return submissions.filter((submission) => submission.status !== 'imported' && submission.status !== 'verified' && submission.status !== 'rejected')
  return submissions.filter((submission) => submission.requestedImportType === filter)
}

function StepBadge({ step, label }: { step: number; label: string }) {
  return (
    <div style={stepBadgeStyle}>
      <span style={stepBadgeNumberStyle}>{step}</span>
      <strong>{label}</strong>
    </div>
  )
}

function UploadJourneyRail() {
  return (
    <div aria-label="Upload progress" style={uploadJourneyRailStyle}>
      {uploadJourneySteps.map((item) => (
        <span key={item.step} style={item.active ? uploadJourneyActiveStepStyle : uploadJourneyStepStyle}>
          <strong style={uploadJourneyStepNumberStyle}>{item.step}</strong>
          <span>{item.label}</span>
        </span>
      ))}
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
      <div style={headerCopyStyle}>
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
  returnTo,
}: {
  submission: DataAssistSubmission
  busy: boolean
  onReview: (submission: DataAssistSubmission, decision: 'confirmed' | 'flagged') => void
  importing: boolean
  deleting: boolean
  importResult?: DataAssistImportActionResult
  onRunImport: (submission: DataAssistSubmission, action: 'preview' | 'commit') => void
  onDelete: (submission: DataAssistSubmission) => void
  returnTo: string
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
    <article id={`data-assist-submission-${submission.id}`} style={submissionCardStyle}>
      <div style={submissionCardTopStyle}>
        <div style={headerCopyStyle}>
          <strong>{getDataAssistImportTypeLabel(submission.requestedImportType)}</strong>
          <p style={copyStyle}>
            {formatDate(submission.createdAt)} - {submission.screenshotCount} export{submission.screenshotCount === 1 ? '' : 's'} - {Math.round(submission.confidenceScore * 100)}% confidence
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
            <ImportedSummaryPanel summary={importSummary} parsedDraft={parsedDraft} returnTo={returnTo} />
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
            {deleting ? 'Removing...' : 'Remove upload'}
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
  const isCorrection = Boolean(preview?.duplicateMatch?.hasChanges)
  const isDuplicate = Boolean(preview?.duplicateMatch && !preview.duplicateMatch.hasChanges)
  const commitBlocked = unresolvedWinnerCount > 0 || !canCommit

  return (
    <div style={importPanelStyle}>
      <div style={submissionCardTopStyle}>
        <div style={headerCopyStyle}>
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
            <ReviewFact label="Status" value={isDuplicate ? 'Already imported' : isCorrection ? 'Ready to update' : unresolvedWinnerCount ? `${unresolvedWinnerCount} unresolved` : 'Ready'} />
            <ReviewFact label="Players" value={newPlayers ? `${newPlayers} new` : likelyPlayers ? `${likelyPlayers} likely` : 'Matched'} />
          </div>
          {isDuplicate ? (
            <div style={readyImportNoteStyle}>
              <strong>Duplicate found</strong>
              <span>This TennisLink match is already in TenAceIQ. Import will not create a second result.</span>
            </div>
          ) : null}
          {isCorrection ? (
            <div style={readyImportNoteStyle}>
              <strong>Correction found</strong>
              <span>Commit updates the saved result and Team Chat without creating another match.</span>
            </div>
          ) : null}
          <div style={parsedLineListStyle}>
            {preview.playerMappings.slice(0, 6).map((mapping) => (
              <div key={mapping.name} style={parsedLineStyle}>
                <span style={parsedLineNameStyle}>{mapping.name}</span>
                <strong style={parsedLineStatusStyle}>{mapping.status}</strong>
                <small style={parsedLineDetailStyle}>{mapping.matchedPlayerName || 'Will be created from TennisLink name'}</small>
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
  returnTo = '',
}: {
  summary: SubmissionImportSummary
  parsedDraft: DataAssistScorecardParsedDraft | null
  returnTo?: string
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
        <div style={headerCopyStyle}>
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
      <PostImportActions
        actions={buildScorecardPostImportActions(parsedDraft, returnTo)}
      />
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
      <div style={headerCopyStyle}>
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
      <ScheduleRowsList parsedDraft={parsedDraft} />
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
  context = '',
}: {
  result: DataAssistImportActionResult
  parsedDraft: DataAssistScheduleParsedDraft
  context?: string
}) {
  const scheduleResult = result.importResult?.kind === 'schedule' ? result.importResult.result : null
  const imported = scheduleResult ? scheduleResult.successCount + scheduleResult.updatedCount : parsedDraft.matchCount
  const updated = scheduleResult?.updatedCount ?? 0

  return (
    <div style={importPanelStyle}>
      <div style={submissionCardTopStyle}>
        <div style={headerCopyStyle}>
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
      <ScheduleRowsList parsedDraft={parsedDraft} />
      <div style={readyImportNoteStyle}>
        <strong>All set</strong>
        <span>{result.message || 'Team schedule imported to TenAceIQ.'}</span>
      </div>
      <PostImportActions
        actions={buildSchedulePostImportActions(parsedDraft, context)}
      />
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
        <ReviewFact label="Contacts" value={String(parsedDraft.contactCount || 0)} />
      </div>
      <p style={copyStyle}>
        TenAceIQ found roster players, starting ratings, and the phone or email details included by TennisLink.
      </p>
      <RosterPlayersList parsedDraft={parsedDraft} />
      <div style={missingRatingCount ? reviewChecklistStyle : readyImportNoteStyle}>
        <strong>{missingRatingCount ? 'Before importing' : 'Roster ready'}</strong>
        <span>{missingRatingCount ? `${missingRatingCount} player rating${missingRatingCount === 1 ? '' : 's'} need review.` : `${parsedDraft.contactCount || 0} contact${parsedDraft.contactCount === 1 ? '' : 's'} will be ready for captain messages.`}</span>
      </div>
    </div>
  )
}

function TeamSummaryImportedPanel({
  result,
  parsedDraft,
  context = '',
  returnTo = '',
}: {
  result: DataAssistImportActionResult
  parsedDraft: DataAssistTeamSummaryParsedDraft
  context?: string
  returnTo?: string
}) {
  const rosterResult = result.importResult?.kind === 'team_summary' ? result.importResult.result : null

  return (
    <div style={importPanelStyle}>
      <div style={submissionCardTopStyle}>
        <div style={headerCopyStyle}>
          <strong>Roster imported</strong>
          <p style={copyStyle}>
            Players, starting ratings, and available contacts are now connected to player profiles, team pages, and Team Hub.
          </p>
        </div>
        <span style={pillGreenStyle}>Done</span>
      </div>
      <div style={scorecardHeaderGridStyle}>
        <ReviewFact label="Team" value={parsedDraft.rosterTeamName || 'Team roster'} />
        <ReviewFact label="Players" value={String(rosterResult?.totalPlayers ?? parsedDraft.playerCount)} />
        <ReviewFact label="Created" value={String(rosterResult?.createdCount ?? 0)} />
        <ReviewFact label="Updated" value={String(rosterResult?.updatedCount ?? 0)} />
        <ReviewFact label="Contacts" value={String(result.importedContactCount ?? parsedDraft.contactCount ?? 0)} />
      </div>
      <RosterPlayersList parsedDraft={parsedDraft} />
      <div style={readyImportNoteStyle}>
        <strong>All set</strong>
        <span>{result.message || 'Team roster imported to TenAceIQ.'}</span>
      </div>
      <PostImportActions
        actions={buildRosterPostImportActions(parsedDraft, { context, returnTo })}
      />
    </div>
  )
}

function PostImportActions({ actions }: { actions: Array<{ label: string; href: string }> }) {
  return (
    <div style={postImportActionStyle}>
      {actions.map((action) => (
        <Link key={action.href} href={action.href} style={secondaryButtonStyle}>
          {action.label}
        </Link>
      ))}
    </div>
  )
}

function buildScorecardPostImportActions(parsedDraft: DataAssistScorecardParsedDraft | null, returnTo = '') {
  const actions: Array<{ label: string; href: string }> = []
  if (returnTo) {
    const scorecardReturnHref = buildScorecardImportReturnHref(returnTo, parsedDraft?.externalMatchId || '')
    actions.push({
      label: returnTo.startsWith('/team-room') ? 'Return to Team Chat' : 'Continue Captain',
      href: scorecardReturnHref || returnTo,
    })
  }
  const homeHref = parsedDraft?.homeTeam ? buildTeamHref(parsedDraft.homeTeam, {}) : ''
  const awayHref = parsedDraft?.awayTeam ? buildTeamHref(parsedDraft.awayTeam, {}) : ''
  if (homeHref) actions.push({ label: 'Home team', href: homeHref })
  if (awayHref && awayHref !== homeHref) actions.push({ label: 'Visiting team', href: awayHref })
  actions.push({ label: 'League Office results', href: '/league-coordinator/results' })
  actions.push({ label: 'Find players', href: '/explore/players' })
  return actions
}

function buildSchedulePostImportActions(parsedDraft: DataAssistScheduleParsedDraft, context = '') {
  const actions: Array<{ label: string; href: string }> = []
  if (/\b(?:captain|team hub)\b/i.test(context)) {
    actions.push({ label: 'Continue Captain setup', href: '/captain' })
  }
  const teamHref = parsedDraft.teamName ? buildTeamHref(parsedDraft.teamName, parsedDraft) : ''
  if (teamHref) actions.push({ label: 'View team', href: teamHref })
  actions.push({ label: 'Open League Office', href: '/league-coordinator#league-registry' })
  actions.push({ label: 'View schedule', href: '/compete/schedule' })
  return actions
}

function buildRosterPostImportActions(
  parsedDraft: DataAssistTeamSummaryParsedDraft,
  options: { context?: string; returnTo?: string } = {},
) {
  const actions: Array<{ label: string; href: string }> = []
  if (options.returnTo) {
    actions.push({
      label: options.returnTo.startsWith('/clubs') ? 'Return to Club People' : options.returnTo.startsWith('/captain/lineup-builder') ? 'Return to Build Lineup' : 'Continue Captain setup',
      href: options.returnTo,
    })
  } else if (/\b(?:captain|team hub)\b/i.test(options.context || '')) {
    actions.push({ label: 'Continue Captain setup', href: '/captain' })
  }
  const teamHref = parsedDraft.rosterTeamName ? buildTeamHref(parsedDraft.rosterTeamName, parsedDraft) : ''
  if (teamHref) actions.push({ label: 'View team', href: teamHref })
  actions.push({ label: 'Open League Office', href: '/league-coordinator#league-setup-form' })
  actions.push({ label: 'Find players', href: buildPlayerSearchHref(parsedDraft.players[0]?.name || parsedDraft.rosterTeamName) })
  return actions
}

function buildTeamHref(
  teamName: string,
  context: {
    leagueName?: string
    flight?: string
  },
) {
  const params = new URLSearchParams()
  params.set('layer', 'usta')
  if (context.leagueName) params.set('league', context.leagueName)
  if (context.flight) params.set('flight', context.flight)
  return `/teams/${encodeTeamRouteSegment(teamName)}?${params.toString()}`
}

function buildPlayerSearchHref(query: string) {
  const cleanQuery = query.trim()
  return cleanQuery ? `/explore/search?scope=players&q=${encodeURIComponent(cleanQuery)}` : '/explore/players'
}

function ScheduleRowsList({ parsedDraft }: { parsedDraft: DataAssistScheduleParsedDraft }) {
  const [expanded, setExpanded] = useState(false)
  const visibleMatches = expanded ? parsedDraft.matches : parsedDraft.matches.slice(0, 8)
  const hiddenCount = parsedDraft.matches.length - visibleMatches.length

  return (
    <div style={parsedLineListStyle}>
      {hiddenCount > 0 ? (
        <p style={compactListHintStyle}>Showing the first {visibleMatches.length} of {parsedDraft.matches.length} matches.</p>
      ) : null}
      {visibleMatches.map((match) => (
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
      {hiddenCount > 0 ? (
        <button type="button" onClick={() => setExpanded(true)} style={showMoreButtonStyle}>
          Show {hiddenCount} more match{hiddenCount === 1 ? '' : 'es'}
        </button>
      ) : expanded && parsedDraft.matches.length > 8 ? (
        <button type="button" onClick={() => setExpanded(false)} style={showMoreButtonStyle}>
          Show fewer matches
        </button>
      ) : null}
    </div>
  )
}

function RosterPlayersList({ parsedDraft }: { parsedDraft: DataAssistTeamSummaryParsedDraft }) {
  const [expanded, setExpanded] = useState(false)
  const visiblePlayers = expanded ? parsedDraft.players : parsedDraft.players.slice(0, 12)
  const hiddenCount = parsedDraft.players.length - visiblePlayers.length

  return (
    <div style={parsedLineListStyle}>
      {hiddenCount > 0 ? (
        <p style={compactListHintStyle}>Showing the first {visiblePlayers.length} of {parsedDraft.players.length} players.</p>
      ) : null}
      {visiblePlayers.map((player) => (
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
      {hiddenCount > 0 ? (
        <button type="button" onClick={() => setExpanded(true)} style={showMoreButtonStyle}>
          Show {hiddenCount} more player{hiddenCount === 1 ? '' : 's'}
        </button>
      ) : expanded && parsedDraft.players.length > 12 ? (
        <button type="button" onClick={() => setExpanded(false)} style={showMoreButtonStyle}>
          Show fewer players
        </button>
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
        scores, and winners to refresh tennis context across player, team, and rating views.
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
      <p style={parsedSidePlayersStyle}>{players.join(' / ') || 'Check players'}</p>
    </div>
  )
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={reviewFactStyle}>
      <span>{label}</span>
      <strong style={reviewFactValueStyle}>{value}</strong>
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
  if (isTeamSummaryParsedDraft(value)) return isTeamSummaryDraftReadyForImport(value)
  return getBlockingScorecardReviewItems(value).length === 0
}

function toScorecardParsedDraft(value: DataAssistSubmission['parsedPayload']): DataAssistScorecardParsedDraft | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as Partial<DataAssistScorecardParsedDraft>
  if (!Array.isArray(draft.lines) || !draft.lines.length) return null
  return {
    externalMatchId: typeof draft.externalMatchId === 'string' ? draft.externalMatchId : '',
    leagueName: typeof draft.leagueName === 'string' ? draft.leagueName : '',
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
    contacts: Array.isArray(value.contacts) ? value.contacts : [],
    playerCount: typeof value.playerCount === 'number' ? value.playerCount : value.players.length,
    contactCount: typeof value.contactCount === 'number' ? value.contactCount : Array.isArray(value.contacts) ? value.contacts.length : 0,
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
      detail: 'Done. This result is now available for matches, players, teams, and ratings.',
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
      detail: 'This upload will not be parsed. Upload a supported TennisLink Excel export.',
      tone: 'red' as const,
    }
  }
  if (submission.status === 'layout_detected') {
    return {
      label: 'Ready to import',
      detail: 'This looks like a TennisLink export. Import it to review the table data.',
      tone: 'amber' as const,
    }
  }
  return {
    label: 'Needs a closer look',
    detail: 'This upload is saved. Try the TennisLink Excel export again if the read looks off.',
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
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: isMobile ? '14px 0 48px' : '18px 0 64px',
  display: 'grid',
  gap: 18,
  minWidth: 0,
  overflowX: 'clip',
  boxSizing: 'border-box',
})

const workspaceStyle = (): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 18,
  alignItems: 'start',
  minWidth: 0,
})

const panelStyle: CSSProperties = {
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
  padding: 'clamp(13px, 4vw, 18px)',
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const sourcePathPanelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 11%, var(--shell-panel-bg) 89%), color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-panel-bg) 93%))',
  padding: 'clamp(13px, 3vw, 16px)',
  display: 'grid',
  gap: 14,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const compactSourcePathPanelStyle: CSSProperties = {
  ...sourcePathPanelStyle,
  borderRadius: 14,
  padding: 9,
  gap: 8,
}

const sourcePathHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const compactSourcePathHeaderStyle: CSSProperties = {
  ...sourcePathHeaderStyle,
  display: 'grid',
  gap: 6,
}

const sourcePathEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const sourcePathTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(22px, 5vw, 30px)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const compactSourcePathTitleStyle: CSSProperties = {
  ...sourcePathTitleStyle,
  fontSize: 18,
  lineHeight: 1.12,
}

const sourcePathIntroStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 750,
  maxWidth: 520,
  overflowWrap: 'anywhere',
}

const sourcePathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const compactSourcePathGridStyle: CSSProperties = {
  ...sourcePathGridStyle,
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 7,
}

const sourcePathCardBaseStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  alignContent: 'start',
  minHeight: 152,
  minWidth: 0,
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 88%, transparent)',
  color: 'var(--shell-copy-muted)',
  padding: 12,
  textAlign: 'left',
  textDecoration: 'none',
  font: 'inherit',
  overflowWrap: 'anywhere',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const sourcePathCardStyle: CSSProperties = {
  ...sourcePathCardBaseStyle,
  cursor: 'pointer',
}

const compactSourcePathCardStyle: CSSProperties = {
  ...sourcePathCardStyle,
  minHeight: 112,
  borderRadius: 12,
  padding: 10,
  gap: 5,
}

const sourcePathSelectedCardStyle: CSSProperties = {
  borderColor: 'color-mix(in srgb, var(--brand-green) 66%, var(--shell-panel-border) 34%)',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 16%, var(--shell-chip-bg) 84%), color-mix(in srgb, var(--brand-blue-2) 8%, var(--shell-chip-bg) 92%))',
  boxShadow: '0 12px 28px color-mix(in srgb, var(--brand-green) 10%, transparent), inset 0 1px 0 rgba(255,255,255,0.08)',
}

const sourcePathCardTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
}

const sourcePathReadyPillStyle: CSSProperties = {
  minHeight: 26,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 8px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 900,
}

const sourcePathSelectedPillStyle: CSSProperties = {
  ...sourcePathReadyPillStyle,
  borderColor: 'color-mix(in srgb, var(--brand-green) 52%, var(--shell-panel-border) 48%)',
  background: 'color-mix(in srgb, var(--brand-green) 16%, var(--shell-panel-bg) 84%)',
  color: 'var(--brand-green)',
}

const sourcePathSupportLinkStyle: CSSProperties = {
  minHeight: 42,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  padding: '0 4px',
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 850,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const sourcePathQuestionStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  lineHeight: 1.3,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const sourcePathCardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const sourcePathCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const dataAssistDetailsSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const dataAssistDetailsSummaryStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
  listStyle: 'none',
  overflowWrap: 'anywhere',
}

const dataAssistDetailsSummaryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const dataAssistDetailsEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const dataAssistDetailsTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const dataAssistDetailsCueStyle: CSSProperties = {
  flex: '0 0 auto',
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const dataAssistDetailsContentStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const trustEnginePanelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 26%, var(--shell-panel-border) 74%)',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 10%, var(--shell-panel-bg) 90%), color-mix(in srgb, var(--brand-blue-2) 9%, var(--shell-panel-bg) 91%))',
  padding: 'clamp(13px, 3vw, 16px)',
  display: 'grid',
  gap: 14,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const trustEngineCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  maxWidth: 820,
  minWidth: 0,
}

const trustEngineEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const trustEngineTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(22px, 5vw, 30px)',
  lineHeight: 1.1,
  fontWeight: 950,
}

const trustSignalGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const trustSignalCardStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 88%, transparent)',
  padding: 12,
  display: 'grid',
  gap: 5,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 850,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const playerIdSignalPathStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const playerIdSignalCardStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  minHeight: 132,
  alignContent: 'start',
  padding: 12,
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-chip-bg) 93%)',
  overflowWrap: 'anywhere',
}

const playerIdSignalLabelStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const playerIdSignalTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.22,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const playerIdSignalTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const dataAssistPlayerIdStarterStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-chip-bg) 93%)',
  overflowWrap: 'anywhere',
}

const dataAssistPlayerIdStarterHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
}

const dataAssistPlayerIdStarterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 168px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const dataAssistPlayerIdStarterCardStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 11,
  borderRadius: 12,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 16%, var(--shell-panel-border) 84%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-panel-bg) 93%)',
  overflowWrap: 'anywhere',
}

const dataAssistPlayerIdStarterLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const dataAssistPlayerIdStarterValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const dataAssistPlayerIdStarterActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const trustActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
  minWidth: 0,
}

const reviewFlowPanelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 14,
  display: 'grid',
  gap: 12,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const reviewFlowHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  maxWidth: 820,
  overflowWrap: 'anywhere',
}

const reviewFlowEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const reviewFlowTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.15,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const reviewFlowGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const reviewFlowCardStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 12,
  display: 'grid',
  gap: 7,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const reviewFlowStepStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-panel-bg) 86%)',
  color: 'var(--foreground-strong)',
  display: 'grid',
  placeItems: 'center',
  fontSize: 12,
  fontWeight: 950,
}

const reviewFlowCardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const reviewFlowCardTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const uploadStateProofStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(min(100%, 220px), 0.36fr) minmax(0, 1fr)',
  gap: 10,
  alignItems: 'stretch',
  minWidth: 0,
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 8%, var(--shell-chip-bg) 92%)',
  padding: 12,
  overflowWrap: 'anywhere',
}

const uploadStateProofHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  alignContent: 'start',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const uploadStateProofTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const uploadStateProofGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const uploadStateProofCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  borderRadius: 12,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: 10,
  overflowWrap: 'anywhere',
}

const uploadStateProofLabelStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const intentPanelStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 14,
  flexWrap: 'wrap',
  padding: 16,
  borderRadius: 20,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 9%, var(--shell-panel-bg) 91%)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const intentCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  flex: '1 1 280px',
  minWidth: 0,
}

const intentEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const intentTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  fontWeight: 950,
}

const intentTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 700,
}

const intentContextStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  maxWidth: '100%',
  padding: '5px 9px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const intentActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 10,
  minWidth: 0,
}

const newPlayerActionPanelStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: 12,
  alignItems: 'center',
  borderRadius: 22,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.10), rgba(8,13,28,0.58))',
  boxShadow: '0 18px 48px rgba(2,10,24,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
  padding: '14px',
  minWidth: 0,
}

const newPlayerActionCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const newPlayerActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const newPlayerActionLinkStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minHeight: 66,
  alignContent: 'center',
  borderRadius: 16,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  padding: '10px 12px',
  textDecoration: 'none',
  fontWeight: 900,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const compactSectionHeaderStyle: CSSProperties = {
  ...sectionHeaderStyle,
  display: 'grid',
  gap: 7,
}

const headerCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const sectionTitleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(20px, 5vw, 24px)',
  lineHeight: 1.18,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const compactPanelStyle: CSSProperties = {
  ...panelStyle,
  borderRadius: 18,
  padding: 12,
  gap: 12,
}

const uploadJourneyRailStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
  minWidth: 0,
}

const uploadJourneyStepStyle: CSSProperties = {
  minHeight: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '6px 7px',
  borderRadius: 12,
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 86%, transparent)',
  color: 'var(--shell-copy-muted)',
  fontSize: 10.5,
  lineHeight: 1.15,
  fontWeight: 850,
  textAlign: 'left',
  overflowWrap: 'anywhere',
}

const uploadJourneyActiveStepStyle: CSSProperties = {
  ...uploadJourneyStepStyle,
  borderColor: 'color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)',
  background: 'color-mix(in srgb, var(--brand-green) 11%, var(--shell-chip-bg) 89%)',
  color: 'var(--foreground-strong)',
}

const uploadJourneyStepNumberStyle: CSSProperties = {
  width: 22,
  height: 22,
  flex: '0 0 auto',
  display: 'grid',
  placeItems: 'center',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-bg) 82%)',
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
}

const typeOverrideDetailsStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  overflow: 'hidden',
}

const typeOverrideSummaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minHeight: 44,
  padding: '9px 12px',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
  cursor: 'pointer',
  listStyle: 'none',
}

const importTypeSelectWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  overflowWrap: 'anywhere',
}

const compactImportTypeSelectWrapStyle: CSSProperties = {
  ...importTypeSelectWrapStyle,
  gap: 5,
  padding: 8,
  borderRadius: 12,
}

const importTypeSelectStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 44,
  borderRadius: 12,
  border: '1px solid color-mix(in srgb, var(--brand-green) 30%, var(--shell-panel-border) 70%)',
  background: 'var(--shell-panel-bg)',
  color: 'var(--foreground-strong)',
  padding: '0 12px',
  fontSize: 15,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const compactImportTypeSelectStyle: CSSProperties = {
  ...importTypeSelectStyle,
  minHeight: 40,
  borderRadius: 10,
  padding: '0 10px',
  fontSize: 14,
}

const importTypeSelectHintStyle: CSSProperties = {
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const compactImportTypeSelectHintStyle: CSSProperties = {
  ...importTypeSelectHintStyle,
  fontSize: 11,
  lineHeight: 1.3,
}

const seasonGuideStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-chip-bg) 93%)',
  padding: 12,
  display: 'grid',
  gap: 4,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 850,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const mobileUploadHelpStackStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const stepBadgeStyle: CSSProperties = {
  width: 'fit-content',
  border: '1px solid color-mix(in srgb, var(--brand-green) 45%, var(--shell-panel-border) 55%)',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
  padding: '5px 10px 5px 6px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const stepBadgeNumberStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-bg) 82%)',
  display: 'grid',
  placeItems: 'center',
  fontSize: 12,
}

const hiddenFileInputStyle: CSSProperties = {
  display: 'none',
}

const replaceExportPickerStyle: CSSProperties = {
  position: 'relative',
  minHeight: 92,
  padding: 12,
  display: 'grid',
  placeItems: 'center',
  gap: 6,
  minWidth: 0,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  textAlign: 'center',
  cursor: 'pointer',
  borderRadius: 16,
  border: '1px dashed color-mix(in srgb, var(--brand-blue-2) 42%, var(--shell-panel-border) 58%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-chip-bg) 93%)',
  color: 'var(--foreground-strong)',
}

const replaceExportInputStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 2,
  inset: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
}

const dropzoneKickerStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
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
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const screenshotGridStyle = (isTablet: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  minWidth: 0,
})

const submissionStatsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
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
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const submissionListStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
  gap: 12,
  alignItems: 'start',
  minWidth: 0,
}

const submissionCardStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 14,
  display: 'grid',
  gap: 10,
  alignSelf: 'start',
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const historyCollapsedStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  padding: 12,
  fontSize: 13,
  fontWeight: 800,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const dataAssistOperationsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const dataAssistOperationCardStyle = (tone: 'review' | 'clear' | 'history'): CSSProperties => ({
  display: 'grid',
  gap: 4,
  minHeight: 118,
  alignContent: 'center',
  textAlign: 'left',
  cursor: 'pointer',
  padding: '15px 16px',
  borderRadius: 18,
  border: tone === 'review'
    ? '1px solid rgba(251, 191, 36, 0.46)'
    : tone === 'clear'
      ? '1px solid rgba(155, 225, 29, 0.28)'
      : '1px solid rgba(125, 211, 252, 0.25)',
  background: tone === 'review'
    ? 'linear-gradient(135deg, rgba(120, 53, 15, 0.30), rgba(15, 23, 42, 0.92))'
    : tone === 'clear'
      ? 'linear-gradient(135deg, rgba(71, 129, 25, 0.18), rgba(15, 23, 42, 0.92))'
      : 'linear-gradient(135deg, rgba(30, 87, 153, 0.16), rgba(15, 23, 42, 0.92))',
  color: 'var(--foreground-strong)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 10px 24px rgba(2,8,23,0.16)',
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const dataAssistOperationLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
}

const dataAssistOperationValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 32,
  lineHeight: 1,
  fontWeight: 950,
}

const dataAssistOperationDetailStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.35,
}

const historyRecordsStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  scrollMarginTop: 18,
}

const mobileHistoryShellStyle: CSSProperties = {
  display: 'grid',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const historyManagementStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 78%, transparent)',
  color: 'var(--shell-copy-muted)',
  padding: 12,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 850,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const historyFilterStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  overscrollBehaviorX: 'contain',
  paddingBottom: 2,
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'thin',
  minWidth: 0,
  maxWidth: '100%',
}

const historyFilterButtonStyle = (selected: boolean): CSSProperties => ({
  flex: '0 0 auto',
  maxWidth: 180,
  minWidth: 0,
  minHeight: 40,
  borderRadius: 999,
  border: selected
    ? '1px solid color-mix(in srgb, var(--brand-green) 58%, var(--shell-panel-border) 42%)'
    : '1px solid var(--shell-panel-border)',
  background: selected
    ? 'color-mix(in srgb, var(--brand-green) 16%, var(--shell-chip-bg) 84%)'
    : 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '0 11px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
  fontSize: 12,
  fontWeight: 950,
  cursor: 'pointer',
})

const scorecardReviewStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  display: 'grid',
  gap: 10,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const latestReadStyle: CSSProperties = {
  ...scorecardReviewStyle,
  marginTop: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 5%, var(--shell-panel-bg) 95%)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const importPanelStyle: CSSProperties = {
  ...scorecardReviewStyle,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const scorecardHeaderGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
  gap: 8,
  minWidth: 0,
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

const reviewFactValueStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const parsedLineListStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
}

const parsedLineStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  padding: 9,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 8rem)',
  gap: 6,
  color: 'var(--foreground-strong)',
  fontSize: 12,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const parsedLineNameStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const parsedLineStatusStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  justifySelf: 'start',
  overflowWrap: 'anywhere',
}

const parsedLineDetailStyle: CSSProperties = {
  gridColumn: '1 / -1',
  minWidth: 0,
  maxWidth: '100%',
  color: 'var(--shell-copy-muted)',
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

const showMoreButtonStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 42,
  borderRadius: 12,
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
  background: 'color-mix(in srgb, var(--brand-green) 9%, var(--shell-chip-bg) 91%)',
  color: 'var(--foreground-strong)',
  padding: '0 12px',
  fontSize: 13,
  fontWeight: 950,
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const compactListHintStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const scheduleMatchGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const bulkResultListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const bulkResultReviewCalloutStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, #fbbf24 42%, var(--shell-panel-border) 58%)',
  background: 'color-mix(in srgb, #fbbf24 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const bulkResultContentStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const bulkResultActionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const bulkResultRowStyle = (status: BulkScorecardResult['status']): CSSProperties => ({
  borderRadius: 14,
  border: status === 'failed'
    ? '1px solid rgba(248,113,113,0.34)'
    : status === 'review'
      ? '1px solid rgba(251,191,36,0.34)'
      : status === 'pending'
        ? '1px solid var(--shell-panel-border)'
        : '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: status === 'failed'
    ? 'rgba(248,113,113,0.08)'
    : status === 'review'
      ? 'rgba(251,191,36,0.08)'
      : status === 'pending'
        ? 'var(--shell-chip-bg)'
        : 'color-mix(in srgb, var(--brand-green) 6%, var(--shell-chip-bg) 94%)',
  padding: 12,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)',
  gap: 12,
  alignItems: 'center',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const bulkResultStatusStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  justifySelf: 'start',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  color: 'var(--foreground-strong)',
  padding: '4px 8px',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
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
  overflowWrap: 'anywhere',
}

const playerSidesGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const parsedSideStyle = (won: boolean): CSSProperties => ({
  borderRadius: 10,
  border: won
    ? '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)'
    : '1px solid var(--shell-panel-border)',
  background: won
    ? 'color-mix(in srgb, var(--brand-green) 12%, transparent)'
    : 'var(--shell-chip-bg)',
  padding: 8,
  display: 'grid',
  gap: 4,
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const parsedSideHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 950,
  textTransform: 'uppercase',
  flexWrap: 'wrap',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const parsedSidePlayersStyle: CSSProperties = {
  margin: 0,
  minWidth: 0,
  maxWidth: '100%',
  color: 'var(--foreground-strong)',
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
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
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const walkthroughHelpStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-chip-bg) 93%)',
}

const walkthroughHelpCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  flex: '1 1 260px',
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const walkthroughHelpKickerStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const exportHelpStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  overflow: 'hidden',
  minWidth: 0,
}

const exportHelpToggleStyle: CSSProperties = {
  width: '100%',
  minHeight: 48,
  border: 0,
  background: 'transparent',
  color: 'var(--foreground-strong)',
  padding: '0 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 13,
  fontWeight: 950,
  textAlign: 'left',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const exportHelpBodyStyle: CSSProperties = {
  borderTop: '1px solid var(--shell-panel-border)',
  padding: 12,
  display: 'grid',
  gap: 9,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const exportHelpStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 28px) minmax(0, 1fr)',
  gap: 9,
  alignItems: 'start',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 800,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const exportHelpExampleStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-panel-bg) 92%)',
  color: 'var(--foreground-strong)',
  padding: 10,
  fontSize: 12,
  fontWeight: 850,
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const badgePanelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-green) 6%, var(--shell-chip-bg) 94%)',
  padding: 14,
  display: 'grid',
  gap: 12,
  minWidth: 0,
}

const badgeListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const badgeCardStyle: CSSProperties = {
  minHeight: 74,
  minWidth: 0,
  flex: '1 1 min(100%, 190px)',
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--brand-green) 22%, var(--shell-panel-border) 78%)',
  background: 'var(--shell-panel-bg)',
  padding: 12,
  display: 'grid',
  gap: 6,
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const screenshotCardStyle: CSSProperties = {
  borderRadius: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  overflow: 'hidden',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const thumbnailWrapStyle: CSSProperties = {
  position: 'relative',
  minHeight: 190,
  background: 'var(--shell-panel-bg-strong)',
  minWidth: 0,
}

const thumbnailStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

const exportFilePreviewStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 190,
  display: 'grid',
  placeItems: 'center',
  color: 'var(--brand-green)',
  fontSize: 28,
  fontWeight: 950,
  letterSpacing: 0,
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 950,
}

const screenshotBodyStyle: CSSProperties = {
  padding: 13,
  display: 'grid',
  gap: 9,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const screenshotHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  minWidth: 0,
}

const screenshotFileNameStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const signalListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minWidth: 0,
}

const cardActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const postImportActionStyle: CSSProperties = {
  ...cardActionRowStyle,
  paddingTop: 2,
}

const smallButtonStyle: CSSProperties = {
  minWidth: 0,
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
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  minHeight: 44,
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  padding: '0 16px',
  fontWeight: 950,
  textDecoration: 'none',
  cursor: 'pointer',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
}

const inlineLinkStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  marginLeft: 8,
  overflowWrap: 'anywhere',
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
  overflowWrap: 'anywhere',
}

const hintStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const scanLoadingStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
  marginTop: 18,
  padding: 16,
  border: '1px solid var(--shell-panel-border)',
  borderRadius: 8,
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const scanLoadingCopyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
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

const scorecardCapturePanelStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 16,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 12%, var(--shell-panel-bg) 88%), var(--shell-panel-bg))',
}

const capturePanelTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: '-0.025em',
  overflowWrap: 'anywhere',
}

const noticeLinkStyle: CSSProperties = {
  color: 'var(--portal-you)',
  fontWeight: 950,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const uploadIssueStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 14,
  padding: 16,
  borderRadius: 18,
  border: '1px solid rgba(251,191,36,0.38)',
  background: 'color-mix(in srgb, #fbbf24 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 900,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const scorecardPausedPanelStyle: CSSProperties = {
  ...uploadIssueStyle,
  border: '1px solid rgba(248,113,113,0.28)',
  background: 'color-mix(in srgb, #ef4444 10%, var(--shell-chip-bg) 90%)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const uploadIssueCopyStyle: CSSProperties = {
  ...copyStyle,
  marginTop: 4,
  color: 'var(--foreground-strong)',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const emptyHistoryStyle: CSSProperties = {
  minHeight: 160,
  borderRadius: 18,
  border: '1px dashed color-mix(in srgb, var(--portal-you) 42%, var(--shell-panel-border) 58%)',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--portal-you) 12%, var(--shell-chip-bg) 88%), var(--shell-chip-bg))',
  color: 'var(--shell-copy-muted)',
  display: 'grid',
  gap: 16,
  alignContent: 'center',
  padding: 18,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const emptyHistoryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const emptyHistoryActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const emptyHistoryActionStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  padding: '10px 13px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const dataAssistOutcomeStyle = (tone: DataAssistOutcome['tone']): CSSProperties => ({
  display: 'grid',
  gap: 14,
  padding: '18px',
  borderRadius: 22,
  border: tone === 'review'
    ? '1px solid rgba(251, 191, 36, 0.48)'
    : tone === 'duplicate'
      ? '1px solid rgba(125, 211, 252, 0.30)'
      : '1px solid rgba(155, 225, 29, 0.42)',
  background: tone === 'review'
    ? 'linear-gradient(135deg, rgba(120, 53, 15, 0.28), rgba(8, 16, 31, 0.95))'
    : tone === 'duplicate'
      ? 'linear-gradient(135deg, rgba(17, 70, 103, 0.23), rgba(8, 16, 31, 0.95))'
      : 'linear-gradient(135deg, rgba(70, 119, 25, 0.24), rgba(8, 16, 31, 0.95))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 42px rgba(2,8,23,0.18)',
  minWidth: 0,
  overflowWrap: 'anywhere',
})

const dataAssistOutcomeHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const dataAssistOutcomeEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
}

const dataAssistOutcomeTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(22px, 5.6vw, 34px)',
  lineHeight: 1.04,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const dataAssistOutcomeCopyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 700,
  maxWidth: 720,
  overflowWrap: 'anywhere',
}

const dataAssistOutcomePillStyle = (tone: DataAssistOutcome['tone']): CSSProperties => ({
  width: 'fit-content',
  maxWidth: '100%',
  padding: '7px 10px',
  borderRadius: 999,
  border: tone === 'review'
    ? '1px solid rgba(251, 191, 36, 0.55)'
    : '1px solid rgba(155, 225, 29, 0.50)',
  background: tone === 'review' ? 'rgba(120, 53, 15, 0.30)' : 'rgba(70, 119, 25, 0.26)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  textAlign: 'center',
  overflowWrap: 'anywhere',
})

const dataAssistOutcomeActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const successStyle: CSSProperties = {
  color: '#bbf7d0',
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const errorStyle: CSSProperties = {
  color: '#fecaca',
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}
