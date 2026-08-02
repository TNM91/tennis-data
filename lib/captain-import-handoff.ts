import type { DataAssistImportActionResult } from './data-assist'
import type { DataAssistScheduleParsedDraft } from './data-assist-schedule-parser'
import type { DataAssistTeamSummaryParsedDraft } from './data-assist-team-summary-parser'

export type CaptainImportHandoff = {
  importType: 'schedule' | 'team_summary'
  batchId: string
  team: string
  league: string
  flight: string
  players: number
  contacts: number
  matches: number
  captainRoles: number
}

export function isCaptainImportDraft(
  draft: unknown,
): draft is DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft {
  if (!draft || typeof draft !== 'object') return false
  const kind = (draft as { draftKind?: unknown }).draftKind
  return kind === 'schedule' || kind === 'team_summary'
}

export function buildCaptainImportHandoff(input: {
  batchId: string
  parsedDraft: DataAssistScheduleParsedDraft | DataAssistTeamSummaryParsedDraft
  result?: DataAssistImportActionResult
}): CaptainImportHandoff {
  if (input.parsedDraft.draftKind === 'schedule') {
    const importResult = input.result?.importResult?.kind === 'schedule'
      ? input.result.importResult.result
      : null
    return {
      importType: 'schedule',
      batchId: input.batchId,
      team: cleanText(input.parsedDraft.teamName),
      league: cleanText(input.parsedDraft.leagueName),
      flight: cleanText(input.parsedDraft.flight),
      players: 0,
      contacts: 0,
      matches: importResult
        ? importResult.successCount + importResult.updatedCount
        : input.parsedDraft.matchCount,
      captainRoles: 0,
    }
  }

  const importResult = input.result?.importResult?.kind === 'team_summary'
    ? input.result.importResult.result
    : null
  return {
    importType: 'team_summary',
    batchId: input.batchId,
    team: cleanText(input.parsedDraft.rosterTeamName),
    league: cleanText(input.parsedDraft.leagueName),
    flight: cleanText(input.parsedDraft.flight),
    players: importResult?.totalPlayers ?? input.parsedDraft.playerCount,
    contacts: input.result?.importedContactCount ?? input.parsedDraft.contactCount,
    matches: 0,
    captainRoles: input.parsedDraft.contacts.filter((contact) => contact.isCaptain).length,
  }
}

export function buildCaptainImportReturnHref(returnTo: string, handoff: CaptainImportHandoff) {
  const safeReturnTo = getSafeCaptainReturnTo(returnTo)
  if (!safeReturnTo) return '/captain'

  const hashIndex = safeReturnTo.indexOf('#')
  const hash = hashIndex >= 0 ? safeReturnTo.slice(hashIndex) : ''
  const pathAndQuery = hashIndex >= 0 ? safeReturnTo.slice(0, hashIndex) : safeReturnTo
  const queryIndex = pathAndQuery.indexOf('?')
  const path = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery
  const params = new URLSearchParams(queryIndex >= 0 ? pathAndQuery.slice(queryIndex + 1) : '')

  params.set('captainImport', handoff.importType)
  params.set('importBatch', handoff.batchId)
  setIfPresent(params, 'team', handoff.team)
  setIfPresent(params, 'league', handoff.league)
  setIfPresent(params, 'flight', handoff.flight)
  setCount(params, 'importPlayers', handoff.players)
  setCount(params, 'importContacts', handoff.contacts)
  setCount(params, 'importMatches', handoff.matches)
  setCount(params, 'importRoles', handoff.captainRoles)

  const query = params.toString()
  return `${path}${query ? `?${query}` : ''}${hash}`
}

export function readCaptainImportHandoff(searchParams: Pick<URLSearchParams, 'get'>): CaptainImportHandoff | null {
  const importType = searchParams.get('captainImport')
  if (importType !== 'schedule' && importType !== 'team_summary') return null

  const batchId = cleanText(searchParams.get('importBatch'))
  const team = cleanText(searchParams.get('team'))
  if (!batchId || !team) return null

  return {
    importType,
    batchId,
    team,
    league: cleanText(searchParams.get('league')),
    flight: cleanText(searchParams.get('flight')),
    players: readCount(searchParams.get('importPlayers')),
    contacts: readCount(searchParams.get('importContacts')),
    matches: readCount(searchParams.get('importMatches')),
    captainRoles: readCount(searchParams.get('importRoles')),
  }
}

function getSafeCaptainReturnTo(value: string) {
  const path = cleanText(value)
  if (!path || path.length > 500 || path.startsWith('//')) return ''
  return path === '/captain' || path.startsWith('/captain/') || path.startsWith('/captain?')
    ? path
    : ''
}

function setIfPresent(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value)
}

function setCount(params: URLSearchParams, key: string, value: number) {
  if (Number.isFinite(value) && value > 0) params.set(key, String(Math.floor(value)))
}

function readCount(value: string | null) {
  const parsed = Number.parseInt(value || '0', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
