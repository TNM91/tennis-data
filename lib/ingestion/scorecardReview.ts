import type {
  MatchSide,
  MatchType,
  ScorecardImportRow,
  ScorecardLineImportRow,
} from './importEngine'

export type ScoreEventType = 'standard' | 'third_set_match_tiebreak' | 'timed_match'
export type WinnerSource =
  | 'dom_marker'
  | 'winner_column'
  | 'set_math'
  | 'inferred_missing_third_set'
  | 'unknown'

export type EvidenceClass = 'locked' | 'inferred' | 'unresolved' | 'conflict_candidate'
export type PreviewStatus = 'clean' | 'repaired' | 'needs_review' | 'blocked'
export type CommitSelectionMode = 'clean_only' | 'approved_items'

export type ReviewIssueCode =
  | 'TEAM_TOTAL_MISMATCH'
  | 'UNRESOLVED_WINNER'
  | 'MISSING_DECIDING_SET'
  | 'TIMED_MATCH_AMBIGUOUS'
  | 'INVALID_SET_SEQUENCE'
  | 'MISSING_REQUIRED_FIELD'
  | 'PLAYER_TEAM_MISMATCH'
  | 'DATA_CONFLICT'

export type ReviewIssue = {
  code: ReviewIssueCode
  severity: 'info' | 'warning' | 'error'
  message: string
}

export type SuggestedFix = {
  code: string
  label: string
  description: string
  autoApplied: boolean
}

export type RepairLogEntry = {
  code: string
  label: string
  description: string
  autoApplied: boolean
}

export type ReviewDecision =
  | 'accept_parser_result'
  | 'accept_suggested_repair'
  | 'needs_review_later'
  | 'exclude_from_commit'
  | 'approve_with_overrides'

export type LineWinnerSide = 'home' | 'away' | null

export type ScorecardLineOverride = {
  winnerSide?: MatchSide | null
  scoreEventType?: ScoreEventType
  timedMatch?: boolean
  hasThirdSetMatchTiebreak?: boolean
  scoreTextCorrection?: string
  adminNote?: string
}

export type ScorecardMatchReviewOverride = {
  decision?: ReviewDecision
  reviewerNote?: string
  reviewedBy?: string
  reviewedAt?: string
  lineOverrides?: Record<string, ScorecardLineOverride>
}

export type ReviewedScorecardLine = ScorecardLineImportRow & {
  rawScoreText?: string | null
  visibleSetScores?: string[]
  explicitWinnerMarker?: string | null
  explicitWinnerSide?: MatchSide | null
  winnerColumnSide?: MatchSide | null
  captureConfidence: number
  winnerSource: WinnerSource
  scoreEventType: ScoreEventType
  timedMatch: boolean
  hasThirdSetMatchTiebreak: boolean
  parseNotes: string[]
  isLocked: boolean
  evidenceClass: EvidenceClass
}

export type ReviewedScorecardRow = ScorecardImportRow & {
  lines: ReviewedScorecardLine[]
  totalTeamScore?: { home: number | null; away: number | null } | null
  captureEngine?: {
    version: string
    captureQuality: number
    diagnostics: string[]
  } | null
  dataConflict: boolean
  conflictType: string | null
  needsReview: boolean
  reviewStatus?: PreviewStatus
  raw_capture_json?: unknown
  validated_capture_json?: unknown
  repair_log?: RepairLogEntry[]
  reviewer_note?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
}

export type ScorecardPreviewModel = {
  externalMatchId: string
  status: PreviewStatus
  confidenceScore: number
  issues: ReviewIssue[]
  suggestedFixes: SuggestedFix[]
  repairLog: RepairLogEntry[]
  diagnostics: string[]
  parserNotes: string[]
  officialTeamTotal: { home: number | null; away: number | null }
  derivedTeamTotal: { home: number; away: number; unresolved: number }
  finalPreview: ReviewedScorecardRow
  rawCapture: ScorecardImportRow
  reviewDecision: ReviewDecision
  commitEligible: boolean
  blocked: boolean
}

type SetScore = {
  homeGames: number | null
  awayGames: number | null
  isMatchTiebreak?: boolean
  isTimed?: boolean
}

type InferenceResult = {
  lines: ReviewedScorecardLine[]
  repairs: RepairLogEntry[]
  diagnostics: string[]
}

