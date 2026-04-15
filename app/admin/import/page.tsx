'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import ScorecardReviewPanel from '@/app/admin/import/_components/scorecard-review-panel'
import { supabase } from '@/lib/supabase'
import {
  runImport,
  summarizeImportResponse,
  collectImportMessages,
  type RunImportResponse,
} from '@/lib/ingestion/runImport'
import {
  normalizeCapturedSchedulePayload,
  normalizeCapturedScorecardPayload,
  type NormalizationWarning,
} from '@/lib/ingestion/normalizeCapturedImports'
import type { ScorecardImportRow } from '@/lib/ingestion/importEngine'
import {
  buildScorecardCommitRows,
  buildScorecardPreviewModels,
  type ReviewDecision,
  type ScorecardMatchReviewOverride,
  type ScorecardPreviewModel,
} from '@/lib/ingestion/scorecardReview'

type ImportKind = 'schedule' | 'scorecard'
type ImportMode = 'preview' | 'commit'
type ReviewFilterMode = 'all' | 'needs_review' | 'ready' | 'blocked'

type AutoImportRequest = {
  autoPaste: boolean
  autoPreview: boolean
  autoCommitMode: 'none' | 'all' | 'clean_only'
  reviewFilter: ReviewFilterMode
  source: string | null
  started: boolean
  cleanCommitTriggered: boolean
}

type UploadedFileSummary = {
  fileName: string
  kind: ImportKind
  normalizedRowCount: number
  warningCount: number
  externalMatchIds: string[]
}

type MatchUploadLedgerRow = {
  id: string
  external_match_id: string | null
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
  match_date: string | null
  status: string | null
  score: string | null
  line_number?: string | null
}

type PreviewScheduleMatch = {
  externalMatchId: string
  matchDate: string
  matchTime: string | null | undefined
  homeTeam: string
  awayTeam: string
  facility: string | null | undefined
  leagueName: string | null | undefined
  flight: string | null | undefined
  ustaSection: string | null | undefined
  districtArea: string | null | undefined
  source: string | null | undefined
}

type PreviewScorecardLine = {
  lineNumber: number
  matchType: 'singles' | 'doubles'
  sideAPlayers: string[]
  sideBPlayers: string[]
  winnerSide: 'A' | 'B' | null
  score: string | null | undefined
}

type PreviewScorecardMatch = {
  externalMatchId: string
  matchDate: string
  matchTime: string | null | undefined
  homeTeam: string
  awayTeam: string
  facility: string | null | undefined
  leagueName: string | null | undefined
  flight: string | null | undefined
  ustaSection: string | null | undefined
  districtArea: string | null | undefined
  source: string | null | undefined
  lineCount: number
  lines: PreviewScorecardLine[]
}

const IMPORT_TIMEOUT_MS = 180000
const SCORECARD_REVIEW_STORAGE_KEY = 'tenaceiq-scorecard-review-overrides-v1'
const SCORECARD_REVIEWER_STORAGE_KEY = 'tenaceiq-scorecard-reviewer-v1'
const IMPORT_DRAFT_STORAGE_KEY = 'tenaceiq-admin-import-draft-v1'
const IMPORT_TYPE_STORAGE_KEY = 'tenaceiq-admin-import-type-v1'
const IMPORT_LEAGUE_OVERRIDE_STORAGE_KEY = 'tenaceiq-admin-import-league-override-v1'
const LAST_ADMIN_IMPORT_ROUTE_STORAGE_KEY = 'tenaceiq-last-admin-import-route-v1'

const pageWrapStyle: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '18px 24px 40px',
}

const glassCardStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(17,34,63,0.76) 0%, rgba(9,18,34,0.94) 100%)',
  boxShadow: '0 24px 70px rgba(5,12,26,0.26), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const panelStyle: CSSProperties = {
  ...glassCardStyle,
  padding: '18px',
}

const labelStyle: CSSProperties = {
  color: '#DCEBFF',
  fontSize: '0.8rem',
  fontWeight: 800,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 48,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(8,15,28,0.78)',
  color: '#F8FBFF',
  padding: '12px 14px',
  outline: 'none',
  fontSize: '0.95rem',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 300,
  resize: 'vertical',
  fontFamily:
    'ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, Liberation Mono, monospace',
  fontSize: '0.82rem',
  lineHeight: 1.5,
}

const selectStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 48,
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  borderRadius: 999,
  padding: '0 18px',
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  color: '#08111d',
  fontWeight: 900,
  fontSize: '0.95rem',
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: '0 12px 28px rgba(155,225,29,0.18)',
}

const secondaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  borderRadius: 999,
  padding: '0 18px',
  border: '1px solid rgba(116,190,255,0.20)',
  background: 'linear-gradient(180deg, rgba(21,42,77,0.82) 0%, rgba(11,20,36,0.96) 100%)',
  color: '#EAF4FF',
  fontWeight: 800,
  fontSize: '0.95rem',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

const mutedButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  border: '1px solid rgba(148,163,184,0.18)',
  color: '#D6E1EF',
}

const pillBlueStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(74,163,255,0.10)',
  color: '#BFE1FF',
  fontWeight: 800,
  fontSize: '0.77rem',
}

const pillGreenStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(155,225,29,0.10)',
  color: '#C8F56B',
  fontWeight: 800,
  fontSize: '0.77rem',
}

const pillSlateStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(148,163,184,0.10)',
  color: '#D6E1EF',
  fontWeight: 800,
  fontSize: '0.77rem',
}

const subtleTextStyle: CSSProperties = {
  color: '#AFC3DB',
  lineHeight: 1.6,
}

const summaryValueStyle: CSSProperties = {
  color: '#F8FBFF',
  fontWeight: 900,
  fontSize: '1.1rem',
  lineHeight: 1.1,
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function parseJsonInput(raw: string): { value: unknown | null; error: string | null } {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { value: null, error: 'No JSON provided.' }
  }

  try {
    return { value: JSON.parse(trimmed), error: null }
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : 'Invalid JSON.',
    }
  }
}

function buildSchedulePreview(payload: unknown): {
  rows: PreviewScheduleMatch[]
  warnings: NormalizationWarning[]
} {
  const normalized = normalizeCapturedSchedulePayload(payload)

  return {
    warnings: normalized.warnings,
    rows: normalized.rows.map((row) => ({
      externalMatchId: row.externalMatchId,
      matchDate: row.matchDate,
      matchTime: row.matchTime,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      facility: row.facility,
      leagueName: row.leagueName,
      flight: row.flight,
      ustaSection: row.ustaSection,
      districtArea: row.districtArea,
      source: row.source,
    })),
  }
}

function buildScorecardPreview(payload: unknown): {
  rows: PreviewScorecardMatch[]
  normalizedRows: ScorecardImportRow[]
  warnings: NormalizationWarning[]
} {
  const normalized = normalizeCapturedScorecardPayload(payload)

  return {
    warnings: normalized.warnings,
    normalizedRows: normalized.rows,
    rows: normalized.rows.map((row) => ({
      externalMatchId: row.externalMatchId,
      matchDate: row.matchDate,
      matchTime: row.matchTime,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      facility: row.facility,
      leagueName: row.leagueName,
      flight: row.flight,
      ustaSection: row.ustaSection,
      districtArea: row.districtArea,
      source: row.source,
      lineCount: row.lines.length,
      lines: row.lines.map((line) => ({
        lineNumber: line.lineNumber,
        matchType: line.matchType,
        sideAPlayers: line.sideAPlayers,
        sideBPlayers: line.sideBPlayers,
        winnerSide: line.winnerSide,
        score: line.score ?? line.rawScoreText,
      })),
    })),
  }
}

function getScorecardWinnerLabel(
  match: PreviewScorecardMatch,
  winnerSide: 'A' | 'B' | null,
): string {
  if (winnerSide === 'A') return match.homeTeam || 'Home'
  if (winnerSide === 'B') return match.awayTeam || 'Away'
  return '—'
}

function summarizeUploadedFile(
  fileName: string,
  payload: unknown,
  kind: ImportKind,
): UploadedFileSummary {
  if (kind === 'schedule') {
    const preview = buildSchedulePreview(payload)
    return {
      fileName,
      kind,
      normalizedRowCount: preview.rows.length,
      warningCount: preview.warnings.length,
      externalMatchIds: preview.rows.map((row) => row.externalMatchId),
    }
  }

  const preview = buildScorecardPreview(payload)
  return {
    fileName,
    kind,
    normalizedRowCount: preview.rows.length,
    warningCount: preview.warnings.length,
    externalMatchIds: preview.rows.map((row) => row.externalMatchId),
  }
}

