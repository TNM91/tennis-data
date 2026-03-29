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
  flight: string | null
  ustaSection: string | null
  districtArea: string | null
  league: string | null
  lines: ParsedScorecardLine[]
}

function cleanText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function getBodyText(doc: Document) {
  return cleanText(doc.body?.textContent || '')
}

function getCellTextByHeader(doc: Document, headerLabel: string) {
  const tables = Array.from(doc.querySelectorAll('table'))
  const normalizedHeader = headerLabel.toLowerCase()

  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr'))
    if (rows.length < 2) continue

    const headerCells = Array.from(rows[0].querySelectorAll('td, th')).map((cell) =>
      cleanText(cell.textContent)
    )

    const valueCells = Array.from(rows[1].querySelectorAll('td, th')).map((cell) =>
      cleanText(cell.textContent)
    )

    const idx = headerCells.findIndex((cell) => cell.toLowerCase() === normalizedHeader)
    if (idx !== -1 && valueCells[idx]) {
      return valueCells[idx]
    }
  }

  return null
}

function extractMatchDate(doc: Document) {
  const direct =
    getCellTextByHeader(doc, 'Date Match Played') ||
    getCellTextByHeader(doc, 'Date Scheduled') ||
    getCellTextByHeader(doc, 'Entry Date')

  if (direct) return direct

  const text = getBodyText(doc)
  const match =
    text.match(/Date Match Played:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i) ||
    text.match(/Date Scheduled:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i) ||
    text.match(/Entry Date:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i)

  return match?.[1] ?? null
}

function extractLeagueName(doc: Document) {
  const exact = doc.querySelector('#ctl00_mainContent_lnkLeagueForMatch')
  if (exact) return cleanText(exact.textContent) || null

  const fallback = Array.from(doc.querySelectorAll('a')).find((a) =>
    /league|adult|spring|summer|fall|winter/i.test(cleanText(a.textContent))
  )

  return cleanText(fallback?.textContent) || null
}

function extractMatchNumber(doc: Document) {
  const text = getBodyText(doc)
  const match = text.match(/Scorecard for Match #\s*([0-9]+)/i)
  return match?.[1] ?? null
}

function extractTeams(doc: Document) {
  const homeAnchor = doc.querySelector('#ctl00_mainContent_lnkHomeTeamForScoreCard')
  const awayAnchor = doc.querySelector('#ctl00_mainContent_lnkVisitorTeamForScoreCard')

  const homeTeam = cleanText(homeAnchor?.textContent) || null
  const awayTeam = cleanText(awayAnchor?.textContent) || null

  if (homeTeam || awayTeam) {
    return { homeTeam, awayTeam }
  }

  const homeFromHeader = getCellTextByHeader(doc, 'Home Team')
  const awayFromHeader = getCellTextByHeader(doc, 'Away Team')

  if (homeFromHeader || awayFromHeader) {
    return {
      homeTeam: homeFromHeader || null,
      awayTeam: awayFromHeader || null,
    }
  }

  return {
    homeTeam: null,
    awayTeam: null,
  }
}

function extractFlight(doc: Document) {
  return getCellTextByHeader(doc, 'Flight')
}

function extractUstaSection(doc: Document) {
  return getCellTextByHeader(doc, 'USTA Section')
}

function extractDistrictArea(doc: Document) {
  return getCellTextByHeader(doc, 'District/Area')
}

function extractLeague(doc: Document) {
  return getCellTextByHeader(doc, 'League')
}

function looksLikeScore(value: string) {
  const text = cleanText(value)
  return /^(\d+[-–]\d+)(\s+\d+[-–]\d+)*$/.test(text)
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
  const cleaned = cleanText(raw)
    .replace(/\bCompleted\b/i, '')
    .replace(/\bRetired\b/i, '')
    .trim()

  if (matchType === 'singles') {
    return cleaned ? [cleaned] : []
  }

  const doubleSpaceSplit = cleaned
    .split(/\s{2,}/)
    .map(cleanText)
    .filter(Boolean)

  if (doubleSpaceSplit.length === 2) return doubleSpaceSplit

  const slashSplit = cleaned
    .split(/\s*\/\s*/)
    .map(cleanText)
    .filter(Boolean)

  if (slashSplit.length === 2) return slashSplit

  const commaSplit = cleaned
    .split(/\s*,\s*/)
    .map(cleanText)
    .filter(Boolean)

  if (commaSplit.length === 2) return commaSplit

  const words = cleaned.split(' ').filter(Boolean)
  if (words.length >= 4) {
    const mid = Math.floor(words.length / 2)
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
  }

  return cleaned ? [cleaned] : []
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

      if (!teamAPlayers.length || !teamBPlayers.length) continue

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
    matchDate: extractMatchDate(doc),
    leagueName: extractLeagueName(doc),
    matchNumber: extractMatchNumber(doc),
    homeTeam,
    awayTeam,
    flight: extractFlight(doc),
    ustaSection: extractUstaSection(doc),
    districtArea: extractDistrictArea(doc),
    league: extractLeague(doc),
    lines,
  }
}