function cleanString(value: unknown): string {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function nullableString(value: unknown): string | null {
  const cleaned = cleanString(value)
  return cleaned ? cleaned : null
}

function clampConfidence(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Number(Math.max(0, Math.min(1, numeric)).toFixed(2))
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const cleaned = cleanString(value)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(cleaned)
  }
  return result
}

function normalizeWinnerSource(value: unknown): WinnerSource {
  const normalized = cleanString(value).toLowerCase()
  if (normalized === 'dom_marker') return 'dom_marker'
  if (normalized === 'winner_column') return 'winner_column'
  if (normalized === 'set_math') return 'set_math'
  if (normalized === 'inferred_missing_third_set') return 'inferred_missing_third_set'
  return 'unknown'
}

function normalizeScoreEventType(value: unknown, timedMatch: boolean, hasThirdSetMatchTiebreak: boolean): ScoreEventType {
  const normalized = cleanString(value).toLowerCase()
  if (normalized === 'timed_match' || timedMatch) return 'timed_match'
  if (normalized === 'third_set_match_tiebreak' || hasThirdSetMatchTiebreak) {
    return 'third_set_match_tiebreak'
  }
  return 'standard'
}

function normalizeMatchSide(value: unknown): MatchSide | null {
  const normalized = cleanString(value).toUpperCase()
  if (normalized === 'A' || normalized === 'HOME') return 'A'
  if (normalized === 'B' || normalized === 'AWAY') return 'B'
  return null
}

function normalizeOfficialScore(value: unknown): { home: number | null; away: number | null } {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return {
      home: toNullableNumber(record.home),
      away: toNullableNumber(record.away),
    }
  }

  const text = cleanString(value)
  const match = text.match(/(\d+(?:\.\d+)?)\s*[-:]\s*(\d+(?:\.\d+)?)/)
  if (!match) {
    return { home: null, away: null }
  }

  return {
    home: Number(match[1]),
    away: Number(match[2]),
  }
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = cleanString(value)
  if (!text) return null
  const numeric = Number(text)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeVisibleSets(line: ScorecardLineImportRow & Record<string, unknown>): SetScore[] {
  const rawSets = Array.isArray(line.sets) ? line.sets : []
  const normalized: SetScore[] = []

  for (const entry of rawSets) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    normalized.push({
      homeGames: toNullableNumber(record.homeGames ?? record.home_games),
      awayGames: toNullableNumber(record.awayGames ?? record.away_games),
      isMatchTiebreak: Boolean(record.isMatchTiebreak ?? record.is_match_tiebreak),
      isTimed: Boolean(record.isTimed ?? record.is_timed),
    })
  }

  return normalized
}

function determineWinnerFromSets(sets: SetScore[]): MatchSide | null {
  let sideAWins = 0
  let sideBWins = 0

  for (const set of sets) {
    if (set.homeGames === null || set.awayGames === null) return null
    if (set.homeGames === set.awayGames) return null
    if (set.homeGames > set.awayGames) sideAWins += 1
    if (set.awayGames > set.homeGames) sideBWins += 1
  }

  if (sideAWins > sideBWins) return 'A'
  if (sideBWins > sideAWins) return 'B'
  return null
}

function areSplitOpeningSets(sets: SetScore[]): boolean {
  if (sets.length !== 2) return false
  const first = sets[0]
  const second = sets[1]
  if (!first || !second) return false
  if (first.homeGames === null || first.awayGames === null) return false
  if (second.homeGames === null || second.awayGames === null) return false
  const firstWinner = first.homeGames > first.awayGames ? 'A' : first.awayGames > first.homeGames ? 'B' : null
  const secondWinner = second.homeGames > second.awayGames ? 'A' : second.awayGames > second.homeGames ? 'B' : null
  return Boolean(firstWinner && secondWinner && firstWinner !== secondWinner)
}

export function isCleanStraightSetWin(line: ScorecardLineImportRow & Record<string, unknown>): boolean {
  const sets = normalizeVisibleSets(line)
  if (sets.length !== 2) return false
  if (Boolean(line.timedMatch)) return false
  if (Boolean(line.explicitWinnerSide) && Boolean(line.setWinnerSide) && line.explicitWinnerSide !== line.setWinnerSide) {
    return false
  }

  const setWinner = determineWinnerFromSets(sets)
  return Boolean(setWinner && !areSplitOpeningSets(sets))
}

