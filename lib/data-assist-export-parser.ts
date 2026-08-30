import type { DataAssistOcrProvider, DataAssistOcrScreenshotInput } from './data-assist-ocr'
import type { DataAssistImportType } from './data-assist'
import { detectImportTypeFromExportText } from './data-assist-export-detection'

export type DataAssistExportParseResult = {
  provider: DataAssistOcrProvider
  rawText: string
  detectedImportType?: DataAssistImportType
  mixedImportTypes?: boolean
  confidenceScore: number
  warnings: string[]
  screenshotSummaries: []
}

type ExportFileInput = DataAssistOcrScreenshotInput & {
  fileBuffer: Buffer
  mimeType: string
}

type HtmlRow = string[]

export function isTennisLinkExportFile(file: { fileName: string; mimeType?: string; visualSignals?: string[] }) {
  const lowerName = file.fileName.toLowerCase()
  const lowerMime = (file.mimeType || '').toLowerCase()
  return (
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.html') ||
    lowerMime.includes('excel') ||
    lowerMime.includes('html') ||
    (file.visualSignals || []).some((signal) => /excel export|html table/i.test(signal))
  )
}

export function parseTennisLinkExportFiles(files: ExportFileInput[]): DataAssistExportParseResult {
  const blocks = files
    .sort((a, b) => a.uploadOrder - b.uploadOrder)
    .map((file) => parseTennisLinkExportFile(file))
    .filter(Boolean)

  const rawText = blocks.join('\n\n')
  const blockTypes = uniqueText(blocks.map((block) => detectImportTypeFromExportText(block) || ''))
  const mixedImportTypes = blockTypes.length > 1
  const detectedImportType = mixedImportTypes
    ? undefined
    : (blockTypes[0] as DataAssistImportType | undefined) || detectImportTypeFromExportText(rawText) || undefined
  const warnings = rawText
    ? ['TennisLink Excel export parsed from table data.']
    : ['No readable TennisLink export rows were found.']
  if (mixedImportTypes) {
    warnings.push('Multiple TennisLink export types were found. Upload one type at a time.')
  }

  return {
    provider: 'tennislink_export',
    rawText,
    detectedImportType,
    mixedImportTypes,
    confidenceScore: rawText ? 0.96 : 0,
    warnings,
    screenshotSummaries: [],
  }
}

function parseTennisLinkExportFile(file: ExportFileInput) {
  const html = decodeFileBuffer(file.fileBuffer)
  const rows = extractHtmlRows(html)
  const textRows = rows.map((row) => `Export table row | ${row.join(' | ')}`).filter(Boolean)
  const scorecardRows = [
    ...buildStructuredScorecardMeta(rows),
    ...buildStructuredScorecardTeams(rows),
    ...buildStructuredScorecardLines(rows),
  ]
  const structuredRows = [
    ...scorecardRows,
    ...buildStructuredScheduleMeta(rows),
    ...buildStructuredScheduleLines(rows),
    ...buildStructuredTeamSummaryMeta(rows),
    ...buildStructuredRosterLines(rows),
    ...buildStructuredRosterContacts(rows),
  ]

  return [
    `Export ${file.uploadOrder}: ${file.fileName}`,
    ...structuredRows,
    ...(scorecardRows.length ? [] : textRows),
  ].join('\n')
}

