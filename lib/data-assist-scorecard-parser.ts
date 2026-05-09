import type { DataAssistScorecardParsedDraft, DataAssistScorecardParsedLine } from './data-assist-ocr'

export type DataAssistScorecardParseResult = DataAssistScorecardParsedDraft & {
  confidenceScore: number
}

type ScorecardSet = NonNullable<DataAssistScorecardParsedLine['sets']>[number]

const SCORE_PATTERN = /\b\d{1,2}\s*-\s*\d{1,2}(?:\s*\(\s*\d{1,2}\s*\))?/g
const DATE_PATTERN = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Z][a-z]{2,9}\s+\d{1,2},?\s+\d{4})\b/
const MATCH_ID_PATTERN = /\b(?:match\s*(?:id|number|#)?|scorecard\s*(?:id|#)|tennislink\s+match)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,})\b/i
const LINE_START_PATTERN = /^(?:(?:court|line)\s*)?([1-5]\s*#?\s*(?:singles|doubles|s|d)|\d+\s*#?\s*(?:singles|doubles)?)\b[:.\-\s]*/i
const TEAM_SEPARATOR_PATTERN = /\s+(?:vs\.?|v\.?|at|@)\s+/i
const RESULT_SEPARATOR_PATTERN = /\s+(def\.?|d\.?|defeated|bt\.?|beat|beats|over|lost\s+to)\s+/i

export function parseDataAssistScorecardText(rawText: string): DataAssistScorecardParseResult {
  const text = normalizeOcrText(rawText)
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const parserWarnings: string[] = []
  const matchId = extractMatchId(text)
  const matchDate = extractMatchDate(text)
  const teams = extractTeams(lines)
  const parsedLines = extractScorecardLines(lines)
  const fallbackLines = parsedLines.length ? dedupeScorecardLines(parsedLines) : extractVerticalTennisLinkLines(lines)

  if (!matchId) parserWarnings.push('Missing TennisLink match id.')
  if (!matchDate) parserWarnings.push('Missing match date.')
  if (!teams.homeTeam || !teams.awayTeam) parserWarnings.push('Missing home or away team.')
  if (!fallbackLines.length) parserWarnings.push('No scorecard lines parsed.')
  if (fallbackLines.some((line) => !line.homePlayers.length || !line.awayPlayers.length)) {
    parserWarnings.push('One or more lines are missing player names.')
  }
  if (fallbackLines.some((line) => !line.score)) {
    parserWarnings.push('One or more lines are missing scores.')
  }

  return {
    externalMatchId: matchId,
    homeTeam: teams.homeTeam,
    awayTeam: teams.awayTeam,
    matchDate,
    lineCount: fallbackLines.length,
    parserWarnings,
    lines: fallbackLines,
    rawTextPreview: text.slice(0, 1600),
    sourceScreenshotCount: 0,
    provider: 'manual_review',
    confidenceScore: calculateParseConfidence({
      matchId,
      matchDate,
      homeTeam: teams.homeTeam,
      awayTeam: teams.awayTeam,
      parsedLines: fallbackLines,
    }),
  }
}

export function normalizeOcrText(rawText: string) {
  return rawText
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractMatchId(text: string) {
  const tennisLinkScorecard = text.match(/\bScorecard\s+for\s+Match\s*#\s*([0-9]{5,})\b/i)?.[1]
  if (tennisLinkScorecard) return cleanToken(tennisLinkScorecard)

  const directMatch = text.match(MATCH_ID_PATTERN)?.[1]
  if (directMatch && /\d/.test(directMatch)) return cleanToken(directMatch)

  const fallback = text.match(/\b[A-Z]{2,5}-?\d{5,}\b/)?.[0]
  return fallback ? cleanToken(fallback) : ''
}

function extractMatchDate(text: string) {
  const tennisLinkPlayed = text.match(/\bDate\s+Match\s+Played\s*[:#-]?\s*([0-9\s/-]{6,12})/i)?.[1]
  const tennisLinkScheduled = text.match(/\bDate\s+Scheduled\s*[:#-]?\s*([0-9\s/-]{6,14})/i)?.[1]
  const labeled = text.match(/\b(?:match date|played|date)\s*[:#-]?\s*([A-Za-z0-9,/-]+(?:\s+\d{4})?)/i)?.[1]
  if (tennisLinkPlayed || tennisLinkScheduled) {
    return normalizeDateToken(tennisLinkPlayed || tennisLinkScheduled)
  }
  const match = labeled?.match(DATE_PATTERN)?.[0] || text.match(DATE_PATTERN)?.[0] || ''
  return cleanText(match)
}

function extractTeams(lines: string[]) {
  let homeTeam = ''
  let awayTeam = ''

  for (const line of lines) {
    const home = line.match(/\b(?:home team|home)\s*[:#-]\s*(.+)$/i)?.[1]
    const away = line.match(/\b(?:away team|away|visitor|visiting team)\s*[:#-]\s*(.+)$/i)?.[1]
    if (home && !homeTeam) homeTeam = cleanTeamName(home)
    if (away && !awayTeam) awayTeam = cleanTeamName(away)
  }

  if (homeTeam && awayTeam) return { homeTeam, awayTeam }

  const totalScoreTeams = extractTeamsFromTotalScore(lines)
  homeTeam ||= totalScoreTeams.homeTeam
  awayTeam ||= totalScoreTeams.awayTeam
  if (homeTeam && awayTeam) return { homeTeam, awayTeam }

  const matchupLine = lines.find((line) => TEAM_SEPARATOR_PATTERN.test(line) && !SCORE_PATTERN.test(line))
  if (matchupLine) {
    const [left, right] = matchupLine.split(TEAM_SEPARATOR_PATTERN)
    homeTeam ||= cleanTeamName(left)
    awayTeam ||= cleanTeamName(right)
  }

  return { homeTeam, awayTeam }
}

function extractTeamsFromTotalScore(lines: string[]) {
  let homeTeam = ''
  let awayTeam = ''
  const totalIndex = lines.findIndex((line) => /total team score/i.test(line))
  const candidates = totalIndex >= 0 ? lines.slice(totalIndex + 1, totalIndex + 8) : lines

  for (let index = 0; index < candidates.length; index += 1) {
    const line = candidates[index] || ''
    if (!homeTeam && /\bhome team\b/i.test(line)) {
      homeTeam = cleanTeamName(line.replace(/\(home team\).*$/i, ''))
    }
    if (!awayTeam && /\b(?:visiting|visting|visit|ng team)\b/i.test(line)) {
      const joined = [line, candidates[index + 1] || ''].join(' ')
      awayTeam = cleanTeamName(joined.replace(/\((?:visiting|visting).*$/i, ''))
    }
  }

  return { homeTeam, awayTeam }
}

function extractScorecardLines(lines: string[]): DataAssistScorecardParsedLine[] {
  const parsedLines: DataAssistScorecardParsedLine[] = []

  for (const rawLine of lines) {
    const scoreMatches = rawLine.match(SCORE_PATTERN)

    const lineMatch = rawLine.match(LINE_START_PATTERN)
    if (!lineMatch) continue
    if (!scoreMatches?.length && !TEAM_SEPARATOR_PATTERN.test(rawLine)) continue

    const score = scoreMatches?.map(normalizeScoreSet).join(' ') || ''
    const beforeScore = scoreMatches?.length
      ? rawLine.slice(0, rawLine.indexOf(scoreMatches[0])).trim()
      : rawLine.trim()
    const afterLineLabel = beforeScore.replace(LINE_START_PATTERN, '').trim()
    const resultParts = afterLineLabel.split(RESULT_SEPARATOR_PATTERN)
    if (resultParts.length < 3) {
      const tableLine = parseTennisLinkTableLine(lineMatch[1], afterLineLabel, score)
      if (tableLine) parsedLines.push(tableLine)
      continue
    }

    const resultVerb = resultParts[1]?.toLowerCase() || ''
    const leftPlayers = splitPlayers(resultParts[0])
    const rightPlayers = splitPlayers(resultParts.slice(2).join(' '))
    const winner = resultVerb.includes('lost') ? 'away' : 'home'

    parsedLines.push(withExtensionScoreMetadata({
      lineLabel: normalizeLineLabel(lineMatch[1]),
      homePlayers: leftPlayers,
      awayPlayers: rightPlayers,
      score,
      winner,
      confidenceScore: calculateLineConfidence(leftPlayers, rightPlayers, score),
    }))
  }

  return parsedLines
}

function dedupeScorecardLines(lines: DataAssistScorecardParsedLine[]) {
  const byLabel = new Map<string, DataAssistScorecardParsedLine>()

  for (const line of lines) {
    const current = byLabel.get(line.lineLabel)
    if (!current || scorecardLineQuality(line) > scorecardLineQuality(current)) {
      byLabel.set(line.lineLabel, line)
    }
  }

  return Array.from(byLabel.values()).map(sanitizeParsedLine)
}

function scorecardLineQuality(line: DataAssistScorecardParsedLine) {
  return (
    scoreSetCount(line.score) * 4 +
    line.homePlayers.length * 2 +
    line.awayPlayers.length * 2 +
    line.confidenceScore
  )
}

function scoreSetCount(score: string) {
  return score.match(SCORE_PATTERN)?.length ?? 0
}

function sanitizeParsedLine(line: DataAssistScorecardParsedLine): DataAssistScorecardParsedLine {
  const sets = extractSetPairsFromText(line.score)
  const hasImpossibleSet = sets.some((set) => !set.isMatchTiebreak && (set.homeGames > 7 || set.awayGames > 7))
  const hasIncompleteDoublesScore = /doubles/i.test(line.lineLabel) && sets.length < 2
  if (!hasImpossibleSet && !hasIncompleteDoublesScore) return line

  return {
    ...line,
    score: '',
    sets: [],
    setWinnerSide: null,
    confidenceScore: roundConfidence(line.confidenceScore - 0.25),
    parseNotes: uniqueStrings([...(line.parseNotes || []), 'score needs review']),
  }
}

function parseTennisLinkTableLine(lineLabel: string, value: string, score: string): DataAssistScorecardParsedLine | null {
  if (!TEAM_SEPARATOR_PATTERN.test(value)) return null

  const markerWinner = extractWinnerMarkerSide(value)
  const withoutStatus = value
    .replace(/\b(?:completed|defaulted|retired|walkover)\b/gi, ' ')
    .replace(/\bwinner\s+marker\s*:\s*(?:home|away)\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm|noon)?\b/gi, ' ')
    .replace(/\b\d{1,2}:?\d{0,2}\s*noon\b/gi, ' ')
    .replace(SCORE_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const [home, away] = withoutStatus.split(TEAM_SEPARATOR_PATTERN)
  const homePlayers = splitPlayers(home)
  const awayPlayers = splitPlayers(away)
  if (!homePlayers.length || !awayPlayers.length) return null

  return withExtensionScoreMetadata({
    lineLabel: normalizeLineLabel(lineLabel),
    homePlayers,
    awayPlayers,
    score,
    winner: markerWinner || 'unknown',
    winnerSource: markerWinner ? 'dom_marker' : 'unknown',
    confidenceScore: roundConfidence(calculateLineConfidence(homePlayers, awayPlayers, score) - 0.12),
  })
}

function extractWinnerMarkerSide(value: string): 'home' | 'away' | null {
  if (/\bimgHomePlayer\b/i.test(value)) return 'home'
  if (/\bimgVisitorPlayer\b/i.test(value)) return 'away'
  const marker = value.match(/\bwinner\s+marker\s*:\s*(home|away)\b/i)?.[1]?.toLowerCase()
  if (marker === 'home' || marker === 'away') return marker
  return null
}

function extractVerticalTennisLinkLines(lines: string[]): DataAssistScorecardParsedLine[] {
  const tableStart = lines.findIndex((line) => /^home team$/i.test(line))
  const tableEnd = lines.findIndex((line, index) => index > tableStart && /total team score/i.test(line))
  if (tableStart < 0 || tableEnd < 0) return []

  const tableLines = lines.slice(tableStart + 1, tableEnd)
  const lineIndexes = tableLines
    .map((line, index) => ({ line, index, label: normalizeVerticalLineLabel(line) }))
    .filter((item) => item.label)
  const parsedLines: DataAssistScorecardParsedLine[] = []

  for (let itemIndex = 0; itemIndex < lineIndexes.length; itemIndex += 1) {
    const item = lineIndexes[itemIndex]
    const next = lineIndexes[itemIndex + 1]?.index ?? tableLines.length
    const window = tableLines.slice(Math.max(0, item.index - 2), next)
    const currentLineOffset = Math.min(2, item.index)
    const beforeLabel = window.slice(0, currentLineOffset)
    const originalAfterLabel = window.slice(currentLineOffset + 1)
    const afterLabel = trimVerticalLineSegment(originalAfterLabel)
    const beforePlayers = pickPlayerNames(beforeLabel.slice(-1), 2)
    const homePlayers = beforePlayers.length
      ? beforePlayers
      : pickPlayerNames(afterLabel.slice(0, 3), 2)
    const awayStart = afterLabel.findIndex((line) => /^vs\.?$/i.test(line))
    const awaySegment = awayStart >= 0 ? afterLabel.slice(awayStart + 1) : afterLabel.slice(2)
    const awayPlayers = pickPlayerNames(takeUntilVerticalScore(awaySegment), 2)
    const score = extractVerticalScore(originalAfterLabel)
    if (!homePlayers.length && !awayPlayers.length && !score) continue

    parsedLines.push(withExtensionScoreMetadata({
      lineLabel: item.label,
      homePlayers,
      awayPlayers,
      score,
      winner: 'unknown',
      confidenceScore: roundConfidence(calculateLineConfidence(homePlayers, awayPlayers, score) - 0.18),
    }))
  }

  return parsedLines
}

function trimVerticalLineSegment(values: string[]) {
  const completedIndex = values.findIndex((value) => /^completed$/i.test(value))
  return completedIndex >= 0 ? values.slice(0, completedIndex + 1) : values
}

function takeUntilVerticalScore(values: string[]) {
  const scoreIndex = values.findIndex((value) => /^[0-7]{1,2}$/.test(value.replace(/[^0-9]/g, '')))
  return scoreIndex >= 0 ? values.slice(0, scoreIndex) : values
}

function normalizeVerticalLineLabel(value: string) {
  const clean = value.toLowerCase().replace(/[^a-z0-9# ]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (/^(?:1[#8]?|18)\s*singles$/.test(clean)) return '1 Singles'
  if (/^2[#8]?\s*singles$/.test(clean)) return '2 Singles'
  if (/^(?:1[#8]?|18)\s*(?:doubles|doues)$/.test(clean)) return '1 Doubles'
  if (/^(?:2[#6]?|26)\s*doubles$/.test(clean)) return '2 Doubles'
  if (/^3[#8]?\s*doubles$/.test(clean)) return '3 Doubles'
  return ''
}

function pickPlayerNames(values: string[], limit: number) {
  return values
    .map(cleanPlayerName)
    .filter((value) => value && isLikelyPlayerName(value))
    .slice(0, limit)
}

function isLikelyPlayerName(value: string) {
  if (/^(?:vs\.?|completed|home team|visiting team|team id|set tie-break|.*set tie-break.*)$/i.test(value)) return false
  if (/\b(?:am|pm|noon)\b/i.test(value)) return false
  if (/^\d+$/.test(value.replace(/\s+/g, ''))) return false
  if (!/\s/.test(value) && value.length <= 4) return false
  return /[A-Za-z]{3,}/.test(value)
}

function extractVerticalScore(values: string[]) {
  const compactScores = values
    .map((value) => value.replace(/[^0-9]/g, ''))
    .filter((value) => /^[0-7]{2}$/.test(value))
    .slice(0, 3)
    .map((value) => normalizeVerticalScoreToken(value))
  return compactScores.join(' ')
}

function normalizeVerticalScoreToken(value: string) {
  const first = value[0] === '5' && Number(value[1]) <= 4 ? '6' : value[0]
  return `${first}-${value[1]}`
}

function withExtensionScoreMetadata(line: DataAssistScorecardParsedLine): DataAssistScorecardParsedLine {
  const sets = extractSetPairsFromText(line.score)
  const score = formatSetsAsScore(sets) || line.score
  const setWinnerSide = determineWinnerSideFromSets(sets)
  const scoreEventType = classifyScoreEventType(score, sets)
  const parseNotes = buildLineParseNotes(line, sets, scoreEventType)

  return {
    ...line,
    score,
    sets,
    setWinnerSide,
    scoreEventType,
    parseNotes,
  }
}

function extractSetPairsFromText(value: string): ScorecardSet[] {
  const rawSets = cleanText(value).match(/\d{1,2}\s*[-–]\s*\d{1,2}(?:\s*[\[(]\s*\d{1,3}\s*[\])])?/g) || []
  return filterMeaningfulSets(rawSets.map((rawSet) => {
    const match = rawSet.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/)
    if (!match) return null
    const homeGames = Number(match[1])
    const awayGames = Number(match[2])
    const tiebreak = extractTiebreakValue(rawSet)
    return {
      homeGames,
      awayGames,
      ...(tiebreak !== null ? { tiebreak } : {}),
      ...(looksLikeMatchTiebreakSet(homeGames, awayGames, value) ? { isMatchTiebreak: true } : {}),
    }
  }).filter(Boolean) as ScorecardSet[])
}

function filterMeaningfulSets(sets: ScorecardSet[]): ScorecardSet[] {
  const nonZeroSets = sets.filter((set) => set.homeGames !== 0 || set.awayGames !== 0)
  const tinySets = nonZeroSets.filter((set) =>
    (set.homeGames === 1 && set.awayGames === 0) || (set.homeGames === 0 && set.awayGames === 1)
  )
  const fullSets = nonZeroSets.filter((set) =>
    !((set.homeGames === 1 && set.awayGames === 0) || (set.homeGames === 0 && set.awayGames === 1))
  )
  if (fullSets.length >= 2 && tinySets.length) return [...fullSets, tinySets[0]]
  return fullSets
}

function determineWinnerSideFromSets(sets: ScorecardSet[]): 'home' | 'away' | null {
  let homeWins = 0
  let awayWins = 0
  for (const set of sets) {
    if (set.homeGames > set.awayGames) homeWins += 1
    if (set.awayGames > set.homeGames) awayWins += 1
  }
  if (homeWins > awayWins) return 'home'
  if (awayWins > homeWins) return 'away'
  return null
}

function formatSetsAsScore(sets: ScorecardSet[]) {
  return sets
    .map((set) => {
      const base = `${set.homeGames}-${set.awayGames}`
      return set.tiebreak !== undefined ? `${base}(${set.tiebreak})` : base
    })
    .join(' ')
}

function extractTiebreakValue(value: string) {
  const match = cleanText(value).match(/\((\d{1,3})\)|\[(\d{1,3})]/)
  return match ? Number(match[1] || match[2]) : null
}

function classifyScoreEventType(
  rawScoreText: string,
  sets: ScorecardSet[],
): NonNullable<DataAssistScorecardParsedLine['scoreEventType']> {
  const lowerScore = rawScoreText.toLowerCase()
  if (/timed|time limit|ad scoring|pro set/.test(lowerScore)) return 'timed_match'
  if (
    sets.some((set) => set.isMatchTiebreak) ||
    /3rd set tie-break|third set tiebreak|third set tie-break|match tiebreak|match tb/.test(lowerScore)
  ) {
    return 'third_set_match_tiebreak'
  }
  return 'standard'
}

function looksLikeMatchTiebreakSet(homeGames: number, awayGames: number, sourceText = '') {
  if ((homeGames === 1 && awayGames === 0) || (homeGames === 0 && awayGames === 1)) return true
  if (Math.max(homeGames, awayGames) >= 8) return true
  return Math.max(homeGames, awayGames) >= 7 && /tiebreak|match tb|match tiebreak/i.test(sourceText)
}

function buildLineParseNotes(
  line: DataAssistScorecardParsedLine,
  sets: ScorecardSet[],
  scoreEventType: NonNullable<DataAssistScorecardParsedLine['scoreEventType']>,
) {
  const notes: string[] = []
  if (!line.homePlayers.length || !line.awayPlayers.length) notes.push('missing player names on one side')
  if (sets.length === 1) notes.push('only one set captured')
  if (!sets.length) notes.push('no set scores captured')
  if (setsAreSplitWithoutDecider(sets)) notes.push('split opening sets without captured deciding set')
  if (scoreEventType === 'timed_match') notes.push('timed match detected')
  if (scoreEventType === 'third_set_match_tiebreak') notes.push('third-set match tiebreak detected')
  return uniqueStrings(notes)
}

function setsAreSplitWithoutDecider(sets: ScorecardSet[]) {
  const meaningful = filterMeaningfulSets(sets)
  if (meaningful.length < 2) return false
  const firstTwo = meaningful.slice(0, 2)
  let homeWins = 0
  let awayWins = 0
  for (const set of firstTwo) {
    if (set.homeGames > set.awayGames) homeWins += 1
    if (set.awayGames > set.homeGames) awayWins += 1
  }
  return homeWins === 1 && awayWins === 1 && meaningful.length < 3
}

function splitPlayers(value: string) {
  return value
    .replace(/\b(?:singles|doubles)\b/gi, '')
    .split(/\s*(?:\/|&|\+|,|\band\b)\s*/i)
    .map(cleanPlayerName)
    .filter(Boolean)
}

function normalizeLineLabel(value: string) {
  const compact = value.toUpperCase().replace(/\s+/g, '')
  if (/^[1-5]S$/.test(compact)) return `${compact[0]} Singles`
  if (/^[1-5]D$/.test(compact)) return `${compact[0]} Doubles`
  const number = compact.match(/\d/)?.[0] || value.trim()
  if (compact.includes('DOUBLES')) return `${number} Doubles`
  if (compact.includes('SINGLES')) return `${number} Singles`
  if (compact.includes('D')) return `${number} Doubles`
  if (compact.includes('S')) return `${number} Singles`
  return `Line ${number}`
}

function normalizeScoreSet(value: string) {
  return value.replace(/\s+/g, '').replace(/(\d+)-(\d+)/, '$1-$2')
}

function calculateLineConfidence(homePlayers: string[], awayPlayers: string[], score: string) {
  let confidence = 0.25
  if (homePlayers.length) confidence += 0.25
  if (awayPlayers.length) confidence += 0.25
  if (score) confidence += 0.25
  return roundConfidence(confidence)
}

function calculateParseConfidence(input: {
  matchId: string
  matchDate: string
  homeTeam: string
  awayTeam: string
  parsedLines: DataAssistScorecardParsedLine[]
}) {
  let confidence = 0
  if (input.matchId) confidence += 0.18
  if (input.matchDate) confidence += 0.18
  if (input.homeTeam && input.awayTeam) confidence += 0.24
  if (input.parsedLines.length) confidence += Math.min(0.3, input.parsedLines.length * 0.08)
  const averageLineConfidence = input.parsedLines.length
    ? input.parsedLines.reduce((sum, line) => sum + line.confidenceScore, 0) / input.parsedLines.length
    : 0
  confidence += averageLineConfidence * 0.1
  return roundConfidence(confidence)
}

function cleanTeamName(value: string | undefined) {
  return cleanText(value)
    .replace(/\b(?:winner|scorecard|match details?|wins?)\b.*$/i, '')
    .replace(/\([5s]\)/gi, '(S)')
    .replace(/\b(?:visting|visiting|home)\b\s*$/i, '')
    .replace(/^['"\s]+|['"\s]+$/g, '')
    .trim()
}

function cleanPlayerName(value: string | undefined) {
  return cleanText(value)
    .replace(/\b(?:def\.?|d\.?|defeated|bt\.?|beat|beats|over|lost\s+to)\b/gi, '')
    .replace(SCORE_PATTERN, '')
    .replace(/^[‘’'"\s]+|[‘’'"\s]+$/g, '')
    .replace(/\bWiliam\b/g, 'William')
    .replace(/\bShave Khosla\b/g, 'Shawn Khosla')
    .replace(/\bEdun Ema\b/g, 'Edwin Ernst')
    .replace(/\bMark Soph\b/g, 'Mark Sophir')
    .replace(/\.$/, '')
    .trim()
}

function cleanToken(value: string | undefined) {
  return cleanText(value).replace(/[^A-Z0-9-]/gi, '').toUpperCase()
}

function cleanText(value: string | undefined) {
  return (value || '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()
}

function normalizeDateToken(value: string | undefined) {
  const cleaned = cleanText(value)
  const direct = cleaned.match(DATE_PATTERN)?.[0]
  if (direct) return direct

  const digits = cleaned.replace(/\D/g, '')
  if (digits.length === 7) {
    return `${digits[0]}/${digits.slice(1, 3)}/${digits.slice(3)}`
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 2).replace(/^0/, '')}/${digits.slice(2, 4)}/${digits.slice(4)}`
  }
  return cleaned
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}