function lineHasExplicitWinner(line: ScorecardLineImportRow & Record<string, unknown>): boolean {
  return Boolean(
    normalizeMatchSide(line.explicitWinnerSide) ??
      normalizeMatchSide(line.markerWinnerSide) ??
      normalizeMatchSide(line.textWinnerSide) ??
      normalizeMatchSide(line.winnerColumnSide),
  )
}

function normalizeLine(line: ScorecardLineImportRow): ReviewedScorecardLine {
  const lineRecord = line as ScorecardLineImportRow & Record<string, unknown>
  const timedMatch = Boolean(lineRecord.timedMatch)
  const hasThirdSetMatchTiebreak = Boolean(lineRecord.hasThirdSetMatchTiebreak)
  const scoreEventType = normalizeScoreEventType(
    lineRecord.scoreEventType,
    timedMatch,
    hasThirdSetMatchTiebreak,
  )
  const explicitWinnerSide =
    normalizeMatchSide(lineRecord.explicitWinnerSide) ??
    normalizeMatchSide(lineRecord.markerWinnerSide)
  const winnerColumnSide =
    normalizeMatchSide(lineRecord.winnerColumnSide) ??
    normalizeMatchSide(lineRecord.textWinnerSide)
  const computedSetWinner = determineWinnerFromSets(normalizeVisibleSets(lineRecord))
  const winnerSide = normalizeMatchSide(line.winnerSide)
  const winnerSource = normalizeWinnerSource(lineRecord.winnerSource)
  const baseNotes = uniqueStrings((lineRecord.parseNotes as string[] | undefined) ?? [])
  const locked =
    Boolean(lineRecord.isLocked) ||
    Boolean(explicitWinnerSide) ||
    Boolean(winnerColumnSide) ||
    (isCleanStraightSetWin(lineRecord) && winnerSide !== null && !timedMatch)

  let evidenceClass: EvidenceClass = 'unresolved'
  if (locked && winnerSide) evidenceClass = 'locked'
  else if (winnerSource === 'inferred_missing_third_set' && winnerSide) evidenceClass = 'inferred'
  else if (winnerSide) evidenceClass = 'conflict_candidate'

  const captureConfidence = clampConfidence(
    lineRecord.captureConfidence,
    winnerSource === 'dom_marker' || winnerSource === 'winner_column'
      ? 0.95
      : winnerSource === 'set_math'
        ? 0.82
        : winnerSource === 'inferred_missing_third_set'
          ? 0.68
          : winnerSide
            ? 0.45
            : 0.3,
  )

  const parseNotes = uniqueStrings([
    ...baseNotes,
    locked ? 'line classified as locked' : null,
    !winnerSide ? 'winner unresolved' : null,
    timedMatch ? 'timed match detected' : null,
    hasThirdSetMatchTiebreak ? 'third-set match tiebreak detected' : null,
  ])

  return {
    ...line,
    winnerSide,
    rawScoreText: nullableString(lineRecord.rawScoreText ?? line.score),
    visibleSetScores: Array.isArray(lineRecord.visibleSetScores)
      ? uniqueStrings(lineRecord.visibleSetScores as string[])
      : [],
    explicitWinnerMarker: nullableString(lineRecord.explicitWinnerMarker),
    explicitWinnerSide,
    winnerColumnSide,
    captureConfidence,
    winnerSource,
    scoreEventType,
    timedMatch,
    hasThirdSetMatchTiebreak,
    parseNotes,
    isLocked: locked,
    evidenceClass,
  }
}

function deriveLineTotals(lines: ReviewedScorecardLine[]): { home: number; away: number; unresolved: number } {
  return lines.reduce(
    (acc, line) => {
      if (line.winnerSide === 'A') acc.home += 1
      else if (line.winnerSide === 'B') acc.away += 1
      else acc.unresolved += 1
      return acc
    },
    { home: 0, away: 0, unresolved: 0 },
  )
}

function reviewIssue(
  code: ReviewIssueCode,
  severity: 'info' | 'warning' | 'error',
  message: string,
): ReviewIssue {
  return { code, severity, message }
}

function repairEntry(code: string, label: string, description: string, autoApplied = true): RepairLogEntry {
  return {
    code,
    label,
    description,
    autoApplied,
  }
}