function buildStructuredScorecardMeta(rows: HtmlRow[]) {
  const lines: string[] = []
  const scorecardRow = rows.find((cells) => /\bScorecard\s+for\s+Match\s*#/i.test(cells.join(' ')))
  if (scorecardRow?.[0]) lines.push(scorecardRow[0])

  const dateRow = rows.find((cells) => cells.some((cell) => /\bDate Match Played\b/i.test(cell)))
  const playedDate = dateRow?.join(' ').match(/\bDate Match Played:\s*([0-9/]+)/i)?.[1]
  const scheduledDate = dateRow?.join(' ').match(/\bDate Scheduled:\s*([0-9/]+)/i)?.[1]
  if (playedDate || scheduledDate) lines.push(`Date Match Played: ${playedDate || scheduledDate}`)

  return lines
}

function buildStructuredScorecardTeams(rows: HtmlRow[]) {
  const teamRow = rows.find((cells) => /\bteam id\b/i.test(cells.join(' ')) && /\bvs\.?\b/i.test(cells.join(' ')))
  if (!teamRow) return []

  const teams = teamRow.filter((cell) => /\bTeam ID\b/i.test(cell)).map(cleanScorecardTeam).filter(Boolean)
  const homeTeam = teams[0] || ''
  const awayTeam = teams[1] || ''
  return homeTeam && awayTeam ? [`Home Team: ${homeTeam}`, `Visiting Team: ${awayTeam}`] : []
}

function buildStructuredScheduleLines(rows: HtmlRow[]) {
  return getStructuredScheduleRows(rows)
    .map((cells) => [
      'Schedule row',
      cells[0],
      cells[1],
      cells[2],
      cells[3],
      cells[5],
      cells[7],
      cells.join(' '),
    ].join(' | '))
}

function buildStructuredScheduleMeta(rows: HtmlRow[]) {
  const scheduleRows = getStructuredScheduleRows(rows)
  if (!scheduleRows.length) return []

  const lines: string[] = []
  const metadata = findScheduleMetadata(rows)
  if (metadata.ustaSection) lines.push(`USTA Section: ${metadata.ustaSection}`)
  if (metadata.districtArea) lines.push(`District/Area: ${metadata.districtArea}`)
  if (metadata.leagueName) lines.push(`League: ${metadata.leagueName}`)
  if (metadata.flight) lines.push(`Flight: ${metadata.flight}`)

  const teamName = inferScheduleTeamName(scheduleRows)
  if (teamName) lines.push(`Team: ${teamName}`)
  return lines
}

function buildStructuredTeamSummaryMeta(rows: HtmlRow[]) {
  const standingsHeaderIndex = rows.findIndex((cells) => (
    cells.some((cell) => /^Team Name$/i.test(cell)) &&
    cells.some((cell) => /^Wins\*?$/i.test(cell)) &&
    cells.some((cell) => /^Losses$/i.test(cell))
  ))
  const legacyRosterHeaderIndex = rows.findIndex(isLegacyRosterHeader)
  const hasLegacyRosterHeader = legacyRosterHeaderIndex >= 0
  const hasPlayerRosterHeader = rows.some(isPlayerRosterHeader)
  if ((!hasLegacyRosterHeader || standingsHeaderIndex < 0) && !hasPlayerRosterHeader) return []

  const standings: Array<{ name: string; wins: string; losses: string }> = []
  if (standingsHeaderIndex >= 0) {
    for (const cells of rows.slice(standingsHeaderIndex + 1)) {
      const name = cells[0] || ''
      const wins = cells[1] || ''
      const losses = cells[2] || ''
      if (!name || !/^\d+$/.test(wins) || !/^\d+$/.test(losses)) break
      standings.push({ name, wins, losses })
    }
  }

  const lines: string[] = []
  const metadata = findScheduleMetadata(rows)
  if (metadata.ustaSection) lines.push(`USTA Section: ${metadata.ustaSection}`)
  if (metadata.districtArea) lines.push(`District/Area: ${metadata.districtArea}`)
  if (metadata.leagueName) lines.push(`League: ${metadata.leagueName}`)
  if (metadata.flight) lines.push(`Flight: ${metadata.flight}`)

  const rosterTeamName = hasPlayerRosterHeader
    ? inferPlayerRosterTeamName(rows)
    : inferTeamSummaryRosterTeam(rows, standings.map((team) => team.name))
  if (rosterTeamName) lines.push(`Team: ${rosterTeamName}`)
  for (const team of standings) {
    lines.push(['Team standing', team.name, team.wins, team.losses].join(' | '))
  }
  return lines
}

function inferTeamSummaryRosterTeam(rows: HtmlRow[], teamNames: string[]) {
  if (teamNames.length === 1) return teamNames[0]

  const captainHeaderIndex = rows.findIndex((cells) => (
    cells.some((cell) => /^Captain$/i.test(cell)) || cells.some((cell) => /^Co-Captain$/i.test(cell))
  ))
  const captainValues = captainHeaderIndex >= 0 ? rows[captainHeaderIndex + 1] || [] : []
  const captainSurnames = captainValues
    .map((value) => value.match(/^([A-Za-z'. -]+?)(?=\s+\d|\s+[^\s@]+@|$)/)?.[1] || '')
    .map((name) => name.trim().split(/\s+/).at(-1) || '')
    .filter((name) => name.length >= 3)

  const ranked = teamNames
    .map((teamName) => ({
      teamName,
      score: captainSurnames.filter((surname) => new RegExp(`\\b${escapeRegExp(surname)}\\b`, 'i').test(teamName)).length,
    }))
    .sort((left, right) => right.score - left.score)

  if (!ranked[0]?.score || ranked[0].score === ranked[1]?.score) return ''
  return ranked[0].teamName
}

function findScheduleMetadata(rows: HtmlRow[]) {
  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex += 1) {
    const headings = rows[rowIndex]
    const values = rows[rowIndex + 1]
    if (!headings.some((heading) => /^(?:USTA\s+)?Section$/i.test(heading))) continue
    if (!headings.some((heading) => /^(?:USTA\s+)?District(?:\/Area)?$/i.test(heading))) continue
    if (!headings.some((heading) => /^(?:Local\s+)?League(?:\s*\/\s*League Type)?$/i.test(heading))) continue
    if (!headings.some((heading) => /^(?:Flight|Flight Name)$/i.test(heading))) continue

    return {
      ustaSection: getMetadataValue(headings, values, /^(?:USTA\s+)?Section$/i),
      districtArea: getMetadataValue(headings, values, /^(?:USTA\s+)?District(?:\/Area)?$/i),
      leagueName: getMetadataValue(headings, values, /^(?:Local\s+)?League(?:\s*\/\s*League Type)?$/i),
      flight: getMetadataValue(headings, values, /^(?:Flight|Flight Name)$/i),
    }
  }

  return { ustaSection: '', districtArea: '', leagueName: '', flight: '' }
}

function getMetadataValue(headings: HtmlRow, values: HtmlRow, pattern: RegExp) {
  const index = headings.findIndex((heading) => pattern.test(heading))
  return index >= 0 ? values[index] || '' : ''
}

function inferScheduleTeamName(scheduleRows: HtmlRow[]) {
  const counts = new Map<string, number>()
  for (const cells of scheduleRows) {
    for (const team of [cells[3], cells[5]]) {
      if (!team) continue
      counts.set(team, (counts.get(team) || 0) + 1)
    }
  }

  const ranked = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])
  if (!ranked.length || ranked[0][1] === ranked[1]?.[1]) return ''
  return ranked[0][0]
}

function isStructuredScheduleRow(cells: HtmlRow) {
  return /^\d{7,}$/.test(cells[0] || '') && cells.length >= 8
}

function getStructuredScheduleRows(rows: HtmlRow[]) {
  const headerIndex = rows.findIndex((cells) => (
    cells.some((cell) => /^Match ID$/i.test(cell)) &&
    cells.some((cell) => /^Schedule Date$/i.test(cell)) &&
    cells.some((cell) => /^Home Team$/i.test(cell)) &&
    cells.some((cell) => /^Visiting Team$/i.test(cell))
  ))
  if (headerIndex < 0) return []
  return rows.slice(headerIndex + 1).filter(isStructuredScheduleRow)
}

function buildStructuredRosterLines(rows: HtmlRow[]) {
  const lines: string[] = []
  const playerRosterHeaderIndex = rows.findIndex(isPlayerRosterHeader)
  if (playerRosterHeaderIndex >= 0) {
    const header = rows[playerRosterHeaderIndex]
    const ustaIndex = findCellIndex(header, /^Usta#$/i)
    const nameIndex = findCellIndex(header, /^Player$/i)
    const phoneIndex = findCellIndex(header, /^Phone no$/i)
    const emailIndex = findCellIndex(header, /^(?:E-?mail|E-?mail Address|Player E-?mail)$/i)
    const ratingIndex = findCellIndex(header, /^NTRP\/Rating Date$/i)

    for (const cells of rows.slice(playerRosterHeaderIndex + 1)) {
      const ustaNumber = cells[ustaIndex] || ''
      if (!/^\d{9,10}$/.test(ustaNumber)) continue
      const name = cells[nameIndex] || ''
      const phone = cells[phoneIndex] || ''
      const email = emailIndex >= 0 ? cells[emailIndex] || '' : ''
      const rating = (cells[ratingIndex] || '').match(/\b([2-5](?:\.[05])?)\b/)?.[1] || ''
      if (!name || !rating) continue
      lines.push(['Roster player', name, rating, phone, email, ustaNumber].join(' | '))
    }
    return lines
  }

  const legacyRosterHeaderIndex = rows.findIndex(isLegacyRosterHeader)
  if (legacyRosterHeaderIndex < 0) return lines

  // A Team Summary starts with league and standings tables. Only rows after the
  // dedicated Player Name / NTRP header belong to the roster, otherwise a team
  // name plus its wins can be misread as a player plus a rating.
  for (const cells of rows.slice(legacyRosterHeaderIndex + 1)) {
    if (cells.length < 2) continue
    for (let index = 0; index < cells.length - 1; index += 2) {
      const name = cells[index] || ''
      const rating = cells[index + 1] || ''
      if (!/^[A-Za-z][A-Za-z'. -]{3,}$/.test(name)) continue
      if (!/^[2-5](?:\.[05])?$/.test(rating)) continue
      lines.push(['Roster player', name, rating].join(' | '))
    }
  }
  return lines
}

function isLegacyRosterHeader(cells: HtmlRow) {
  return (
    cells.some((cell) => /^Player Name$/i.test(cell)) &&
    cells.some((cell) => /^NTRP$/i.test(cell))
  )
}

function buildStructuredRosterContacts(rows: HtmlRow[]) {
  const headerIndex = rows.findIndex((cells) => (
    cells.some((cell) => /^Captain Name$/i.test(cell)) &&
    cells.some((cell) => /^Captain Phone$/i.test(cell)) &&
    cells.some((cell) => /^Captain E-Mail Address$/i.test(cell))
  ))
  if (headerIndex < 0) return []

  const header = rows[headerIndex]
  const nameIndex = findCellIndex(header, /^Captain Name$/i)
  const phoneIndex = findCellIndex(header, /^Captain Phone$/i)
  const emailIndex = findCellIndex(header, /^Captain E-Mail Address$/i)
  const lines: string[] = []
  for (const [offset, cells] of rows.slice(headerIndex + 1, headerIndex + 3).entries()) {
    const name = cells[nameIndex] || ''
    const phone = cells[phoneIndex] || ''
    const email = cells[emailIndex] || ''
    if (!name || (!phone && !email)) continue
    lines.push(['Roster contact', offset === 0 ? 'Captain' : 'Co-Captain', name, phone, email].join(' | '))
  }
  return lines
}

function isPlayerRosterHeader(cells: HtmlRow) {
  return (
    cells.some((cell) => /^Usta#$/i.test(cell)) &&
    cells.some((cell) => /^Player$/i.test(cell)) &&
    cells.some((cell) => /^Phone no$/i.test(cell)) &&
    cells.some((cell) => /^NTRP\/Rating Date$/i.test(cell))
  )
}

function inferPlayerRosterTeamName(rows: HtmlRow[]) {
  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex += 1) {
    const headings = rows[rowIndex]
    const teamNameIndex = findCellIndex(headings, /^Team Name$/i)
    if (teamNameIndex < 0 || !headings.some((heading) => /^Team Number$/i.test(heading))) continue
    return rows[rowIndex + 1]?.[teamNameIndex] || ''
  }
  return ''
}

function findCellIndex(cells: HtmlRow, pattern: RegExp) {
  return cells.findIndex((cell) => pattern.test(cell))
}

function buildStructuredScorecardLines(rows: HtmlRow[]) {
  const lines: string[] = []
  for (const cells of rows) {
    if (cells.length < 5) continue
    const vsIndex = cells.findIndex((cell) => /^vs\.?(?:\s*\/)?$/i.test(cell))
    if (vsIndex < 0) continue
    const lineLabel = normalizeScorecardLineLabel(cells[0] || '')
    const homePlayers = cleanScorecardPlayers(cells[1] || '')
    const awayPlayers = cleanScorecardPlayers(cells[vsIndex + 1] || '')
    const score = cells.at(-1) || ''
    if (!lineLabel || !homePlayers || !awayPlayers || !/\d+\s*-\s*\d+/.test(score)) continue

    const winner = /imgHomePlayer/i.test(cells.join(' ')) ? 'home' : /imgVisitorPlayer/i.test(cells.join(' ')) ? 'away' : ''
    lines.push(`${lineLabel} ${homePlayers} vs ${awayPlayers}${winner ? ` winner marker: ${winner}` : ''} ${score}`)
  }
  return lines
}

function normalizeScorecardLineLabel(value: string) {
  const triLevelMatch = value.match(/\b[2-5](?:\.[05])\s*(Singles|Doubles)\s*#\s*([1-5])/i)
  if (triLevelMatch) return `${triLevelMatch[2]} ${triLevelMatch[1]}`

  const match = value.match(/\b([1-5])#?\s*(Singles|Doubles)/i)
  return match ? `${match[1]} ${match[2]}` : ''
}

function cleanScorecardPlayers(value: string) {
  return value
    .replace(/\bCompleted\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*$/, '')
    .trim()
}

function cleanScorecardTeam(value: string) {
  return value
    .replace(/\bTeam ID:.*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*$/, '')
    .trim()
}

function extractHtmlRows(html: string): HtmlRow[] {
  const rows: HtmlRow[] = []
  for (const rowMatch of html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    const rowHtml = rowMatch[0]
    const cells = Array.from(rowHtml.matchAll(/<t[dh]\b[\s\S]*?<\/t[dh]>/gi))
      .map((cellMatch) => htmlCellToText(cellMatch[0]))
      .filter((cell) => cell.length > 0)
    if (cells.length) rows.push(cells)
  }
  return rows
}

function htmlCellToText(value: string) {
  const marker = /imgHomePlayer/i.test(value)
    ? ' imgHomePlayer '
    : /imgVisitorPlayer/i.test(value)
      ? ' imgVisitorPlayer '
      : ''
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?\s*>/gi, ' / ')
    .replace(/<img\b[^>]*id=["'][^"']*imgHomePlayer[^"']*["'][^>]*>/gi, ' imgHomePlayer ')
    .replace(/<img\b[^>]*id=["'][^"']*imgVisitorPlayer[^"']*["'][^>]*>/gi, ' imgVisitorPlayer ')
    .replace(/<[^>]+>/g, ' ')
    .concat(marker)
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeFileBuffer(buffer: Buffer) {
  return buffer.toString('utf8')
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