function applyLeagueNameOverride(payload: unknown, leagueName: string): unknown {
  const trimmedLeagueName = cleanString(leagueName)
  if (!trimmedLeagueName) return payload

  if (Array.isArray(payload)) {
    return payload.map((entry) => applyLeagueNameOverride(entry, trimmedLeagueName))
  }

  if (!payload || typeof payload !== 'object') {
    return payload
  }

  const record = payload as Record<string, unknown>

  if (record.seasonSchedule && typeof record.seasonSchedule === 'object' && record.seasonSchedule !== null) {
    return {
      ...record,
      leagueNameOverride: trimmedLeagueName,
      __leagueNameOverride: trimmedLeagueName,
      seasonSchedule: {
        ...(record.seasonSchedule as Record<string, unknown>),
        leagueName: trimmedLeagueName,
        leagueNameOverride: trimmedLeagueName,
        __leagueNameOverride: trimmedLeagueName,
      },
    }
  }

  if (record.scorecard && typeof record.scorecard === 'object' && record.scorecard !== null) {
    return {
      ...record,
      leagueNameOverride: trimmedLeagueName,
      __leagueNameOverride: trimmedLeagueName,
      scorecard: {
        ...(record.scorecard as Record<string, unknown>),
        leagueName: trimmedLeagueName,
        leagueNameOverride: trimmedLeagueName,
        __leagueNameOverride: trimmedLeagueName,
      },
    }
  }

  return {
    ...record,
    leagueName: trimmedLeagueName,
    leagueNameOverride: trimmedLeagueName,
    __leagueNameOverride: trimmedLeagueName,
  }
}

function SummaryMetric({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <div
      style={{
        borderRadius: 22,
        border: '1px solid rgba(116,190,255,0.10)',
        background: 'linear-gradient(180deg, rgba(17,34,63,0.55) 0%, rgba(8,15,28,0.88) 100%)',
        padding: '16px',
      }}
    >
      <div style={{ ...labelStyle, fontSize: '0.72rem' }}>{label}</div>
      <div style={{ ...summaryValueStyle, marginTop: 8 }}>{value}</div>
      <div style={{ ...subtleTextStyle, marginTop: 8, fontSize: '0.82rem' }}>{helper}</div>
    </div>
  )
}

function StatusPanel({
  title,
  tone,
  children,
}: {
  title: string
  tone: 'blue' | 'green' | 'slate'
  children: ReactNode
}) {
  const border =
    tone === 'green'
      ? '1px solid rgba(155,225,29,0.12)'
      : tone === 'slate'
        ? '1px solid rgba(148,163,184,0.14)'
        : '1px solid rgba(116,190,255,0.12)'

  const background =
    tone === 'green'
      ? 'linear-gradient(180deg, rgba(18,38,33,0.66) 0%, rgba(9,18,34,0.92) 100%)'
      : tone === 'slate'
        ? 'linear-gradient(180deg, rgba(19,28,45,0.74) 0%, rgba(9,18,34,0.92) 100%)'
        : 'linear-gradient(180deg, rgba(17,34,63,0.72) 0%, rgba(9,18,34,0.92) 100%)'

  return (
    <div
      style={{
        borderRadius: 22,
        border,
        background,
        padding: '16px',
      }}
    >
      <div style={{ color: '#F8FBFF', fontWeight: 800, fontSize: '1rem' }}>{title}</div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  )
}

function TypeCard({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        borderRadius: 20,
        padding: '16px',
        border: active
          ? '1px solid rgba(155,225,29,0.28)'
          : '1px solid rgba(116,190,255,0.10)',
        background: active
          ? 'linear-gradient(180deg, rgba(18,38,33,0.72) 0%, rgba(9,18,34,0.94) 100%)'
          : 'linear-gradient(180deg, rgba(17,34,63,0.58) 0%, rgba(9,18,34,0.92) 100%)',
        color: '#F8FBFF',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontWeight: 900, fontSize: '1rem' }}>{title}</div>
      <div style={{ ...subtleTextStyle, marginTop: 8, fontSize: '0.88rem' }}>{subtitle}</div>
    </button>
  )
}