function applySafeInference(
  lines: ReviewedScorecardLine[],
  official: { home: number | null; away: number | null },
): InferenceResult {
  const nextLines = lines.map((line) => ({
    ...line,
    parseNotes: [...line.parseNotes],
  }))
  const diagnostics: string[] = []
  const repairs: RepairLogEntry[] = []

  if (official.home === null || official.away === null) {
    return { lines: nextLines, diagnostics, repairs }
  }

  const eligible = nextLines.filter((line) => {
    if (line.isLocked) return false
    if (line.timedMatch) return false
    if (lineHasExplicitWinner(line)) return false
    const sets = normalizeVisibleSets(line)
    return line.winnerSide === null && areSplitOpeningSets(sets)
  })

  if (eligible.length !== 1) {
    return { lines: nextLines, diagnostics, repairs }
  }

  const counts = deriveLineTotals(nextLines)
  const missingHome = official.home - counts.home
  const missingAway = official.away - counts.away
  if (missingHome < 0 || missingAway < 0) {
    return { lines: nextLines, diagnostics, repairs }
  }

  if (missingHome === 1 && missingAway === 0) {
    eligible[0].winnerSide = 'A'
  } else if (missingAway === 1 && missingHome === 0) {
    eligible[0].winnerSide = 'B'
  } else {
    return { lines: nextLines, diagnostics, repairs }
  }

  eligible[0].winnerSource = 'inferred_missing_third_set'
  eligible[0].captureConfidence = clampConfidence(eligible[0].captureConfidence, 0.68)
  eligible[0].scoreEventType = 'third_set_match_tiebreak'
  eligible[0].timedMatch = false
  eligible[0].hasThirdSetMatchTiebreak = true
  eligible[0].evidenceClass = 'inferred'
  eligible[0].parseNotes = uniqueStrings([
    ...eligible[0].parseNotes,
    'missing deciding set inferred from official team total',
    'implicit third-set match tiebreak winner assigned',
  ])

  diagnostics.push(
    `Safely inferred a missing deciding-set winner on line ${eligible[0].lineNumber} from the official team total without changing any locked lines.`,
  )
  repairs.push(
    repairEntry(
      'INFER_MISSING_THIRD_SET',
      'Infer missing deciding set',
      `Assigned line ${eligible[0].lineNumber} as a third-set match tiebreak winner using the official team total.`,
    ),
  )

  return { lines: nextLines, diagnostics, repairs }
}

function classifyStatus(issues: ReviewIssue[], repairLog: RepairLogEntry[]): PreviewStatus {
  if (issues.some((issue) => issue.code === 'MISSING_REQUIRED_FIELD' && issue.severity === 'error')) {
    return 'blocked'
  }
  if (issues.some((issue) => issue.severity === 'error')) return 'needs_review'
  if (issues.some((issue) => issue.severity === 'warning')) return 'needs_review'
  if (repairLog.length > 0) return 'repaired'
  return 'clean'
}

export function applyScorecardReviewOverride(
  row: ReviewedScorecardRow,
  override?: ScorecardMatchReviewOverride,
): ReviewedScorecardRow {
  if (!override) return row

  const lineOverrides = override.lineOverrides ?? {}
  const nextLines = row.lines.map((line) => {
    const lineOverride = lineOverrides[String(line.lineNumber)]
    if (!lineOverride) return line

    const nextWinnerSide =
      lineOverride.winnerSide === undefined ? line.winnerSide : lineOverride.winnerSide
    const nextTimedMatch =
      typeof lineOverride.timedMatch === 'boolean' ? lineOverride.timedMatch : line.timedMatch
    const nextHasThirdSet =
      typeof lineOverride.hasThirdSetMatchTiebreak === 'boolean'
        ? lineOverride.hasThirdSetMatchTiebreak
        : line.hasThirdSetMatchTiebreak
    const nextScoreEventType =
      lineOverride.scoreEventType ??
      normalizeScoreEventType(undefined, Boolean(nextTimedMatch), Boolean(nextHasThirdSet))

    return {
      ...line,
      winnerSide: nextWinnerSide,
      timedMatch: nextTimedMatch,
      hasThirdSetMatchTiebreak: nextHasThirdSet,
      scoreEventType: nextScoreEventType,
      rawScoreText: nullableString(lineOverride.scoreTextCorrection) ?? line.rawScoreText,
      score: nullableString(lineOverride.scoreTextCorrection) ?? line.score,
      parseNotes: uniqueStrings([
        ...(line.parseNotes ?? []),
        lineOverride.scoreTextCorrection ? 'admin score text correction applied' : null,
        lineOverride.adminNote ? `admin note: ${lineOverride.adminNote}` : null,
        lineOverride.winnerSide !== undefined ? 'admin override applied to line winner' : null,
      ]),
      winnerSource:
        lineOverride.winnerSide !== undefined
          ? line.winnerSource === 'unknown'
            ? 'unknown'
            : line.winnerSource
          : line.winnerSource,
    }
  })

  return {
    ...row,
    lines: nextLines as ReviewedScorecardLine[],
    reviewer_note: nullableString(override.reviewerNote),
    reviewed_by: nullableString(override.reviewedBy),
    reviewed_at: nullableString(override.reviewedAt),
  }
}

