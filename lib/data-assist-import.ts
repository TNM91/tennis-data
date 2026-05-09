import type { DataAssistScorecardParsedDraft, DataAssistScorecardParsedLine } from './data-assist-ocr'
import type { MatchSide, MatchType, ScorecardImportRow } from './ingestion/importEngine'

export type DataAssistImportPlayerMapping = {
  name: string
  status: 'exact' | 'likely' | 'unknown'
  matchedPlayerId: string
  matchedPlayerName: string
  matchConfidence?: number
  matchReason?: string
}

export type DataAssistImportPreview = {
  row: ScorecardImportRow
  unresolvedWinnerCount: number
  playerMappings: DataAssistImportPlayerMapping[]
  duplicateMatch?: {
    externalMatchId: string
    status: string
    matchDate: string
    homeTeam: string
    awayTeam: string
  }
}

export function buildDataAssistScorecardImportRow(
  draft: DataAssistScorecardParsedDraft,
  options: {
    reviewedBy?: string
    reviewedAt?: string
    sourceBatchId?: string
  } = {},
): DataAssistImportPreview {
  const lines = draft.lines.map(toScorecardImportLine)
  const unresolvedWinnerCount = lines.filter((line) => !line.winnerSide).length
  const now = options.reviewedAt || new Date().toISOString()

  return {
    row: {
      externalMatchId: draft.externalMatchId,
      matchDate: draft.matchDate,
      homeTeam: draft.homeTeam,
      awayTeam: draft.awayTeam,
      lines,
      source: 'tennislink_scorecard_data_assist',
      totalTeamScore: summarizeTeamScore(lines),
      captureEngine: {
        version: `data-assist-${draft.provider}`,
        captureQuality: draft.confidenceScore,
        diagnostics: draft.parserWarnings,
      },
      needsReview: unresolvedWinnerCount > 0 || draft.parserWarnings.length > 0,
      reviewStatus: unresolvedWinnerCount > 0 ? 'needs_review' : 'clean',
      raw_capture_json: {
        source: 'data_assist',
        sourceBatchId: options.sourceBatchId,
        parsedDraft: draft,
      },
      reviewed_by: options.reviewedBy || 'Data Assist member confirmation',
      reviewed_at: now,
    },
    unresolvedWinnerCount,
    playerMappings: [],
  }
}

export function collectDataAssistImportPlayerNames(row: ScorecardImportRow) {
  return uniqueStrings(row.lines.flatMap((line) => [...line.sideAPlayers, ...line.sideBPlayers]))
}

export function applyDataAssistPlayerMappingsToRow(
  row: ScorecardImportRow,
  mappings: DataAssistImportPlayerMapping[],
): ScorecardImportRow {
  const canonicalNameByKey = new Map(
    mappings
      .filter((mapping) => mapping.status === 'exact' || mapping.status === 'likely')
      .filter((mapping) => mapping.matchedPlayerName.trim())
      .map((mapping) => [normalizeName(mapping.name), mapping.matchedPlayerName.trim()] as const),
  )

  if (!canonicalNameByKey.size) return row

  return {
    ...row,
    lines: row.lines.map((line) => ({
      ...line,
      sideAPlayers: line.sideAPlayers.map((name) => canonicalNameByKey.get(normalizeName(name)) || name),
      sideBPlayers: line.sideBPlayers.map((name) => canonicalNameByKey.get(normalizeName(name)) || name),
    })),
  }
}

function toScorecardImportLine(line: DataAssistScorecardParsedLine, index: number) {
  const lineMeta = parseLineLabel(line.lineLabel, index)
  const winnerSource = line.winner === 'unknown' ? 'unknown' : line.winnerSource || 'set_math'
  const parseNotes = line.winner === 'unknown'
    ? uniqueStrings([...(line.parseNotes || []), 'Winner could not be determined from OCR.'])
    : line.parseNotes || []
  return {
    lineNumber: lineMeta.lineNumber,
    matchType: lineMeta.matchType,
    sideAPlayers: line.homePlayers,
    sideBPlayers: line.awayPlayers,
    winnerSide: toWinnerSide(line.winner),
    score: line.score || null,
    rawScoreText: line.score || null,
    captureConfidence: line.confidenceScore,
    winnerSource,
    scoreEventType: line.scoreEventType || 'standard',
    parseNotes,
  } satisfies ScorecardImportRow['lines'][number]
}

function parseLineLabel(value: string, index: number): { lineNumber: number; matchType: MatchType } {
  const normalized = value.toLowerCase()
  const lineNumber = Number.parseInt(normalized, 10)
  return {
    lineNumber: Number.isFinite(lineNumber) ? lineNumber : index + 1,
    matchType: normalized.includes('double') || normalized.includes('d') ? 'doubles' : 'singles',
  }
}

function toWinnerSide(value: string): MatchSide | null {
  if (value === 'home') return 'A'
  if (value === 'away') return 'B'
  return null
}

function summarizeTeamScore(lines: ScorecardImportRow['lines']) {
  let home = 0
  let away = 0
  for (const line of lines) {
    if (line.winnerSide === 'A') home += 1
    if (line.winnerSide === 'B') away += 1
  }
  return { home, away }
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const cleaned = value.trim()
    const key = cleaned.toLowerCase()
    if (!cleaned || seen.has(key)) continue
    seen.add(key)
    result.push(cleaned)
  }
  return result
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
