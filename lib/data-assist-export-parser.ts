import type { DataAssistOcrProvider, DataAssistOcrScreenshotInput } from './data-assist-ocr'

export type DataAssistExportParseResult = {
  provider: DataAssistOcrProvider
  rawText: string
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
  return {
    provider: 'tennislink_export',
    rawText,
    confidenceScore: rawText ? 0.96 : 0,
    warnings: rawText ? ['TennisLink Excel export parsed from table data.'] : ['No readable TennisLink export rows were found.'],
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
    ...buildStructuredScheduleLines(rows),
    ...buildStructuredRosterLines(rows),
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
  return rows
    .filter((cells) => /^\d{7,}$/.test(cells[0] || '') && cells.length >= 8)
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

function buildStructuredRosterLines(rows: HtmlRow[]) {
  const lines: string[] = []
  for (const cells of rows) {
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

function buildStructuredScorecardLines(rows: HtmlRow[]) {
  const lines: string[] = []
  for (const cells of rows) {
    if (cells.length < 5) continue
    const vsIndex = cells.findIndex((cell) => /^vs\.?$/i.test(cell))
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
  const match = value.match(/\b([1-5])#?\s*(Singles|Doubles)/i)
  return match ? `${match[1]} ${match[2]}` : ''
}

function cleanScorecardPlayers(value: string) {
  return value
    .replace(/\bCompleted\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanScorecardTeam(value: string) {
  return value
    .replace(/\bTeam ID:.*$/i, '')
    .replace(/\s+/g, ' ')
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
    .replace(/<br\s*\/?\s*>/gi, ' ')
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
