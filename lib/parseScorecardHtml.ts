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

function getBodyText(doc: Document) {
  return cleanText(doc.body?.textContent || '')
}

function extractMatchDate(doc: Document) {
  const text = getBodyText(doc)

  const match =
    text.match(/Date Match Played:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i) ||
    text.match(/Match Date:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i)

  return match?.[1] ?? null
}

function extractLeagueName(doc: Document) {
  const anchor =
    doc.querySelector('#ctl00_mainContent_lnkLeagueForMatch') ||
    Array.from(doc.querySelectorAll('a')).find((a) =>
      /league/i.test(cleanText(a.textContent))
    )

  return cleanText(anchor?.textContent) || null
}

function extractMatchNumber(doc: Document) {
  const text = getBodyText(doc)
  const match = text.match(/Scorecard for Match #\s*([0-9]+)/i)
  return match?.[1] ?? null
}

function extractTeams(doc: Document) {
  const text = getBodyText(doc)

  const compact = text.replace(/\s+/g, ' ')

  const teamIds = [...compact.matchAll(/Team ID:\s*\d+/gi)]
  if (teamIds.length >= 2) {
    const firstTeamIdIndex = teamIds[0].index ?? -1
    const secondTeamIdIndex = teamIds[1].index ?? -1

    if (firstTeamIdIndex >= 0 && secondTeamIdIndex > firstTeamIdIndex) {
      const leftChunk = compact.slice(0, secondTeamIdIndex)
      const vsMatch = leftChunk.match(/([A-Za-z0-9&'.,\-()\/ ]+?)\s+Vs\.\s+([A-Za-z0-9&'.,\-()\/ ]+?)\s+Team ID:\s*\d+/i)

      if (vsMatch) {
        return {
          homeTeam: cleanText(vsMatch[1]) || null,
          awayTeam: cleanText(vsMatch[2]) || null,
        }
      }
    }
  }

  const explicitVs = compact.match(
    /([A-Za-z0-9&'.,\-()\/ ]+?)\s+Vs\.\s+([A-Za-z0-9&'.,\-()\/ ]+?)(?:\s+Team ID:|\s+Date Match Played:|\s+Location:)/i
  )

  if (explicitVs) {
    return {
      homeTeam: cleanText(explicitVs[1]) || null,
      awayTeam: cleanText(explicitVs[2]) || null,
    }
  }

  return {
    homeTeam: null,
    awayTeam: null,
  }
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
    lines,
  }
}