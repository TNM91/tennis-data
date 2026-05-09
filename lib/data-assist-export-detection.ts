import type { DataAssistImportType } from './data-assist'

export type DataAssistExportDetection = {
  importType: DataAssistImportType
  mixed: boolean
}

export async function detectDataAssistExportType(
  files: File[],
  fallback: DataAssistImportType,
): Promise<DataAssistExportDetection> {
  const detectedTypes = Array.from(new Set((
    await Promise.all(files.map((file) => detectImportTypeFromFile(file)))
  ).filter(Boolean))) as DataAssistImportType[]

  if (detectedTypes.length > 1) {
    return { importType: fallback, mixed: true }
  }

  return { importType: detectedTypes[0] || fallback, mixed: false }
}

export async function detectImportTypeFromFile(file: File): Promise<DataAssistImportType | null> {
  const fromFileName = detectImportTypeFromFileName(file.name)
  const fromContents = await detectImportTypeFromFileContents(file)
  return fromContents || fromFileName
}

export function detectImportTypeFromFileName(fileName: string): DataAssistImportType | null {
  const lowerName = fileName.toLowerCase()
  if (lowerName.includes('matchschedule') || lowerName.includes('match-schedule') || lowerName.includes('schedule')) return 'schedule'
  if (lowerName.includes('teamsummary') || lowerName.includes('team-summary') || lowerName.includes('team_summary') || lowerName.includes('roster')) return 'team_summary'
  if (lowerName.includes('scorecard') || lowerName.includes('score-card') || lowerName.includes('score_card')) return 'scorecard'
  return null
}

export async function detectImportTypeFromFileContents(file: File): Promise<DataAssistImportType | null> {
  const text = await file.slice(0, Math.min(file.size, 350_000)).text().catch(() => '')
  if (!text) return null

  return detectImportTypeFromExportText(text)
}

export function detectImportTypeFromExportText(text: string): DataAssistImportType | null {
  const normalized = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()

  if (
    normalized.includes('scorecard for match') ||
    (normalized.includes('score card') && normalized.includes('3rd set tie-break')) ||
    (normalized.includes('match win criteria') && normalized.includes('home team') && normalized.includes('visiting team') && normalized.includes('3rd set'))
  ) {
    return 'scorecard'
  }

  if (
    normalized.includes('match schedule by') ||
    normalized.includes('match schedule tab') ||
    (normalized.includes('schedule date') && normalized.includes('schedule time') && normalized.includes('facility/match site')) ||
    (normalized.includes('match id') && normalized.includes('home team') && normalized.includes('visiting team') && normalized.includes('facility/match site'))
  ) {
    return 'schedule'
  }

  if (
    normalized.includes('team summary') ||
    normalized.includes('team standings') ||
    normalized.includes('championship advancements') ||
    (normalized.includes('player name') && normalized.includes('ntrp')) ||
    (normalized.includes('team matches') && normalized.includes('players') && normalized.includes('wins'))
  ) {
    return 'team_summary'
  }

  return null
}