function timeoutImport<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Import timed out after ${Math.round(timeoutMs / 1000)} seconds. Large schedule and scorecard batches can take longer, so try preview first and then commit.`))
    }, timeoutMs)

    promise
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timer)
        reject(error)
      })
  })
}

export default function AdminImportPage() {
  const [jsonInput, setJsonInput] = useState('')
  const [importType, setImportType] = useState<ImportKind>('schedule')
  const [selectedFileName, setSelectedFileName] = useState('')
  const [selectedFileCount, setSelectedFileCount] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileSummary[]>([])
  const [uploadLedger, setUploadLedger] = useState<MatchUploadLedgerRow[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(true)
  const [ledgerError, setLedgerError] = useState('')
  const [isRunningPreview, setIsRunningPreview] = useState(false)
  const [isRunningCommit, setIsRunningCommit] = useState(false)
  const [importResponse, setImportResponse] = useState<RunImportResponse | null>(null)
  const [topLevelError, setTopLevelError] = useState('')
  const [lastRunMode, setLastRunMode] = useState<ImportMode | null>(null)
  const [copied, setCopied] = useState(false)
  const [leagueNameOverride, setLeagueNameOverride] = useState('')
  const [reviewerName, setReviewerName] = useState('Admin')
  const [scorecardReviewOverrides, setScorecardReviewOverrides] = useState<
    Record<string, ScorecardMatchReviewOverride>
  >({})
  const [reviewDefaultFilter, setReviewDefaultFilter] = useState<ReviewFilterMode>('all')
  const [autoImportRequest, setAutoImportRequest] = useState<AutoImportRequest | null>(null)
  const [extensionStatusMessage, setExtensionStatusMessage] = useState('')
  const [lineCommitTargetMatchId, setLineCommitTargetMatchId] = useState<string | null>(null)
  const [lineCommitFeedback, setLineCommitFeedback] = useState('')

  const parsed = useMemo(() => parseJsonInput(jsonInput), [jsonInput])
  const effectivePayload = useMemo(() => {
    if (!parsed.value) return null
    return applyLeagueNameOverride(parsed.value, leagueNameOverride)
  }, [leagueNameOverride, parsed.value])

  const schedulePreview = useMemo(() => {
    if (!effectivePayload || importType !== 'schedule') {
      return { rows: [] as PreviewScheduleMatch[], warnings: [] as NormalizationWarning[] }
    }

    try {
      return buildSchedulePreview(effectivePayload)
    } catch {
      return { rows: [] as PreviewScheduleMatch[], warnings: [] as NormalizationWarning[] }
    }
  }, [effectivePayload, importType])

  const scorecardPreview = useMemo(() => {
    if (!effectivePayload || importType !== 'scorecard') {
      return {
        rows: [] as PreviewScorecardMatch[],
        normalizedRows: [] as ScorecardImportRow[],
        warnings: [] as NormalizationWarning[],
      }
    }

    try {
      return buildScorecardPreview(effectivePayload)
    } catch {
      return {
        rows: [] as PreviewScorecardMatch[],
        normalizedRows: [] as ScorecardImportRow[],
        warnings: [] as NormalizationWarning[],
      }
    }
  }, [effectivePayload, importType])

  const scorecardReviewPreviews = useMemo(
    () =>
      importType === 'scorecard'
        ? buildScorecardPreviewModels(scorecardPreview.normalizedRows, scorecardReviewOverrides)
        : [],
    [importType, scorecardPreview.normalizedRows, scorecardReviewOverrides],
  )

  const previewWarnings =
    importType === 'schedule' ? schedulePreview.warnings : scorecardPreview.warnings

  const normalizedRowCount =
    importType === 'schedule' ? schedulePreview.rows.length : scorecardPreview.rows.length

  const importSummary = useMemo(() => {
    if (!importResponse) return null
    return summarizeImportResponse(importResponse)
  }, [importResponse])

  const importMessages = useMemo(() => {
    if (!importResponse) return []
    return collectImportMessages(importResponse)
  }, [importResponse])

  const uploadDiagnostics = useMemo(() => {
    const relevantFiles = uploadedFiles.filter((file) => file.kind === importType)
    const duplicateMap = new Map<string, string[]>()

    for (const file of relevantFiles) {
      for (const externalMatchId of file.externalMatchIds) {
        const existing = duplicateMap.get(externalMatchId) ?? []
        existing.push(file.fileName)
        duplicateMap.set(externalMatchId, existing)
      }
    }

    const duplicates = [...duplicateMap.entries()]
      .filter(([, fileNames]) => fileNames.length > 1)
      .map(([externalMatchId, fileNames]) => ({
        externalMatchId,
        fileNames,
      }))
      .sort((a, b) => a.externalMatchId.localeCompare(b.externalMatchId))

    return {
      files: relevantFiles,
      duplicateMatchIds: duplicates,
    }
  }, [uploadedFiles, importType])

  const loadUploadLedger = useCallback(async () => {
    setLedgerLoading(true)
    setLedgerError('')

    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          external_match_id,
          league_name,
          flight,
          home_team,
          away_team,
          match_date,
          status,
          score,
          line_number
        `)
        .order('match_date', { ascending: true })
        .limit(1200)

      if (error) throw new Error(error.message)

      setUploadLedger((data || []) as MatchUploadLedgerRow[])
    } catch (error) {
      setUploadLedger([])
      setLedgerError(error instanceof Error ? error.message : 'Unable to load upload ledger.')
    } finally {
      setLedgerLoading(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const nextKind = params.get('kind')
    const nextLeagueOverride = params.get('leagueOverride')
    const nextReviewFilter = parseReviewFilter(params.get('focus'))
    const autoPaste = params.get('autopaste') === '1'
    const autoPreview = params.get('autopreview') === '1'
    const autoCommitParam = params.get('autocommit')

    let autoCommitMode: AutoImportRequest['autoCommitMode'] = 'none'
    if (autoCommitParam === 'all') autoCommitMode = 'all'
    if (autoCommitParam === 'clean_safe') autoCommitMode = 'clean_only'

    if (nextKind === 'schedule' || nextKind === 'scorecard') {
      setImportType(nextKind)
    }

    if (nextLeagueOverride) {
      setLeagueNameOverride(nextLeagueOverride)
    }

    setReviewDefaultFilter(nextReviewFilter)

    if (autoPaste || autoPreview || autoCommitMode !== 'none') {
      setAutoImportRequest({
        autoPaste,
        autoPreview,
        autoCommitMode,
        reviewFilter: nextReviewFilter,
        source: params.get('source'),
        started: false,
        cleanCommitTriggered: false,
      })
    }

    try {
      const savedDraft = window.localStorage.getItem(IMPORT_DRAFT_STORAGE_KEY)
      if (savedDraft) {
        setJsonInput(savedDraft)
      }

      if (!(nextKind === 'schedule' || nextKind === 'scorecard')) {
        const savedImportType = window.localStorage.getItem(IMPORT_TYPE_STORAGE_KEY)
        if (savedImportType === 'schedule' || savedImportType === 'scorecard') {
          setImportType(savedImportType)
        }
      }

      if (!nextLeagueOverride) {
        const savedLeagueOverride = window.localStorage.getItem(IMPORT_LEAGUE_OVERRIDE_STORAGE_KEY)
        if (savedLeagueOverride) {
          setLeagueNameOverride(savedLeagueOverride)
        }
      }

      const savedReviewer = window.localStorage.getItem(SCORECARD_REVIEWER_STORAGE_KEY)
      if (savedReviewer) {
        setReviewerName(savedReviewer)
      }

      const savedOverrides = window.localStorage.getItem(SCORECARD_REVIEW_STORAGE_KEY)
      if (savedOverrides) {
        setScorecardReviewOverrides(
          JSON.parse(savedOverrides) as Record<string, ScorecardMatchReviewOverride>,
        )
      }
    } catch {
      // Ignore local cache restore errors.
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(IMPORT_DRAFT_STORAGE_KEY, jsonInput)
  }, [jsonInput])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(IMPORT_TYPE_STORAGE_KEY, importType)
  }, [importType])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(IMPORT_LEAGUE_OVERRIDE_STORAGE_KEY, leagueNameOverride)
  }, [leagueNameOverride])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SCORECARD_REVIEWER_STORAGE_KEY, reviewerName)
  }, [reviewerName])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      SCORECARD_REVIEW_STORAGE_KEY,
      JSON.stringify(scorecardReviewOverrides),
    )
  }, [scorecardReviewOverrides])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      LAST_ADMIN_IMPORT_ROUTE_STORAGE_KEY,
      `${window.location.pathname}${window.location.search}`,
    )
  }, [importType, leagueNameOverride])

  useEffect(() => {
    void loadUploadLedger()
  }, [loadUploadLedger])

  const uploadLedgerSummary = useMemo(() => {
    const now = new Date()
    const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    const parentRows = uploadLedger.filter((row) => !row.line_number)
    const lineRows = uploadLedger.filter((row) => Boolean(row.line_number))
    const importedLineCounts = new Map<string, number>()

    for (const row of lineRows) {
      const externalMatchId = cleanString(row.external_match_id)
      const parentExternalMatchId = externalMatchId.split('::line:')[0] || ''
      if (!parentExternalMatchId) continue
      importedLineCounts.set(
        parentExternalMatchId,
        (importedLineCounts.get(parentExternalMatchId) || 0) + 1,
      )
    }

    const isCompleted = (row: MatchUploadLedgerRow) => {
      const externalMatchId = cleanString(row.external_match_id)
      return row.status === 'completed' || Boolean(row.score) || (externalMatchId ? (importedLineCounts.get(externalMatchId) || 0) > 0 : false)
    }

    const completed = parentRows.filter((row) => isCompleted(row))
    const pending = parentRows.filter((row) => {
      if (isCompleted(row)) return false
      if (!row.match_date) return false
      const matchKey = new Date(row.match_date).getTime()
      return !Number.isNaN(matchKey) && matchKey <= todayKey
    })
    const upcoming = parentRows.filter((row) => {
      if (isCompleted(row)) return false
      if (!row.match_date) return false
      const matchKey = new Date(row.match_date).getTime()
      return !Number.isNaN(matchKey) && matchKey > todayKey
    })

    return { completed, pending, upcoming, importedLineCounts }
  }, [uploadLedger])

  const showCommitSuccess =
    lastRunMode === 'commit' &&
    importResponse?.ok === true &&
    importSummary?.failedCount === 0

  const showCommitPartialWarning =
    lastRunMode === 'commit' &&
    importResponse?.ok === true &&
    (importSummary?.failedCount ?? 0) > 0

  const showPreviewSuccess =
    lastRunMode === 'preview' &&
    importResponse?.ok === true &&
    importSummary != null

  const executeImport = useCallback(async (mode: ImportMode, kind: ImportKind, payload: unknown) => {
    setTopLevelError('')
    setImportResponse(null)
    setLastRunMode(mode)
    setCopied(false)

    if (mode === 'preview') setIsRunningPreview(true)
    if (mode === 'commit') setIsRunningCommit(true)

    try {
      const response = await timeoutImport(
        runImport(supabase, {
          kind,
          payload,
          mode,
          engineOptions: {
            hasNormalizedPlayerNameColumn: true,
            matchPlayersDeleteBeforeInsert: true,
            scorecardLinesTable: null,
            scorecardReviewTable: null,
            persistReviewMetadata: true,
          },
        }),
        IMPORT_TIMEOUT_MS,
      )

      setImportResponse(response)

      if (!response.ok) {
        setTopLevelError(response.error)
      } else if (mode === 'commit') {
        await loadUploadLedger()
      }
    } catch (error) {
      setTopLevelError(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      setIsRunningPreview(false)
      setIsRunningCommit(false)
    }
  }, [loadUploadLedger])

  async function handleRun(mode: ImportMode) {
    if (!effectivePayload) {
      setTopLevelError(parsed.error ?? 'Invalid JSON.')
      return
    }

    if (importType === 'scorecard' && mode === 'preview') {
      await executeImport(mode, 'scorecard', scorecardPreview.normalizedRows)
      return
    }

    await executeImport(mode, importType, effectivePayload)
  }

  const applyJsonInput = useCallback(async (
    rawText: string,
    options?: {
      sourceLabel?: string
      autoPreview?: boolean
      autoCommitMode?: AutoImportRequest['autoCommitMode']
    },
  ) => {
    const parsedInput = parseJsonInput(rawText)
    if (!parsedInput.value) {
      setTopLevelError(parsedInput.error ?? 'Invalid JSON.')
      return
    }

    const inferredKind = inferImportTypeFromPayload(parsedInput.value) ?? importType
    const nextPayload = applyLeagueNameOverride(parsedInput.value, leagueNameOverride)

    resetScorecardReviewState()
    setJsonInput(rawText)
    setImportType(inferredKind)
    setExtensionStatusMessage(options?.sourceLabel ?? '')

    if (options?.autoPreview) {
      if (inferredKind === 'scorecard') {
        const normalized = normalizeCapturedScorecardPayload(nextPayload)
        await executeImport('preview', 'scorecard', normalized.rows)
        return
      }

      await executeImport('preview', inferredKind, nextPayload)
      return
    }

    if (options?.autoCommitMode === 'all' && inferredKind === 'schedule') {
      await executeImport('commit', inferredKind, nextPayload)
    }
  }, [executeImport, importType, leagueNameOverride])

  function resetScorecardReviewState() {
    setImportResponse(null)
    setTopLevelError('')
    setLastRunMode(null)
    setCopied(false)
    setLineCommitTargetMatchId(null)
    setLineCommitFeedback('')
    setScorecardReviewOverrides({})
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SCORECARD_REVIEW_STORAGE_KEY)
    }
  }

  function upsertScorecardOverride(
    externalMatchId: string,
    build: (current: ScorecardMatchReviewOverride) => ScorecardMatchReviewOverride,
  ) {
    setScorecardReviewOverrides((current) => {
      const nextCurrent = current[externalMatchId] ?? {}
      return {
        ...current,
        [externalMatchId]: build(nextCurrent),
      }
    })
  }

  function handleMatchDecisionChange(externalMatchId: string, decision: ReviewDecision) {
    upsertScorecardOverride(externalMatchId, (current) => ({
      ...current,
      decision,
      reviewedBy: reviewerName.trim() || current.reviewedBy || 'Admin',
      reviewedAt: new Date().toISOString(),
    }))
  }

  function handleReviewerNoteChange(externalMatchId: string, note: string) {
    upsertScorecardOverride(externalMatchId, (current) => ({
      ...current,
      reviewerNote: note,
      reviewedBy: reviewerName.trim() || current.reviewedBy || 'Admin',
      reviewedAt: new Date().toISOString(),
    }))
  }

  function handleLineOverrideChange(
    externalMatchId: string,
    lineNumber: number,
    patch: Record<string, unknown>,
  ) {
    upsertScorecardOverride(externalMatchId, (current) => ({
      ...current,
      decision: 'approve_with_overrides',
      reviewedBy: reviewerName.trim() || current.reviewedBy || 'Admin',
      reviewedAt: new Date().toISOString(),
      lineOverrides: {
        ...(current.lineOverrides ?? {}),
        [String(lineNumber)]: {
          ...(current.lineOverrides?.[String(lineNumber)] ?? {}),
          ...patch,
        },
      },
    }))
  }

  function handleApproveMatch(externalMatchId: string) {
    upsertScorecardOverride(externalMatchId, (current) => ({
      ...current,
      decision: current.lineOverrides ? 'approve_with_overrides' : 'accept_parser_result',
      reviewedBy: reviewerName.trim() || current.reviewedBy || 'Admin',
      reviewedAt: new Date().toISOString(),
    }))
  }

  async function handleApproveAndSubmitMatch(preview: ScorecardPreviewModel) {
    const reviewedBy = reviewerName.trim() || preview.finalPreview.reviewed_by || 'Admin'
    const reviewedAt = new Date().toISOString()

    setLineCommitTargetMatchId(preview.externalMatchId)
    setLineCommitFeedback('Submitting reviewed match...')
    handleApproveMatch(preview.externalMatchId)

    await executeImport('commit', 'scorecard', [
      {
        ...preview.finalPreview,
        reviewed_by: reviewedBy,
        reviewed_at: reviewedAt,
        reviewStatus:
          preview.finalPreview.lines.some((line) => line.winnerSide === null) ||
          preview.finalPreview.dataConflict
            ? 'needs_review'
            : 'clean',
      },
    ])
  }

  useEffect(() => {
    if (!lineCommitTargetMatchId || lastRunMode !== 'commit') return

    if (isRunningCommit) {
      setLineCommitFeedback('Submitting reviewed match...')
      return
    }

    if (topLevelError) {
      setLineCommitFeedback(topLevelError)
      return
    }

    if (importResponse?.ok === true) {
      setLineCommitFeedback('Match submitted. If this line was the last issue, the match is now finalized.')
    }
  }, [importResponse, isRunningCommit, lastRunMode, lineCommitTargetMatchId, topLevelError])

  async function handleScorecardCommit(selectionMode: 'clean_only' | 'approved_items') {
    const commitRows = buildScorecardCommitRows(scorecardReviewPreviews, selectionMode)
    if (commitRows.length === 0) {
      setTopLevelError(
        selectionMode === 'clean_only'
          ? 'No clean or safely repaired scorecards are ready to commit.'
          : 'No approved scorecards are ready to commit. Approve or exclude flagged matches first.',
      )
      return
    }

    await executeImport('commit', 'scorecard', commitRows)
  }

  useEffect(() => {
    if (!autoImportRequest || autoImportRequest.started || !autoImportRequest.autoPaste) {
      return
    }

    setAutoImportRequest((current) =>
      current ? { ...current, started: true } : current,
    )

    void (async () => {
      try {
        const clipboardText = await navigator.clipboard.readText()
        if (!clipboardText.trim()) {
          setTopLevelError('Clipboard is empty.')
          return
        }

        await applyJsonInput(clipboardText, {
          sourceLabel: autoImportRequest.source
            ? `${autoImportRequest.source} capture loaded from clipboard`
            : 'Latest capture loaded from clipboard',
          autoPreview: autoImportRequest.autoPreview,
          autoCommitMode: autoImportRequest.autoCommitMode,
        })
      } catch (error) {
        setTopLevelError(
          error instanceof Error
            ? `Automatic clipboard load failed: ${error.message}`
            : 'Automatic clipboard load failed.',
        )
      }
    })()
  }, [autoImportRequest, applyJsonInput])

  useEffect(() => {
    if (
      !autoImportRequest ||
      autoImportRequest.autoCommitMode !== 'clean_only' ||
      autoImportRequest.cleanCommitTriggered ||
      importType !== 'scorecard' ||
      lastRunMode !== 'preview' ||
      importResponse?.ok !== true ||
      scorecardReviewPreviews.length === 0 ||
      isRunningPreview ||
      isRunningCommit
    ) {
      return
    }

    setAutoImportRequest((current) =>
      current ? { ...current, cleanCommitTriggered: true } : current,
    )
    setExtensionStatusMessage('Safe scorecards are being committed automatically. Flagged matches are staying in review.')
    void handleScorecardCommit('clean_only')
  }, [
    autoImportRequest,
    importResponse?.ok,
    importType,
    isRunningCommit,
    isRunningPreview,
    lastRunMode,
    scorecardReviewPreviews.length,
  ])

  function handleReviewFlaggedMatches() {
    const target = document.querySelector('[data-review-match="flagged"]')
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files || files.length === 0) return

    resetScorecardReviewState()
    setExtensionStatusMessage('')

    const fileNames: string[] = []
    const aggregatedPayloads: unknown[] = []
    const nextUploadedFiles: UploadedFileSummary[] = []
    let inferredType: ImportKind | null = null

    for (const file of Array.from(files)) {
      fileNames.push(file.name)

      let parsedFile: unknown
      try {
        const text = await file.text()
        parsedFile = JSON.parse(text)
      } catch {
        setTopLevelError(`Could not parse JSON from ${file.name}.`)
        event.target.value = ''
        return
      }

      const fileKind: ImportKind =
        inferImportTypeFromFileName(file.name) ??
        inferImportTypeFromPayload(parsedFile) ??
        inferredType ??
        importType

      if (!inferredType) {
        inferredType = fileKind
      } else if (inferredType !== fileKind) {
        setTopLevelError(
          `Mixed import types detected. ${file.name} looks like ${fileKind}, but the batch is currently ${inferredType}. Upload schedules and scorecards separately.`,
        )
        event.target.value = ''
        return
      }

      aggregatedPayloads.push(parsedFile)
      nextUploadedFiles.push(summarizeUploadedFile(file.name, parsedFile, fileKind))
    }

    if (inferredType) {
      setImportType(inferredType)
    }

    setSelectedFileCount(fileNames.length)
    setSelectedFileName(fileNames.join(', '))
    setUploadedFiles(nextUploadedFiles)
    setJsonInput(prettyJson(aggregatedPayloads.length === 1 ? aggregatedPayloads[0] : aggregatedPayloads))

    event.target.value = ''
  }

  function handleLoadSample() {
    setExtensionStatusMessage('')
    resetScorecardReviewState()
    if (importType === 'schedule') {
      const sample = {
        pageType: 'season_schedule',
        seasonSchedule: {
          leagueName: '2026 Adult 18 & Over Spring',
          flight: 'Men 4.5',
          ustaSection: 'USTA/MISSOURI VALLEY',
          districtArea: 'ST. LOUIS - St. Louis Local Leagues',
          matches: [
            {
              externalMatchId: '1011650707',
              matchDate: '2026-04-19',
              matchTime: '6:30 PM',
              homeTeam: 'Schnellaveria',
              awayTeam: 'Meinert/The Other Guys',
              facility: 'Sample Club',
            },
            {
              externalMatchId: '1011650703',
              matchDate: '2026-04-26',
              matchTime: '6:30 PM',
              homeTeam: "Gontarz/Wild William's Wily Wolverines",
              awayTeam: 'Schnellaveria',
              facility: 'Sample Club',
            },
          ],
        },
      }

      setSelectedFileName('sample-schedule.json')
      setSelectedFileCount(1)
      setUploadedFiles([summarizeUploadedFile('sample-schedule.json', sample, 'schedule')])
      setJsonInput(prettyJson(sample))
      return
    }

    const sample = {
      pageType: 'scorecard',
      scorecard: {
        matchId: '1011650666',
        dateMatchPlayed: '2026-01-18',
        homeTeam: 'Schnellaveria',
        awayTeam: "Gontarz/Wild William's Wily Wolverines",
        facility: 'Sample Club',
        leagueName: '2026 Adult 18 & Over Spring',
        flight: 'Men 4.5',
        ustaSection: 'USTA/MISSOURI VALLEY',
        districtArea: 'ST. LOUIS - St. Louis Local Leagues',
        lines: [
          {
            lineNumber: 1,
            matchType: 'singles',
            homePlayers: ['Stephen Hipkiss'],
            awayPlayers: ['Nathan Meinert'],
            winnerSide: 'home',
            sets: [
              { homeGames: 6, awayGames: 2 },
              { homeGames: 6, awayGames: 1 },
            ],
          },
          {
            lineNumber: 2,
            matchType: 'doubles',
            homePlayers: ['Ian Keillor', 'Philip Kammann'],
            awayPlayers: ['Andy Horton', 'RJ Tevonian'],
            winnerSide: 'home',
            sets: [
              { homeGames: 6, awayGames: 2 },
              { homeGames: 6, awayGames: 0 },
            ],
          },
        ],
      },
    }

    setSelectedFileName('sample-scorecard.json')
    setSelectedFileCount(1)
    setUploadedFiles([summarizeUploadedFile('sample-scorecard.json', sample, 'scorecard')])
    setJsonInput(prettyJson(sample))
  }

  function handleClearAll() {
    setSelectedFileName('')
    setSelectedFileCount(0)
    setUploadedFiles([])
    setJsonInput('')
    resetScorecardReviewState()
    setLeagueNameOverride('')
    setExtensionStatusMessage('')
    setIsRunningPreview(false)
    setIsRunningCommit(false)
  }

  function handleAutoDetectType() {
    if (!parsed.value) return
    const inferred = inferImportTypeFromPayload(parsed.value)
    if (inferred) {
      resetScorecardReviewState()
      setImportType(inferred)
    }
  }

  async function handleCopyMessages() {
    if (!importMessages.length) return
    try {
      await navigator.clipboard.writeText(importMessages.join('\n'))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  async function handlePasteFromClipboard() {
    try {
      const clipboardText = await navigator.clipboard.readText()
      if (!clipboardText.trim()) {
        setTopLevelError('Clipboard is empty.')
        return
      }
      await applyJsonInput(clipboardText)
    } catch (error) {
      setTopLevelError(
        error instanceof Error
          ? `Clipboard paste failed: ${error.message}`
          : 'Clipboard paste failed.',
      )
    }
  }

  return (
    <SiteShell active="/admin">
      <AdminGate>
        <section style={pageWrapStyle}>
        <section
          style={{
            ...glassCardStyle,
            padding: '24px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-90px',
              right: '-54px',
              width: 220,
              height: 220,
              borderRadius: 999,
              background: 'radial-gradient(circle, rgba(74,163,255,0.16) 0%, transparent 72%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-110px',
              left: '-70px',
              width: 240,
              height: 240,
              borderRadius: 999,
              background: 'radial-gradient(circle, rgba(155,225,29,0.10) 0%, transparent 74%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={pillBlueStyle}>Unified ingest</div>
            <h1 className="page-title" style={{ marginTop: 10 }}>
              Admin Import Center
            </h1>
            <p className="page-subtitle" style={{ maxWidth: 920 }}>
              One place for both schedule and scorecard imports. Upload a JSON file or paste captured
              JSON, preview the normalized rows, review warnings, and commit through the same ingestion engine.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 14,
                marginTop: 18,
              }}
            >
              <SummaryMetric
                label="Import types"
                value="2"
                helper="Schedule and scorecard now live in one route."
              />
              <SummaryMetric
                label="Input modes"
                value="File + Paste"
                helper="Upload JSON directly or paste from your capture tool."
              />
              <SummaryMetric
                label="Preview"
                value="Enabled"
                helper="Validate row shapes and warnings before writing."
              />
              <SummaryMetric
                label="Commit"
                value="Unified"
                helper="Both import kinds flow through the same runImport path."
              />
            </div>
          </div>
        </section>

        {importType === 'scorecard' && scorecardReviewPreviews.length > 0 ? (
          <ScorecardReviewPanel
            previews={scorecardReviewPreviews}
            reviewerName={reviewerName}
            onReviewerNameChange={setReviewerName}
            onMatchDecisionChange={handleMatchDecisionChange}
            onApproveMatch={handleApproveMatch}
            onApproveAndSubmitMatch={(preview) => void handleApproveAndSubmitMatch(preview)}
            onReviewerNoteChange={handleReviewerNoteChange}
            onLineOverrideChange={handleLineOverrideChange}
            onCommitCleanOnly={() => void handleScorecardCommit('clean_only')}
            onCommitApprovedItems={() => void handleScorecardCommit('approved_items')}
            onReviewFlagged={handleReviewFlaggedMatches}
            isRunningCommit={isRunningCommit}
            defaultFilter={reviewDefaultFilter}
            commitFeedbackMatchId={lineCommitTargetMatchId}
            commitFeedbackMessage={lineCommitFeedback}
          />
        ) : null}

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '1.15fr 0.85fr',
            gap: 18,
            marginTop: 22,
            alignItems: 'start',
          }}
        >
          <div style={panelStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={labelStyle}>Input</div>
                <div
                  style={{
                    color: '#F8FBFF',
                    fontWeight: 800,
                    fontSize: '1.06rem',
                    marginTop: 8,
                  }}
                >
                  Upload or paste captured import JSON
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ ...secondaryButtonStyle, cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept=".json,text/plain,application/json"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  Choose file
                </label>
                <button type="button" style={mutedButtonStyle} onClick={handleLoadSample}>
                  Load sample
                </button>
                <button type="button" style={mutedButtonStyle} onClick={handleClearAll}>
                  Clear
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 16,
              }}
            >
              <TypeCard
                active={importType === 'schedule'}
                title="Schedule import"
                subtitle="Use for season schedules and upcoming team match records."
                onClick={() => {
                  resetScorecardReviewState()
                  setImportType('schedule')
                }}
              />
              <TypeCard
                active={importType === 'scorecard'}
                title="Scorecard import"
                subtitle="Use for completed line-by-line results with player detail."
                onClick={() => {
                  resetScorecardReviewState()
                  setImportType('scorecard')
                }}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 14,
                marginTop: 16,
              }}
            >
              <div>
                <label htmlFor="admin-import-type" style={labelStyle}>Import type</label>
                <select
                  id="admin-import-type"
                  value={importType}
                  onChange={(event) => {
                    resetScorecardReviewState()
                    setImportType(event.target.value as ImportKind)
                  }}
                  aria-describedby="admin-import-helper"
                  style={selectStyle}
                >
                  <option value="schedule">Schedule</option>
                  <option value="scorecard">Scorecard</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Loaded file</label>
                <div
                  style={{
                    ...inputStyle,
                    display: 'flex',
                    alignItems: 'center',
                    color: selectedFileName ? '#F8FBFF' : '#AFC3DB',
                  }}
                >
                  {selectedFileName
                    ? `${selectedFileName}${selectedFileCount > 1 ? ` (${selectedFileCount} files)` : ''}`
                    : 'No file selected'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label htmlFor="admin-import-league-override" style={labelStyle}>League name override</label>
              <input
                id="admin-import-league-override"
                type="text"
                value={leagueNameOverride}
                onChange={(event) => {
                  resetScorecardReviewState()
                  setLeagueNameOverride(event.target.value)
                }}
                placeholder="Optional: force a season name like 2026 Adult 18 & Over Fall"
                style={inputStyle}
              />
              <div style={{ ...subtleTextStyle, marginTop: 8, fontSize: '0.86rem' }}>
                Use this when the captured file includes the right district and flight but misses the actual season name. The override applies to both preview and commit for the current batch.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                marginTop: 12,
              }}
            >
              <span style={pillSlateStyle}>Detected rows: {normalizedRowCount}</span>
              <span style={pillSlateStyle}>Warnings: {previewWarnings.length}</span>
              <button type="button" style={mutedButtonStyle} onClick={() => void handlePasteFromClipboard()}>
                Paste from clipboard
              </button>
              {parsed.value ? (
                <button type="button" style={mutedButtonStyle} onClick={handleAutoDetectType}>
                  Auto-detect type
                </button>
              ) : null}
            </div>

            <div style={{ ...subtleTextStyle, marginTop: 10, fontSize: '0.88rem' }}>
              <span id="admin-import-helper">
              Schedule accepts wrapped schedule payloads or arrays of rows. Scorecard accepts single
              scorecard objects, wrapped payloads, or arrays.
              </span>
            </div>

            <div style={{ ...subtleTextStyle, marginTop: 8, fontSize: '0.88rem' }}>
              You can also select multiple JSON files at once. Duplicate completed scorecards are skipped and should be called out in the import response below.
            </div>

            {extensionStatusMessage ? (
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 16,
                  border: '1px solid rgba(116,190,255,0.16)',
                  background: 'rgba(17,34,63,0.48)',
                  color: '#EAF4FF',
                  padding: '12px 14px',
                  fontWeight: 700,
                }}
              >
                {extensionStatusMessage}
              </div>
            ) : null}

            {selectedFileName ? (
              <div style={{ marginTop: 12 }}>
                <span style={pillGreenStyle}>
                  Loaded: {selectedFileName}{selectedFileCount > 1 ? ` (${selectedFileCount} files)` : ''}
                </span>
              </div>
            ) : null}

            <div style={{ marginTop: 16 }}>
              <label htmlFor="admin-import-json" style={labelStyle}>Import JSON</label>
              <textarea
                id="admin-import-json"
                value={jsonInput}
                onChange={(event) => {
                  resetScorecardReviewState()
                  setJsonInput(event.target.value)
                }}
                placeholder="Paste captured JSON here..."
                style={textareaStyle}
                aria-describedby="admin-import-helper"
                spellCheck={false}
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => handleRun('preview')}
                style={{
                  ...secondaryButtonStyle,
                  opacity: isRunningPreview ? 0.8 : 1,
                  cursor: isRunningPreview ? 'wait' : 'pointer',
                }}
                disabled={isRunningPreview || isRunningCommit}
              >
                {isRunningPreview ? 'Running preview…' : 'Preview import'}
              </button>

              <button
                type="button"
                onClick={() =>
                  importType === 'scorecard'
                    ? void handleScorecardCommit('approved_items')
                    : void handleRun('commit')
                }
                style={{
                  ...primaryButtonStyle,
                  opacity: isRunningCommit ? 0.82 : 1,
                  cursor: isRunningCommit ? 'wait' : 'pointer',
                }}
                disabled={isRunningPreview || isRunningCommit}
              >
                {isRunningCommit
                  ? 'Committing…'
                  : importType === 'scorecard'
                    ? 'Submit reviewed matches'
                    : 'Commit import'}
              </button>
            </div>

            {topLevelError ? (
              <div
                role="alert"
                style={{
                  marginTop: 14,
                  borderRadius: 18,
                  border: '1px solid rgba(255,99,132,0.18)',
                  background:
                    'linear-gradient(180deg, rgba(59,20,31,0.72) 0%, rgba(24,10,16,0.92) 100%)',
                  color: '#FFD5DF',
                  padding: '14px 16px',
                  fontWeight: 700,
                }}
              >
                {topLevelError}
              </div>
            ) : null}

            {showCommitSuccess && importSummary ? (
              <div
                role="status"
                aria-live="polite"
                style={{
                  marginTop: 14,
                  borderRadius: 18,
                  border: '1px solid rgba(155,225,29,0.22)',
                  background:
                    'linear-gradient(180deg, rgba(18,38,33,0.82) 0%, rgba(9,18,34,0.96) 100%)',
                  color: '#DFFFC2',
                  padding: '14px 16px',
                  fontWeight: 800,
                  boxShadow: '0 12px 28px rgba(155,225,29,0.08)',
                }}
              >
                ✅ Commit completed successfully.
                <div style={{ marginTop: 8, color: '#CFE8D0', fontWeight: 600, lineHeight: 1.6 }}>
                  {importSummary.successCount} imported
                  {importSummary.updatedCount > 0 ? ` • ${importSummary.updatedCount} updated` : ''}
                  {importSummary.createdPlayersCount > 0
                    ? ` • ${importSummary.createdPlayersCount} players created`
                    : ''}
                  {importSummary.linkedPlayersCount > 0
                    ? ` • ${importSummary.linkedPlayersCount} players linked`
                    : ''}
                </div>
              </div>
            ) : null}

            {showCommitPartialWarning && importSummary ? (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 18,
                  border: '1px solid rgba(250,204,21,0.22)',
                  background:
                    'linear-gradient(180deg, rgba(58,44,12,0.82) 0%, rgba(24,18,10,0.96) 100%)',
                  color: '#FDE68A',
                  padding: '14px 16px',
                  fontWeight: 800,
                  boxShadow: '0 12px 28px rgba(250,204,21,0.06)',
                }}
              >
                ⚠️ Commit finished with some failures.
                <div style={{ marginTop: 8, color: '#FDE68A', fontWeight: 600, lineHeight: 1.6 }}>
                  {importSummary.successCount} imported
                  {importSummary.updatedCount > 0 ? ` • ${importSummary.updatedCount} updated` : ''}
                  {importSummary.failedCount} failed
                </div>
              </div>
            ) : null}

            {showPreviewSuccess && importSummary ? (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 18,
                  border: '1px solid rgba(116,190,255,0.18)',
                  background:
                    'linear-gradient(180deg, rgba(17,34,63,0.82) 0%, rgba(9,18,34,0.96) 100%)',
                  color: '#DCEBFF',
                  padding: '14px 16px',
                  fontWeight: 800,
                }}
              >
                👀 Preview completed successfully.
                <div style={{ marginTop: 8, color: '#BFD8F7', fontWeight: 600, lineHeight: 1.6 }}>
                  {importSummary.normalizedRowCount} normalized rows ready for commit
                  {importSummary.failedCount > 0 ? ` • ${importSummary.failedCount} preview failures` : ''}
                </div>
              </div>
            ) : null}

            {lastRunMode === 'commit' &&
            importResponse?.ok === true &&
            importSummary != null &&
            importSummary.successCount === 0 &&
            importSummary.updatedCount === 0 &&
            importSummary.failedCount === 0 ? (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 18,
                  border: '1px solid rgba(148,163,184,0.20)',
                  background:
                    'linear-gradient(180deg, rgba(19,28,45,0.82) 0%, rgba(9,18,34,0.96) 100%)',
                  color: '#D6E1EF',
                  padding: '14px 16px',
                  fontWeight: 800,
                }}
              >
                ℹ️ No new rows were imported.
                <div style={{ marginTop: 8, color: '#B8C7D9', fontWeight: 600, lineHeight: 1.6 }}>
                  This usually means the selected scorecard was already completed and was skipped as a duplicate.
                </div>
              </div>
            ) : null}
          </div>

          <div style={panelStyle}>
            <div style={labelStyle}>Readiness</div>
            <div
              style={{
                color: '#F8FBFF',
                fontWeight: 800,
                fontSize: '1.06rem',
                marginTop: 8,
              }}
            >
              Normalization status
            </div>

            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              <StatusPanel title="Import type" tone="blue">
                <div style={summaryValueStyle}>
                  {importType === 'schedule' ? 'Schedule' : 'Scorecard'}
                </div>
                <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                  The current preview and commit path uses the selected import kind.
                </div>
              </StatusPanel>

              <StatusPanel title="Detected rows" tone="green">
                <div style={summaryValueStyle}>{normalizedRowCount}</div>
                <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                  Normalized rows currently ready for preview or commit.
                </div>
              </StatusPanel>

              <StatusPanel title="Warnings" tone="slate">
                <div style={summaryValueStyle}>{previewWarnings.length}</div>
                <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                  Non-fatal shaping issues found while normalizing the captured JSON.
                </div>
              </StatusPanel>

              <StatusPanel title="Files loaded" tone="blue">
                <div style={summaryValueStyle}>{uploadDiagnostics.files.length}</div>
                <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                  File-by-file diagnostics are shown below when you upload a batch.
                </div>
              </StatusPanel>

              <StatusPanel title="Duplicate match IDs" tone={uploadDiagnostics.duplicateMatchIds.length > 0 ? 'slate' : 'green'}>
                <div style={summaryValueStyle}>{uploadDiagnostics.duplicateMatchIds.length}</div>
                <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                  Duplicate external match ids across uploaded files should be reviewed before commit.
                </div>
              </StatusPanel>

              <StatusPanel title="Past matches needing scorecards" tone={uploadLedgerSummary.pending.length > 0 ? 'slate' : 'green'}>
                <div style={summaryValueStyle}>{uploadLedgerSummary.pending.length}</div>
                <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                  Scheduled matches on or before today that still do not look completed.
                </div>
              </StatusPanel>
            </div>
          </div>
        </section>

        <section style={{ ...panelStyle, marginTop: 22 }}>
          <div style={labelStyle}>Upload ledger</div>
          <div
            style={{
              color: '#F8FBFF',
              fontWeight: 800,
              fontSize: '1.06rem',
              marginTop: 8,
            }}
          >
            Schedule-to-scorecard tracking
          </div>
          <div style={{ ...subtleTextStyle, marginTop: 10 }}>
            Use this to see what has already been completed versus which scheduled matches still need a scorecard upload after match day.
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <button
              type="button"
              style={mutedButtonStyle}
              onClick={() => void loadUploadLedger()}
              disabled={ledgerLoading}
            >
              {ledgerLoading ? 'Refreshing ledger...' : 'Refresh upload ledger'}
            </button>
          </div>

          {ledgerLoading ? (
            <div style={{ ...subtleTextStyle, marginTop: 14 }}>Loading upload ledger…</div>
          ) : ledgerError ? (
            <div
              role="alert"
              style={{
                marginTop: 14,
                borderRadius: 18,
                border: '1px solid rgba(248,113,113,0.24)',
                background: 'rgba(127,29,29,0.18)',
                color: '#fecaca',
                padding: '14px 16px',
              }}
            >
              {ledgerError}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 18, marginTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                <SummaryMetric label="Needs upload" value={String(uploadLedgerSummary.pending.length)} helper="Past scheduled matches still missing scorecards." />
                <SummaryMetric label="Upcoming" value={String(uploadLedgerSummary.upcoming.length)} helper="Future scheduled matches waiting on results." />
                <SummaryMetric label="Completed" value={String(uploadLedgerSummary.completed.length)} helper="Parent matches that already look complete." />
              </div>

              {uploadLedgerSummary.pending.length > 0 ? (
                <div>
                  <div style={{ color: '#F8FBFF', fontWeight: 800, fontSize: '0.98rem' }}>Past matches still needing scorecards</div>
                  <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                    {uploadLedgerSummary.pending.slice(0, 12).map((row) => (
                      <div
                        key={row.id}
                        style={{
                          borderRadius: 18,
                          border: '1px solid rgba(250,204,21,0.18)',
                          background: 'linear-gradient(180deg, rgba(58,44,12,0.52) 0%, rgba(24,18,10,0.90) 100%)',
                          padding: '14px 16px',
                        }}
                      >
                        <div style={{ color: '#F8FBFF', fontWeight: 800 }}>
                          {(row.home_team || 'TBD')} vs {(row.away_team || 'TBD')}
                        </div>
                        <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                          {cleanString(row.match_date) || 'No date'}
                          {row.flight ? ` • ${row.flight}` : ''}
                          {row.league_name ? ` • ${row.league_name}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                          <span style={pillBlueStyle}>Match ID: {row.external_match_id || 'Missing'}</span>
                          <span style={pillSlateStyle}>Status: {row.status || 'scheduled'}</span>
                          <span style={pillGreenStyle}>
                            Scorecard lines: {row.external_match_id ? (uploadLedgerSummary.importedLineCounts.get(cleanString(row.external_match_id)) || 0) : 0}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                          <Link
                            href={`/admin/missing-scorecards?status=pending&league=${encodeURIComponent([cleanString(row.league_name), cleanString(row.flight)].filter(Boolean).join(' - '))}&team=${encodeURIComponent(cleanString(row.home_team) || cleanString(row.away_team))}`}
                            style={{ ...secondaryButtonStyle, minHeight: 40, textDecoration: 'none' }}
                          >
                            Open scorecard queue
                          </Link>
                          <Link
                            href={`/admin/manage-matches?search=${encodeURIComponent(row.external_match_id || `${row.home_team || ''} ${row.away_team || ''}`.trim())}`}
                            style={{ ...secondaryButtonStyle, minHeight: 40, textDecoration: 'none' }}
                          >
                            Review match record
                          </Link>
                          <span style={{ ...subtleTextStyle, fontSize: '0.86rem' }}>
                            Open a filtered match review to confirm the parent record once a scorecard is uploaded.
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ ...subtleTextStyle }}>
                  No past scheduled matches are currently waiting on scorecard uploads.
                </div>
              )}
            </div>
          )}
        </section>

        {uploadDiagnostics.files.length > 0 ? (
          <section style={{ ...panelStyle, marginTop: 22 }}>
            <div style={labelStyle}>Batch diagnostics</div>
            <div
              style={{
                color: '#F8FBFF',
                fontWeight: 800,
                fontSize: '1.06rem',
                marginTop: 8,
              }}
            >
              Uploaded file breakdown
            </div>

            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              {uploadDiagnostics.files.map((file) => (
                <div
                  key={file.fileName}
                  style={{
                    borderRadius: 18,
                    border: '1px solid rgba(116,190,255,0.10)',
                    background: 'rgba(8,15,28,0.62)',
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ color: '#F8FBFF', fontWeight: 800 }}>{file.fileName}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={pillBlueStyle}>{file.kind}</span>
                      <span style={pillGreenStyle}>{file.normalizedRowCount} rows</span>
                      <span style={pillSlateStyle}>{file.warningCount} warnings</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {uploadDiagnostics.duplicateMatchIds.length > 0 ? (
              <div
                style={{
                  marginTop: 16,
                  borderRadius: 18,
                  border: '1px solid rgba(250,204,21,0.22)',
                  background: 'linear-gradient(180deg, rgba(58,44,12,0.82) 0%, rgba(24,18,10,0.96) 100%)',
                  color: '#FDE68A',
                  padding: '14px 16px',
                }}
              >
                <div style={{ fontWeight: 800 }}>Duplicate external match IDs detected across files</div>
                <div style={{ ...subtleTextStyle, marginTop: 8, color: '#FDE68A' }}>
                  Review these before commit. A duplicate id means one file may overwrite another match record if they are not truly the same match.
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  {uploadDiagnostics.duplicateMatchIds.slice(0, 12).map((item) => (
                    <div key={item.externalMatchId} style={{ color: '#FDE68A', fontSize: '0.9rem' }}>
                      Match ID {item.externalMatchId}: {item.fileNames.join(', ')}
                    </div>
                  ))}
                  {uploadDiagnostics.duplicateMatchIds.length > 12 ? (
                    <div style={{ color: '#FDE68A', fontSize: '0.9rem' }}>
                      {uploadDiagnostics.duplicateMatchIds.length - 12} more duplicate ids hidden for brevity.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section style={{ ...panelStyle, marginTop: 22 }}>
          <div style={labelStyle}>Preview</div>
          <div
            style={{
              color: '#F8FBFF',
              fontWeight: 800,
              fontSize: '1.06rem',
              marginTop: 8,
            }}
          >
            {importType === 'schedule'
              ? 'Normalized schedule matches'
              : 'Normalized scorecard matches'}
          </div>

          {importType === 'schedule' ? (
            schedulePreview.rows.length === 0 ? (
              <div style={{ ...subtleTextStyle, marginTop: 14 }}>
                Paste or upload schedule JSON to preview normalized schedule rows.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
                {schedulePreview.rows.map((match) => (
                  <div
                    key={`${match.externalMatchId}-${match.matchDate}`}
                    style={{
                      borderRadius: 22,
                      border: '1px solid rgba(116,190,255,0.10)',
                      background:
                        'linear-gradient(180deg, rgba(17,34,63,0.58) 0%, rgba(9,18,34,0.92) 100%)',
                      padding: '16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 14,
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div style={{ color: '#F8FBFF', fontWeight: 900, fontSize: '1rem' }}>
                          {match.homeTeam} vs {match.awayTeam}
                        </div>
                        <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                          {match.matchDate}
                          {match.matchTime ? ` • ${match.matchTime}` : ''}
                          {match.facility ? ` • ${match.facility}` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={pillBlueStyle}>Match ID: {match.externalMatchId}</span>
                        <span style={pillGreenStyle}>{match.flight || 'No flight'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      {match.leagueName ? <span style={pillSlateStyle}>{match.leagueName}</span> : null}
                      {match.ustaSection ? <span style={pillSlateStyle}>{match.ustaSection}</span> : null}
                      {match.districtArea ? <span style={pillSlateStyle}>{match.districtArea}</span> : null}
                    </div>

                    {match.source ? (
                      <div style={{ ...subtleTextStyle, marginTop: 12, fontSize: '0.86rem' }}>
                        Source: {match.source}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )
          ) : scorecardReviewPreviews.length > 0 ? (
            <div
              style={{
                marginTop: 16,
                borderRadius: 20,
                border: '1px solid rgba(116,190,255,0.10)',
                background: 'rgba(8,15,28,0.62)',
                padding: '16px',
              }}
            >
              <div style={{ color: '#F8FBFF', fontWeight: 800 }}>
                Focused scorecard review is active above.
              </div>
              <div style={{ ...subtleTextStyle, marginTop: 8 }}>
                The detailed review panel now replaces the large raw scorecard preview so you can go straight to flagged lines and approvals.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <span style={pillSlateStyle}>Matches: {scorecardReviewPreviews.length}</span>
                <span style={pillSlateStyle}>
                  Needs review: {scorecardReviewPreviews.filter((preview) => preview.status === 'needs_review').length}
                </span>
                <span style={pillSlateStyle}>
                  Blocked: {scorecardReviewPreviews.filter((preview) => preview.status === 'blocked').length}
                </span>
              </div>
            </div>
          ) : scorecardPreview.rows.length === 0 ? (
            <div style={{ ...subtleTextStyle, marginTop: 14 }}>
              Paste or upload scorecard JSON to preview normalized scorecard rows.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
              {scorecardPreview.rows.map((match) => (
                <div
                  key={`${match.externalMatchId}-${match.matchDate}`}
                  style={{
                    borderRadius: 22,
                    border: '1px solid rgba(116,190,255,0.10)',
                    background:
                      'linear-gradient(180deg, rgba(17,34,63,0.58) 0%, rgba(9,18,34,0.92) 100%)',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 14,
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ color: '#F8FBFF', fontWeight: 900, fontSize: '1rem' }}>
                        {match.homeTeam} vs {match.awayTeam}
                      </div>
                      <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                        {match.matchDate}
                        {match.matchTime ? ` • ${match.matchTime}` : ''}
                        {match.facility ? ` • ${match.facility}` : ''}
                        {match.flight ? ` • ${match.flight}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={pillBlueStyle}>Match ID: {match.externalMatchId}</span>
                      <span style={pillGreenStyle}>{match.lineCount} lines</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {match.leagueName ? <span style={pillSlateStyle}>{match.leagueName}</span> : null}
                    {match.ustaSection ? <span style={pillSlateStyle}>{match.ustaSection}</span> : null}
                    {match.districtArea ? <span style={pillSlateStyle}>{match.districtArea}</span> : null}
                  </div>

                  <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                    {match.lines.map((line) => (
                      <div
                        key={`${match.externalMatchId}-line-${line.lineNumber}`}
                        style={{
                          borderRadius: 18,
                          border: '1px solid rgba(116,190,255,0.08)',
                          background: 'rgba(8,15,28,0.55)',
                          padding: '14px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ color: '#F8FBFF', fontWeight: 800 }}>
                            Line {line.lineNumber} • {line.matchType}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={pillGreenStyle}>
                              Winner: {getScorecardWinnerLabel(match, line.winnerSide)}
                            </span>
                            <span style={pillBlueStyle}>Score: {cleanString(line.score) || '—'}</span>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 12,
                            marginTop: 12,
                          }}
                        >
                          <div
                            style={{
                              borderRadius: 16,
                              border: '1px solid rgba(116,190,255,0.08)',
                              background: 'rgba(12,22,40,0.72)',
                              padding: '12px',
                            }}
                          >
                            <div style={{ ...labelStyle, fontSize: '0.7rem' }}>Home side</div>
                            <div style={{ ...subtleTextStyle, marginTop: 8 }}>
                              {line.sideAPlayers.join(' / ') || '—'}
                            </div>
                          </div>

                          <div
                            style={{
                              borderRadius: 16,
                              border: '1px solid rgba(116,190,255,0.08)',
                              background: 'rgba(12,22,40,0.72)',
                              padding: '12px',
                            }}
                          >
                            <div style={{ ...labelStyle, fontSize: '0.7rem' }}>Away side</div>
                            <div style={{ ...subtleTextStyle, marginTop: 8 }}>
                              {line.sideBPlayers.join(' / ') || '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {match.source ? (
                    <div style={{ ...subtleTextStyle, marginTop: 12, fontSize: '0.86rem' }}>
                      Source: {match.source}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 18,
            marginTop: 22,
            alignItems: 'start',
          }}
        >
          <div style={panelStyle}>
            <div style={labelStyle}>Warnings</div>
            <div
              style={{
                color: '#F8FBFF',
                fontWeight: 800,
                fontSize: '1.06rem',
                marginTop: 8,
              }}
            >
              Normalization warnings
            </div>

            {previewWarnings.length === 0 ? (
              <div style={{ ...subtleTextStyle, marginTop: 14 }}>
                No normalization warnings yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {previewWarnings.map((warning, index) => (
                  <div
                    key={`${warning.rowIndex}-${index}`}
                    style={{
                      borderRadius: 18,
                      border: '1px solid rgba(148,163,184,0.14)',
                      background:
                        'linear-gradient(180deg, rgba(19,28,45,0.72) 0%, rgba(9,18,34,0.92) 100%)',
                      padding: '12px 14px',
                      color: '#D6E1EF',
                    }}
                  >
                    Row {warning.rowIndex + 1}: {warning.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={labelStyle}>Import result</div>
                <div
                  style={{
                    color: '#F8FBFF',
                    fontWeight: 800,
                    fontSize: '1.06rem',
                    marginTop: 8,
                  }}
                >
                  Engine response
                </div>
              </div>

              {importMessages.length > 0 ? (
                <button type="button" style={mutedButtonStyle} onClick={handleCopyMessages}>
                  {copied ? 'Copied' : 'Copy messages'}
                </button>
              ) : null}
            </div>

            {!importResponse || !importSummary ? (
              <div style={{ ...subtleTextStyle, marginTop: 14 }}>
                Run preview or commit to see the ingestion response here.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 10,
                    marginTop: 14,
                  }}
                >
                  <SummaryMetric
                    label="Normalized"
                    value={String(importSummary.normalizedRowCount)}
                    helper="Rows handed to the engine."
                  />
                  <SummaryMetric
                    label="Imported"
                    value={String(importSummary.successCount)}
                    helper="Fresh rows written."
                  />
                  <SummaryMetric
                    label="Updated"
                    value={String(importSummary.updatedCount)}
                    helper="Existing rows refreshed."
                  />
                  <SummaryMetric
                    label="Failed"
                    value={String(importSummary.failedCount)}
                    helper="Rows that did not complete."
                  />
                  <SummaryMetric
                    label="Players created"
                    value={String(importSummary.createdPlayersCount)}
                    helper="New player records inserted."
                  />
                  <SummaryMetric
                    label="Players linked"
                    value={String(importSummary.linkedPlayersCount)}
                    helper="match_players rows written."
                  />
                </div>

                <div
                  style={{
                    marginTop: 16,
                    borderRadius: 20,
                    border: '1px solid rgba(116,190,255,0.10)',
                    background: 'rgba(8,15,28,0.72)',
                    padding: '14px',
                    maxHeight: 360,
                    overflow: 'auto',
                  }}
                >
                  <pre
                    style={{
                      margin: 0,
                      color: '#D8E8FB',
                      fontSize: '0.8rem',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {importMessages.length > 0
                      ? importMessages.join('\n')
                      : importSummary.successCount === 0 &&
                          importSummary.updatedCount === 0 &&
                          importSummary.failedCount === 0
                        ? '⚠️ No rows imported. This scorecard was already completed and was skipped as a duplicate.'
                        : 'No row-level messages returned.'}
                  </pre>
                </div>
              </>
            )}
          </div>
        </section>
        </section>
      </AdminGate>
    </SiteShell>
  )
}

function inferImportTypeFromFileName(fileName: string): ImportKind | null {
  const normalized = fileName.toLowerCase()

  if (normalized.includes('scorecard')) return 'scorecard'
  if (normalized.includes('schedule')) return 'schedule'
  return null
}

function inferImportTypeFromPayload(payload: unknown): ImportKind | null {
  if (!payload || typeof payload !== 'object') return null

  const record = payload as Record<string, unknown>
  const pageType = cleanString(record.pageType).toLowerCase()

  if (pageType.includes('scorecard')) return 'scorecard'
  if (pageType.includes('schedule')) return 'schedule'

  if ('scorecard' in record) return 'scorecard'
  if ('seasonSchedule' in record) return 'schedule'

  return null
}

function parseReviewFilter(value: string | null): ReviewFilterMode {
  if (value === 'needs_review' || value === 'unresolved') return 'needs_review'
  if (value === 'ready') return 'ready'
  if (value === 'blocked') return 'blocked'
  return 'all'
}
