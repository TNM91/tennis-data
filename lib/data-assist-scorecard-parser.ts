import type { DataAssistScorecardParsedDraft, DataAssistScorecardParsedLine } from './data-assist-ocr'

export type DataAssistScorecardParseResult = DataAssistScorecardParsedDraft & {
  confidenceScore: number
}

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

  if (!matchId) parserWarnings.push('Missing TennisLink match id.')
  if (!matchDate) parserWarnings.push('Missing match date.')
  if (!teams.homeTeam || !teams.awayTeam) parserWarnings.push('Missing home or away team.')
  if (!parsedLines.length) parserWarnings.push('No scorecard lines parsed.')
  if (parsedLines.some((line) => !line.homePlayers.length || !line.awayPlayers.length)) {
    parserWarnings.push('One or more lines are missing player names.')
  }
  if (parsedLines.some((line) => !line.score)) {
    parserWarnings.push('One or more lines are missing scores.')
  }

  return {
    externalMatchId: matchId,
    homeTeam: teams.homeTeam,
    awayTeam: teams.awayTeam,
    matchDate,
    lineCount: parsedLines.length,
    parserWarnings,
    lines: parsedLines,
    rawTextPreview: text.slice(0, 1600),
    sourceScreenshotCount: 0,
    provider: 'manual_review',
    confidenceScore: calculateParseConfidence({
      matchId,
      matchDate,
      homeTeam: teams.homeTeam,
      awayTeam: teams.awayTeam,
      parsedLines,
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
  const directMatch = text.match(MATCH_ID_PATTERN)?.[1]
  if (directMatch) return cleanToken(directMatch)

  const fallback = text.match(/\b[A-Z]{2,5}-?\d{5,}\b/)?.[0]
  return fallback ? cleanToken(fallback) : ''
}

function extractMatchDate(text: string) {
  const tennisLinkPlayed = text.match(/\bDate\s+Match\s+Played\s*[:#-]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i)?.[1]
  const tennisLinkScheduled = text.match(/\bDate\s+Scheduled\s*[:#-]?\s*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})/i)?.[1]
  const labeled = text.match(/\b(?:match date|played|date)\s*[:#-]?\s*([A-Za-z0-9,/-]+(?:\s+\d{4})?)/i)?.[1]
  if (tennisLinkPlayed || tennisLinkScheduled) return cleanText(tennisLinkPlayed || tennisLinkScheduled)
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

  const matchupLine = lines.find((line) => TEAM_SEPARATOR_PATTERN.test(line) && !SCORE_PATTERN.test(line))
  if (matchupLine) {
    const [left, right] = matchupLine.split(TEAM_SEPARATOR_PATTERN)
    homeTeam ||= cleanTeamName(left)
    awayTeam ||= cleanTeamName(right)
  }

  return { homeTeam, awayTeam }
}

function extractScorecardLines(lines: string[]): DataAssistScorecardParsedLine[] {
  const parsedLines: DataAssistScorecardParsedLine[] = []

  for (const rawLine of lines) {
    const scoreMatches = rawLine.match(SCORE_PATTERN)
    if (!scoreMatches?.length) continue

    const lineMatch = rawLine.match(LINE_START_PATTERN)
    if (!lineMatch) continue

    const score = scoreMatches.map(normalizeScoreSet).join(' ')
    const beforeScore = rawLine.slice(0, rawLine.indexOf(scoreMatches[0])).trim()
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

    parsedLines.push({
      lineLabel: normalizeLineLabel(lineMatch[1]),
      homePlayers: leftPlayers,
      awayPlayers: rightPlayers,
      score,
      winner,
      confidenceScore: calculateLineConfidence(leftPlayers, rightPlayers, score),
    })
  }

  return parsedLines
}

function parseTennisLinkTableLine(lineLabel: string, value: string, score: string): DataAssistScorecardParsedLine | null {
  if (!TEAM_SEPARATOR_PATTERN.test(value)) return null

  const withoutStatus = value
    .replace(/\b(?:completed|defaulted|retired|walkover)\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm|noon)?\b/gi, ' ')
    .replace(/\b\d{1,2}:?\d{0,2}\s*noon\b/gi, ' ')
    .replace(SCORE_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const [home, away] = withoutStatus.split(TEAM_SEPARATOR_PATTERN)
  const homePlayers = splitPlayers(home)
  const awayPlayers = splitPlayers(away)
  if (!homePlayers.length || !awayPlayers.length) return null

  return {
    lineLabel: normalizeLineLabel(lineLabel),
    homePlayers,
    awayPlayers,
    score,
    winner: 'unknown',
    confidenceScore: roundConfidence(calculateLineConfidence(homePlayers, awayPlayers, score) - 0.12),
  }
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
    .replace(/\b(?:winner|scorecard|match details?)\b.*$/i, '')
    .trim()
}

function cleanPlayerName(value: string | undefined) {
  return cleanText(value)
    .replace(/\b(?:def\.?|d\.?|defeated|bt\.?|beat|beats|over|lost\s+to)\b/gi, '')
    .replace(SCORE_PATTERN, '')
    .trim()
}

function cleanToken(value: string | undefined) {
  return cleanText(value).replace(/[^A-Z0-9-]/gi, '').toUpperCase()
}

function cleanText(value: string | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}
