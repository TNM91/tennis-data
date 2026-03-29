export type ParsedScorecardLine = {
  lineNumber: number
  matchType: 'singles' | 'doubles'
  teamAPlayers: string[]
  teamBPlayers: string[]
  score: string
  winnerSide: 'A' | 'B'
}

export type ParsedScorecard = {
  matchDate: string | null
  leagueName: string | null
  matchNumber: string | null
  homeTeam: string | null
  awayTeam: string | null
  lines: ParsedScorecardLine[]
}

function cleanText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function extractMatchDate(html: string) {
  const match = html.match(/Date Match Played:\s*([0-9/]+)/i)
  return match?.[1] ?? null
}

function extractLeagueName(doc: Document) {
  const anchor = doc.querySelector('#ctl00_mainContent_lnkLeagueForMatch')
  return cleanText(anchor?.textContent) || null
}

function extractMatchNumber(html: string) {
  const match = html.match(/Scorecard for Match #\s*([0-9]+)/i)
  return match?.[1] ?? null
}

function extractTeams(doc: Document) {
  const headerTable = doc.querySelector('#ctl00_mainContent_tblScoreCardHeader1')
  if (!headerTable) {
    return { homeTeam: null, awayTeam: null }
  }

  const text = cleanText(headerTable.textContent)
  const parts = text.split(/\bVs\.\b/i)

  if (parts.length < 2) {
    return { homeTeam: null, awayTeam: null }
  }

  const left = cleanText(parts[0])
    .replace(/^.*?(?=[A-Za-z])/, '')
    .replace(/Team ID:.*$/i, '')
    .trim()

  const right = cleanText(parts[1])
    .replace(/Team ID:.*$/i, '')
    .trim()

  return {
    homeTeam: left || null,
    awayTeam: right || null,
  }
}

function looksLikeScore(value: string) {
  return /^\d[-–]\d(\s+\d[-–]\d)*(?:\s+\d+[-–]\d+)?$/.test(value.trim())
}

function parseLineType(value: string): { lineNumber: number; matchType: 'singles' | 'doubles' } | null {
  const text = cleanText(value)

  const singles = text.match(/^(\d+)#\s*Singles/i)
  if (singles) {
    return {
      lineNumber: Number(singles[1]),
      matchType: 'singles',
    }
  }

  const doubles = text.match(/^(\d+)#\s*Doubles/i)
  if (doubles) {
    return {
      lineNumber: Number(doubles[1]),
      matchType: 'doubles',
    }
  }

  return null
}

function splitPlayers(raw: string, matchType: 'singles' | 'doubles') {
  const cleaned = cleanText(raw).replace(/\bCompleted\b/i, '').trim()

  if (matchType === 'singles') {
    return [cleaned]
  }

  const parts = cleaned.split(/\s{2,}/).map(cleanText).filter(Boolean)
  if (parts.length === 2) return parts

  // fallback for ugly HTML spacing:
  // try to split long doubles names approximately in half
  const words = cleaned.split(' ').filter(Boolean)
  if (words.length >= 4) {
    const mid = Math.floor(words.length / 2)
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
  }

  return [cleaned]
}

function parseScoreToWinner(score: string): 'A' | 'B' {
  const sets = cleanText(score).split(/\s+/)
  let aSets = 0
  let bSets = 0

  for (const set of sets) {
    const m = set.match(/^(\d+)[-–](\d+)$/)
    if (!m) continue

    const a = Number(m[1])
    const b = Number(m[2])

    if (a > b) aSets += 1
    if (b > a) bSets += 1
  }

  return aSets >= bSets ? 'A' : 'B'
}

export function parseScorecardHtml(html: string): ParsedScorecard {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const { homeTeam, awayTeam } = extractTeams(doc)

  const tables = Array.from(doc.querySelectorAll('table'))
  const lines: ParsedScorecardLine[] = []
  const seen = new Set<string>()

  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr'))

    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td, th'))
        .map((cell) => cleanText(cell.textContent))
        .filter(Boolean)

      if (!cells.length) continue

      const lineInfo = parseLineType(cells[0])
      if (!lineInfo) continue

      const score = cells.find(looksLikeScore)
      if (!score) continue

      const vsIndex = cells.findIndex((c) => /^vs\.?$/i.test(c))
      if (vsIndex === -1) continue

      const leftRaw = cells[1] || ''
      const rightRaw = cells[vsIndex + 1] || ''

      const teamAPlayers = splitPlayers(leftRaw, lineInfo.matchType)
      const teamBPlayers = splitPlayers(rightRaw, lineInfo.matchType)

      const key = [
        lineInfo.lineNumber,
        lineInfo.matchType,
        teamAPlayers.join('|'),
        teamBPlayers.join('|'),
        score,
      ].join('::')

      if (seen.has(key)) continue
      seen.add(key)

      lines.push({
        lineNumber: lineInfo.lineNumber,
        matchType: lineInfo.matchType,
        teamAPlayers,
        teamBPlayers,
        score,
        winnerSide: parseScoreToWinner(score),
      })
    }
  }

  return {
    matchDate: extractMatchDate(html),
    leagueName: extractLeagueName(doc),
    matchNumber: extractMatchNumber(html),
    homeTeam,
    awayTeam,
    lines,
  }
}