export function buildScorecardPreviewModel(
  row: ScorecardImportRow,
  override?: ScorecardMatchReviewOverride,
): ScorecardPreviewModel {
  const rawCapture = structuredClone(row) as ScorecardImportRow
  const rowRecord = row as ScorecardImportRow & Record<string, unknown>
  const existingCaptureEngine =
    rowRecord.captureEngine && typeof rowRecord.captureEngine === 'object'
      ? (rowRecord.captureEngine as { version?: unknown; captureQuality?: unknown; diagnostics?: unknown })
      : null
  const issues: ReviewIssue[] = []
  const suggestedFixes: SuggestedFix[] = []
  const diagnostics: string[] = []
  const parserNotes: string[] = []
  const repairLog: RepairLogEntry[] = []

  if (!cleanString(row.externalMatchId)) {
    issues.push(reviewIssue('MISSING_REQUIRED_FIELD', 'error', 'Missing matchId or externalMatchId.'))
  }
  if (!cleanString(row.homeTeam) || !cleanString(row.awayTeam)) {
    issues.push(reviewIssue('MISSING_REQUIRED_FIELD', 'error', 'Missing required home/away team structure.'))
  }
  if (!Array.isArray(row.lines) || row.lines.length === 0) {
    issues.push(reviewIssue('MISSING_REQUIRED_FIELD', 'error', 'No scorecard lines were captured for this match.'))
  }

  let reviewedLines = (row.lines ?? []).map(normalizeLine)
  const officialTeamTotal = normalizeOfficialScore((row as Record<string, unknown>).totalTeamScore)

  const inference = applySafeInference(reviewedLines, officialTeamTotal)
  reviewedLines = inference.lines
  repairLog.push(...inference.repairs)
  diagnostics.push(...inference.diagnostics)

  const derivedTeamTotal = deriveLineTotals(reviewedLines)
  const unresolvedLines = reviewedLines.filter((line) => line.winnerSide === null)
  const timedAmbiguous = reviewedLines.filter((line) => line.timedMatch && line.winnerSide === null)
  const malformedSetLines = reviewedLines.filter((line) => {
    const sets = normalizeVisibleSets(line)
    return sets.some((set) => set.homeGames === null || set.awayGames === null)
  })

  if (reviewedLines.some((line) => line.parseNotes.some((note) => note.toLowerCase().includes('missing deciding set')))) {
    suggestedFixes.push({
      code: 'SAFE_DECIDING_SET_INFERENCE',
      label: 'Safe deciding-set inference',
      description: 'A missing deciding set was safely inferred from the official team total.',
      autoApplied: true,
    })
  }

  if (repairLog.length > 0) {
    parserNotes.push(...repairLog.map((entry) => entry.description))
  }

  if (unresolvedLines.length > 0) {
    issues.push(
      reviewIssue(
        'UNRESOLVED_WINNER',
        unresolvedLines.length > 1 ? 'error' : 'warning',
        unresolvedLines.length > 1
          ? `${unresolvedLines.length} line winners remain unresolved.`
          : `Line ${unresolvedLines[0].lineNumber} remains unresolved.`,
      ),
    )
  }

  if (timedAmbiguous.length > 0) {
    issues.push(
      reviewIssue(
        'TIMED_MATCH_AMBIGUOUS',
        'warning',
        `Timed-match winner is ambiguous on line${timedAmbiguous.length > 1 ? 's' : ''} ${timedAmbiguous.map((line) => line.lineNumber).join(', ')}.`,
      ),
    )
  }

  if (malformedSetLines.length > 0) {
    issues.push(
      reviewIssue(
        'INVALID_SET_SEQUENCE',
        'warning',
        `Malformed or suspicious set data was captured on line${malformedSetLines.length > 1 ? 's' : ''} ${malformedSetLines.map((line) => line.lineNumber).join(', ')}.`,
      ),
    )
  }

  const dataConflict =
    officialTeamTotal.home !== null &&
    officialTeamTotal.away !== null &&
    (derivedTeamTotal.home !== officialTeamTotal.home || derivedTeamTotal.away !== officialTeamTotal.away)

  if (dataConflict) {
    issues.push(
      reviewIssue(
        'TEAM_TOTAL_MISMATCH',
        'warning',
        `Derived line total ${derivedTeamTotal.home}-${derivedTeamTotal.away} conflicts with official team total ${officialTeamTotal.home}-${officialTeamTotal.away}.`,
      ),
    )
    issues.push(
      reviewIssue(
        'DATA_CONFLICT',
        'warning',
        'Locked-confidence protection preserved high-confidence line evidence over the official team total.',
      ),
    )
    diagnostics.push(
      'Locked-confidence protection preserved high-confidence line evidence over official team total.',
    )
  }

  if (reviewedLines.some((line) => !line.sideAPlayers.length || !line.sideBPlayers.length)) {
    issues.push(
      reviewIssue(
        'PLAYER_TEAM_MISMATCH',
        'warning',
        'One or more lines are missing player names on one side.',
      ),
    )
  }

  let finalPreview: ReviewedScorecardRow = {
    ...row,
    lines: reviewedLines,
    totalTeamScore: officialTeamTotal,
    captureEngine: {
      version: cleanString(existingCaptureEngine?.version) || 'app-review-v1',
      captureQuality: clampConfidence(existingCaptureEngine?.captureQuality, reviewedLines.length
        ? reviewedLines.reduce((sum, line) => sum + line.captureConfidence, 0) / reviewedLines.length
        : 0),
      diagnostics: uniqueStrings([
        ...(((existingCaptureEngine?.diagnostics as string[] | undefined) ?? [])),
        ...diagnostics,
      ]),
    },
    dataConflict,
    conflictType: dataConflict ? 'team_total_mismatch' : null,
    needsReview: issues.some((issue) => issue.severity !== 'info'),
    repair_log: repairLog,
    raw_capture_json: rawCapture,
  }

  finalPreview = applyScorecardReviewOverride(finalPreview, override)
  finalPreview.validated_capture_json = finalPreview

  const confidenceScore = reviewedLines.length
    ? Number(
        (
          reviewedLines.reduce((sum, line) => sum + line.captureConfidence, 0) / reviewedLines.length
        ).toFixed(2),
      )
    : 0

  const reviewDecision = override?.decision ?? 'needs_review_later'
  const status = classifyStatus(issues, repairLog)
  const blocked = status === 'blocked'
  const commitEligible =
    !blocked &&
    (status === 'clean' || status === 'repaired' || reviewDecision === 'accept_parser_result' || reviewDecision === 'accept_suggested_repair' || reviewDecision === 'approve_with_overrides')

  finalPreview.reviewStatus = status

  return {
    externalMatchId: cleanString(row.externalMatchId),
    status,
    confidenceScore,
    issues,
    suggestedFixes,
    repairLog,
    diagnostics: uniqueStrings(diagnostics),
    parserNotes: uniqueStrings([
      ...parserNotes,
      ...finalPreview.lines.flatMap((line) => line.parseNotes),
    ]),
    officialTeamTotal,
    derivedTeamTotal,
    finalPreview,
    rawCapture,
    reviewDecision,
    commitEligible,
    blocked,
  }
}

export function buildScorecardPreviewModels(
  rows: ScorecardImportRow[],
  overrides: Record<string, ScorecardMatchReviewOverride> = {},
): ScorecardPreviewModel[] {
  return rows.map((row) =>
    buildScorecardPreviewModel(row, overrides[cleanString(row.externalMatchId)]),
  )
}

export function buildScorecardCommitRows(
  previews: ScorecardPreviewModel[],
  mode: CommitSelectionMode,
): ReviewedScorecardRow[] {
  if (mode === 'clean_only') {
    return previews
      .filter((preview) => !preview.blocked)
      .filter((preview) => preview.status === 'clean' || preview.status === 'repaired')
      .map((preview) => preview.finalPreview)
  }

  return previews
    .filter((preview) => !preview.blocked)
    .filter((preview) => preview.commitEligible)
    .filter((preview) => preview.reviewDecision !== 'exclude_from_commit')
    .map((preview) => preview.finalPreview)
}
