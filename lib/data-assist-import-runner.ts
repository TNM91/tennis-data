import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyDataAssistPlayerMappingsToRow,
  buildDataAssistScorecardImportRow,
  buildScorecardImportFingerprint,
  collectDataAssistImportPlayerNames,
  type DataAssistImportPlayerMapping,
  type DataAssistImportPreview,
} from './data-assist-import'
import type { DataAssistScorecardParsedDraft } from './data-assist-ocr'
import type { DataAssistScheduleParsedDraft } from './data-assist-schedule-parser'
import type { DataAssistTeamSummaryParsedDraft } from './data-assist-team-summary-parser'
import { upsertCaptainRosterContacts } from './captain-roster-contacts'
import { runScheduleImport, runScorecardImport, runTeamSummaryImport, type RunImportSuccess } from './ingestion/runImport'
import { recalculateDynamicRatings } from './recalculateRatings'
import { announceTeamRoomScorecardResult } from './team-room-result-announcement-server'

export type DataAssistScorecardImportAction = 'preview' | 'commit'

export type DataAssistScorecardImportActionResult = {
  ok: boolean
  action: DataAssistScorecardImportAction
  message: string
  importPreview?: DataAssistImportPreview
  importResult?: Extract<RunImportSuccess, { kind: 'scorecard' }>
}

type PlayerRow = {
  id?: string | null
  name?: string | null
  normalized_name?: string | null
}

type StatsBatchRow = {
  status?: string | null
  reviewed_at?: string | null
}

export type DataAssistScheduleImportActionResult = {
  ok: boolean
  action: DataAssistScorecardImportAction
  message: string
  importResult?: Extract<RunImportSuccess, { kind: 'schedule' }>
}

export type DataAssistTeamSummaryImportActionResult = {
  ok: boolean
  action: DataAssistScorecardImportAction
  message: string
  importResult?: Extract<RunImportSuccess, { kind: 'team_summary' }>
  importedContactCount?: number
  contactWarning?: string
}

type ExistingMatchRow = {
  id?: string | null
  external_match_id?: string | null
  status?: string | null
  match_date?: string | null
  home_team?: string | null
  away_team?: string | null
  line_number?: number | null
}

type ExistingLineRow = {
  id: string
  line_number: string | null
  match_type: 'singles' | 'doubles' | null
  winner_side: 'A' | 'B' | null
  score: string | null
}

type ExistingMatchPlayerRow = {
  match_id: string
  player_id: string
  side: 'A' | 'B'
  seat: number | null
}

export async function runDataAssistScheduleImportAction(input: {
  supabase: SupabaseClient
  parsedDraft: DataAssistScheduleParsedDraft
  batchId: string
  draftId: string
  reviewedBy: string
  action: DataAssistScorecardImportAction
  validationSummary?: Record<string, unknown> | null
}): Promise<DataAssistScheduleImportActionResult> {
  const payload = buildDataAssistSchedulePayload(input.parsedDraft, input.batchId)
  const importResult = await runScheduleImport(input.supabase, payload, input.action === 'preview' ? 'preview' : 'commit')

  if (!importResult.ok || importResult.kind !== 'schedule') {
    return {
      ok: false,
      action: input.action,
      message: importResult.ok ? 'Schedule import returned an unexpected result.' : importResult.error,
    }
  }

  if (input.action === 'commit') {
    if (importResult.result.failedCount > 0) {
      return {
        ok: false,
        action: input.action,
        message: importResult.result.errors[0]?.message || 'Schedule import did not commit.',
        importResult,
      }
    }

    const importedAt = new Date().toISOString()
    const validationSummary = {
      ...(input.validationSummary || {}),
      importSummary: {
        importedAt,
        importResult,
        scheduleMatches: input.parsedDraft.matches,
      },
    }
    const message = buildScheduleImportedReviewNote(importResult)
    const [batchUpdate, draftUpdate] = await Promise.all([
      input.supabase
        .from('data_assist_batches')
        .update({
          status: 'imported',
          review_note: message,
          reviewed_by_user_id: input.reviewedBy,
          reviewed_at: importedAt,
        })
        .eq('id', input.batchId),
      input.supabase
        .from('data_assist_drafts')
        .update({
          status: 'imported',
          validation_summary: validationSummary,
          reviewed_by_user_id: input.reviewedBy,
          reviewed_at: importedAt,
        })
        .eq('id', input.draftId),
    ])

    if (batchUpdate.error) return { ok: false, action: input.action, message: batchUpdate.error.message, importResult }
    if (draftUpdate.error) return { ok: false, action: input.action, message: draftUpdate.error.message, importResult }
    await refreshDataAssistContributorStats(input.supabase, input.reviewedBy)
  }

  return {
    ok: true,
    action: input.action,
    importResult,
    message: input.action === 'commit'
      ? buildScheduleImportedReviewNote(importResult)
      : `Schedule preview ready. ${importResult.result.successCount} match${importResult.result.successCount === 1 ? '' : 'es'} validated.`,
  }
}

function buildDataAssistSchedulePayload(parsedDraft: DataAssistScheduleParsedDraft, batchId: string) {
  return {
    pageType: 'season_schedule',
    seasonSchedule: {
      teamName: parsedDraft.teamName,
      leagueName: parsedDraft.leagueName,
      flight: parsedDraft.flight,
      ustaSection: parsedDraft.ustaSection,
      districtArea: parsedDraft.districtArea,
      matches: parsedDraft.matches.map((match) => ({
        matchId: match.externalMatchId,
        externalMatchId: match.externalMatchId,
        scheduleDate: match.matchDate,
        scheduleTime: match.matchTime,
        scheduleTimeDisplay: match.matchTime,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        facility: match.facility,
        sourceBatchId: batchId,
      })),
    },
  }
}

function buildScheduleImportedReviewNote(importResult: Extract<RunImportSuccess, { kind: 'schedule' }>) {
  const imported = importResult.result.successCount
  const updated = importResult.result.updatedCount
  const total = imported + updated
  if (updated && imported) return `Data Assist schedule imported ${total} matches: ${imported} new, ${updated} updated.`
  if (updated) return `Data Assist schedule updated ${updated} scheduled match${updated === 1 ? '' : 'es'}.`
  return `Data Assist schedule imported ${imported} scheduled match${imported === 1 ? '' : 'es'}.`
}

export async function runDataAssistTeamSummaryImportAction(input: {
  supabase: SupabaseClient
  parsedDraft: DataAssistTeamSummaryParsedDraft
  batchId: string
  draftId: string
  reviewedBy: string
  action: DataAssistScorecardImportAction
  validationSummary?: Record<string, unknown> | null
}): Promise<DataAssistTeamSummaryImportActionResult> {
  if (!input.parsedDraft.rosterTeamName.trim()) {
    return {
      ok: false,
      action: input.action,
      message: 'Confirm the team before importing this Player Roster.',
    }
  }

  if (input.parsedDraft.rosterSource === 'player_roster') {
    return runDataAssistPlayerRosterContactImportAction(input)
  }

  const payload = buildDataAssistTeamSummaryPayload(input.parsedDraft, input.batchId)
  const importResult = await runTeamSummaryImport(input.supabase, payload, input.action === 'preview' ? 'preview' : 'commit', {
    hasNormalizedPlayerNameColumn: true,
  })

  if (!importResult.ok || importResult.kind !== 'team_summary') {
    return {
      ok: false,
      action: input.action,
      message: importResult.ok ? 'Player Roster import returned an unexpected result.' : importResult.error,
    }
  }

  if (input.action === 'commit') {
    if (importResult.result.failedCount > 0 || importResult.result.totalPlayers === 0) {
      return {
        ok: false,
        action: input.action,
        message: importResult.result.errors[0]?.message || 'Player Roster import did not commit.',
        importResult,
      }
    }

    const importedAt = new Date().toISOString()
    let importedContactCount = 0
    let contactWarning = ''
    try {
      importedContactCount = await upsertCaptainRosterContacts({
        supabase: input.supabase,
        parsedDraft: input.parsedDraft,
        captainUserId: input.reviewedBy,
        batchId: input.batchId,
      })
    } catch (error) {
      contactWarning = error instanceof Error ? error.message : 'Roster contacts could not be saved.'
    }
    const validationSummary = {
      ...(input.validationSummary || {}),
      importSummary: {
        importedAt,
        importResult,
        rosterPlayers: input.parsedDraft.players,
        rosterContacts: input.parsedDraft.contacts,
        importedContactCount,
        contactWarning: contactWarning || null,
      },
    }
    const message = buildTeamSummaryImportedReviewNote(importResult, importedContactCount, contactWarning)
    const [batchUpdate, draftUpdate] = await Promise.all([
      input.supabase
        .from('data_assist_batches')
        .update({
          status: 'imported',
          review_note: message,
          reviewed_by_user_id: input.reviewedBy,
          reviewed_at: importedAt,
        })
        .eq('id', input.batchId),
      input.supabase
        .from('data_assist_drafts')
        .update({
          status: 'imported',
          validation_summary: validationSummary,
          reviewed_by_user_id: input.reviewedBy,
          reviewed_at: importedAt,
        })
        .eq('id', input.draftId),
    ])

    if (batchUpdate.error) return { ok: false, action: input.action, message: batchUpdate.error.message, importResult }
    if (draftUpdate.error) return { ok: false, action: input.action, message: draftUpdate.error.message, importResult }
    await refreshDataAssistContributorStats(input.supabase, input.reviewedBy)

    return {
      ok: true,
      action: input.action,
      importResult,
      importedContactCount,
      contactWarning: contactWarning || undefined,
      message,
    }
  }

  return {
    ok: true,
    action: input.action,
    importResult,
    message: `Roster preview ready. ${importResult.result.totalPlayers} player${importResult.result.totalPlayers === 1 ? '' : 's'} validated.`,
  }
}

async function runDataAssistPlayerRosterContactImportAction(input: {
  supabase: SupabaseClient
  parsedDraft: DataAssistTeamSummaryParsedDraft
  batchId: string
  draftId: string
  reviewedBy: string
  action: DataAssistScorecardImportAction
  validationSummary?: Record<string, unknown> | null
}): Promise<DataAssistTeamSummaryImportActionResult> {
  const detectedContacts = input.parsedDraft.contacts.filter((contact) => Boolean(contact.phone?.trim() || contact.email?.trim())).length

  if (input.action === 'preview') {
    return {
      ok: true,
      action: input.action,
      importedContactCount: detectedContacts,
      message: `Contact preview ready. ${detectedContacts} private team contact${detectedContacts === 1 ? '' : 's'} will be saved without changing the Team Summary.`,
    }
  }

  let importedContactCount = 0
  try {
    importedContactCount = await upsertCaptainRosterContacts({
      supabase: input.supabase,
      parsedDraft: input.parsedDraft,
      captainUserId: input.reviewedBy,
      batchId: input.batchId,
    })
  } catch (error) {
    return {
      ok: false,
      action: input.action,
      message: error instanceof Error ? error.message : 'Team contacts could not be saved.',
    }
  }

  const importedAt = new Date().toISOString()
  const message = importedContactCount
    ? `Data Assist saved ${importedContactCount} private team contact${importedContactCount === 1 ? '' : 's'}. Your Team Summary was not changed.`
    : 'This Player Roster did not include a phone or email detail to save. Your Team Summary was not changed.'
  const validationSummary = {
    ...(input.validationSummary || {}),
    importSummary: {
      importedAt,
      contactOnly: true,
      rosterPlayers: input.parsedDraft.players,
      rosterContacts: input.parsedDraft.contacts,
      importedContactCount,
    },
  }
  const [batchUpdate, draftUpdate] = await Promise.all([
    input.supabase
      .from('data_assist_batches')
      .update({
        status: 'imported',
        review_note: message,
        reviewed_by_user_id: input.reviewedBy,
        reviewed_at: importedAt,
      })
      .eq('id', input.batchId),
    input.supabase
      .from('data_assist_drafts')
      .update({
        status: 'imported',
        validation_summary: validationSummary,
        reviewed_by_user_id: input.reviewedBy,
        reviewed_at: importedAt,
      })
      .eq('id', input.draftId),
  ])

  if (batchUpdate.error) return { ok: false, action: input.action, message: batchUpdate.error.message }
  if (draftUpdate.error) return { ok: false, action: input.action, message: draftUpdate.error.message }
  await refreshDataAssistContributorStats(input.supabase, input.reviewedBy)

  return {
    ok: true,
    action: input.action,
    importedContactCount,
    message,
  }
}

function buildDataAssistTeamSummaryPayload(parsedDraft: DataAssistTeamSummaryParsedDraft, batchId: string) {
  return {
    pageType: 'team_summary',
    teamSummary: {
      rosterTeamName: parsedDraft.rosterTeamName,
      leagueName: parsedDraft.leagueName,
      flight: parsedDraft.flight,
      ustaSection: parsedDraft.ustaSection,
      districtArea: parsedDraft.districtArea,
      teams: parsedDraft.teams,
      players: parsedDraft.players,
      sourceBatchId: batchId,
      source: parsedDraft.rosterSource === 'player_roster'
        ? 'tennislink_player_roster'
        : 'tennislink_team_summary',
    },
  }
}

function buildTeamSummaryImportedReviewNote(
  importResult: Extract<RunImportSuccess, { kind: 'team_summary' }>,
  importedContactCount = 0,
  contactWarning = '',
) {
  const rosterMessage = `Data Assist roster imported ${importResult.result.totalPlayers} player${importResult.result.totalPlayers === 1 ? '' : 's'}: ${importResult.result.createdCount} new, ${importResult.result.updatedCount} updated.`
  if (contactWarning) return `${rosterMessage} Player contact sync needs another try.`
  if (importedContactCount) return `${rosterMessage} ${importedContactCount} contact${importedContactCount === 1 ? '' : 's'} ready for captain messages.`
  return rosterMessage
}

export async function runDataAssistScorecardImportAction(input: {
  supabase: SupabaseClient
  parsedDraft: DataAssistScorecardParsedDraft
  batchId: string
  draftId: string
  reviewedBy: string
  action: DataAssistScorecardImportAction
  validationSummary?: Record<string, unknown> | null
}): Promise<DataAssistScorecardImportActionResult> {
  const importPreview = await buildDataAssistImportPreview({
    supabase: input.supabase,
    parsedDraft: input.parsedDraft,
    batchId: input.batchId,
    reviewedBy: input.reviewedBy,
  })

  if (input.action === 'commit' && importPreview.unresolvedWinnerCount > 0) {
    return {
      ok: false,
      action: input.action,
      message: 'Resolve line winners before committing this Data Assist scorecard.',
      importPreview,
    }
  }

  if (importPreview.duplicateMatch?.status === 'completed' && !importPreview.duplicateMatch.hasChanges) {
    if (input.action === 'commit') {
      const importedAt = new Date().toISOString()
      const message = `Already imported: match ${importPreview.row.externalMatchId} is already in TenAceIQ.`
      const validationSummary = {
        ...(input.validationSummary || {}),
        importSummary: {
          importedAt,
          duplicate: true,
          message,
          playerMappings: importPreview.playerMappings,
        },
      }
      const [batchUpdate, draftUpdate] = await Promise.all([
        input.supabase
          .from('data_assist_batches')
          .update({
            status: 'imported',
            review_note: message,
            reviewed_by_user_id: input.reviewedBy,
            reviewed_at: importedAt,
          })
          .eq('id', input.batchId),
        input.supabase
          .from('data_assist_drafts')
          .update({
            status: 'imported',
            validation_summary: validationSummary,
            reviewed_by_user_id: input.reviewedBy,
            reviewed_at: importedAt,
          })
          .eq('id', input.draftId),
      ])

      if (batchUpdate.error) return { ok: false, action: input.action, message: batchUpdate.error.message, importPreview }
      if (draftUpdate.error) return { ok: false, action: input.action, message: draftUpdate.error.message, importPreview }
      await refreshDataAssistContributorStats(input.supabase, input.reviewedBy)
      await announceScorecardResult(input)
    }

    return {
      ok: true,
      action: input.action,
      message: input.action === 'commit'
        ? `Already imported: match ${importPreview.row.externalMatchId} is already in TenAceIQ.`
        : `Duplicate found: match ${importPreview.row.externalMatchId} is already in TenAceIQ.`,
      importPreview,
    }
  }

  const importResult = await runScorecardImport(
    input.supabase,
    [importPreview.row],
    input.action === 'preview' ? 'preview' : 'commit',
    {
      hasNormalizedPlayerNameColumn: true,
      matchPlayersDeleteBeforeInsert: true,
      scorecardLinesTable: null,
      scorecardReviewTable: null,
    },
  )

  if (!importResult.ok) {
    return {
      ok: false,
      action: input.action,
      message: importResult.error,
      importPreview,
    }
  }

  const scorecardImportResult = importResult as Extract<RunImportSuccess, { kind: 'scorecard' }>

  if (input.action === 'commit') {
    if (
      scorecardImportResult.result.failedCount > 0 ||
      scorecardImportResult.result.successCount + scorecardImportResult.result.updatedCount === 0
    ) {
      return {
        ok: false,
        action: input.action,
        message: scorecardImportResult.result.errors[0]?.message || 'Scorecard import did not commit.',
        importPreview,
        importResult: scorecardImportResult,
      }
    }

    await recalculateDynamicRatings(undefined, input.supabase)
    const importedAt = new Date().toISOString()
    const validationSummary = {
      ...(input.validationSummary || {}),
      importSummary: {
        importedAt,
        importResult: scorecardImportResult,
        playerMappings: importPreview.playerMappings,
      },
    }
    const [batchUpdate, draftUpdate] = await Promise.all([
      input.supabase
        .from('data_assist_batches')
        .update({
          status: 'imported',
          review_note: buildImportedReviewNote(scorecardImportResult),
          reviewed_by_user_id: input.reviewedBy,
          reviewed_at: importedAt,
        })
        .eq('id', input.batchId),
      input.supabase
        .from('data_assist_drafts')
        .update({
          status: 'imported',
          validation_summary: validationSummary,
          reviewed_by_user_id: input.reviewedBy,
          reviewed_at: importedAt,
        })
        .eq('id', input.draftId),
    ])

    if (batchUpdate.error) {
      return { ok: false, action: input.action, message: batchUpdate.error.message, importPreview, importResult: scorecardImportResult }
    }
    if (draftUpdate.error) {
      return { ok: false, action: input.action, message: draftUpdate.error.message, importPreview, importResult: scorecardImportResult }
    }

    await refreshDataAssistContributorStats(input.supabase, input.reviewedBy)
    await announceScorecardResult(input)
  }

  return {
    ok: true,
    action: input.action,
    importPreview,
    importResult: scorecardImportResult,
    message: input.action === 'commit'
      ? buildImportedReviewNote(scorecardImportResult)
      : buildPreviewMessage(importPreview),
  }
}

async function announceScorecardResult(input: {
  supabase: SupabaseClient
  parsedDraft: DataAssistScorecardParsedDraft
  reviewedBy: string
}) {
  try {
    await announceTeamRoomScorecardResult({
      service: input.supabase,
      userId: input.reviewedBy,
      draft: input.parsedDraft,
    })
  } catch {
    // The scorecard stays imported even if Team Room is temporarily unavailable.
  }
}

async function buildDataAssistImportPreview(input: {
  supabase: SupabaseClient
  parsedDraft: DataAssistScorecardParsedDraft
  batchId: string
  reviewedBy: string
}): Promise<DataAssistImportPreview> {
  const importPreview = buildDataAssistScorecardImportRow(input.parsedDraft, {
    reviewedBy: input.reviewedBy,
    sourceBatchId: input.batchId,
  })
  const playerMappings = await buildPlayerMappings(input.supabase, collectDataAssistImportPlayerNames(importPreview.row))
  importPreview.playerMappings = playerMappings
  importPreview.row = applyDataAssistPlayerMappingsToRow(importPreview.row, playerMappings)
  const duplicateMatch = await findExistingCompletedMatch(input.supabase, importPreview.row)
  if (duplicateMatch) importPreview.duplicateMatch = duplicateMatch

  return importPreview
}

async function findExistingCompletedMatch(supabase: SupabaseClient, incomingRow: DataAssistImportPreview['row']) {
  const cleanExternalMatchId = cleanText(incomingRow.externalMatchId)
  if (!cleanExternalMatchId) return null

  const { data } = await supabase
    .from('matches')
    .select('id, external_match_id, status, match_date, home_team, away_team, line_number')
    .eq('external_match_id', cleanExternalMatchId)
    .maybeSingle()

  const row = data as ExistingMatchRow | null
  if (!row || cleanText(row.status) !== 'completed') return null
  const { data: lineData } = await supabase
    .from('matches')
    .select('id,line_number,match_type,winner_side,score')
    .like('external_match_id', `${cleanExternalMatchId}::line:%`)
    .eq('status', 'completed')
  const lines = (lineData ?? []) as ExistingLineRow[]
  const lineIds = lines.map((line) => line.id)
  const { data: matchPlayerData } = lineIds.length
    ? await supabase
        .from('match_players')
        .select('match_id,player_id,side,seat')
        .in('match_id', lineIds)
    : { data: [] }
  const matchPlayers = (matchPlayerData ?? []) as ExistingMatchPlayerRow[]
  const playerIds = Array.from(new Set(matchPlayers.map((player) => player.player_id)))
  const { data: playerData } = playerIds.length
    ? await supabase.from('players').select('id,name').in('id', playerIds)
    : { data: [] }
  const playerNameById = new Map(((playerData ?? []) as Array<{ id: string; name: string | null }>)
    .map((player) => [player.id, cleanText(player.name)]))
  const persistedRow: DataAssistImportPreview['row'] = {
    externalMatchId: cleanExternalMatchId,
    matchDate: cleanText(row.match_date),
    homeTeam: cleanText(row.home_team),
    awayTeam: cleanText(row.away_team),
    lines: lines.map((line) => {
      const players = matchPlayers
        .filter((player) => player.match_id === line.id)
        .sort((left, right) => (left.seat ?? 99) - (right.seat ?? 99))
      return {
        lineNumber: Number(line.line_number) || 0,
        matchType: line.match_type === 'doubles' ? 'doubles' : 'singles',
        sideAPlayers: players.filter((player) => player.side === 'A').map((player) => playerNameById.get(player.player_id) || ''),
        sideBPlayers: players.filter((player) => player.side === 'B').map((player) => playerNameById.get(player.player_id) || ''),
        winnerSide: line.winner_side,
        score: line.score,
      }
    }),
  }
  return {
    externalMatchId: cleanText(row.external_match_id),
    status: cleanText(row.status),
    matchDate: cleanText(row.match_date),
    homeTeam: cleanText(row.home_team),
    awayTeam: cleanText(row.away_team),
    hasChanges: buildScorecardImportFingerprint(persistedRow) !== buildScorecardImportFingerprint(incomingRow),
  }
}

async function buildPlayerMappings(
  supabase: SupabaseClient,
  names: string[],
): Promise<DataAssistImportPlayerMapping[]> {
  if (!names.length) return []

  const { data } = await supabase
    .from('players')
    .select('id, name, normalized_name')
    .limit(5000)

  const players = ((data || []) as PlayerRow[])
    .map((player) => ({
      id: cleanText(player.id),
      name: cleanText(player.name),
      normalizedName: cleanText(player.normalized_name) || normalizeName(cleanText(player.name)),
    }))
    .filter((player) => player.id && player.name)

  return names.map((name) => {
    const normalized = normalizeName(name)
    const exact = players.find((player) => player.normalizedName === normalized || normalizeName(player.name) === normalized)
    if (exact) {
      return {
        name,
        status: 'exact',
        matchedPlayerId: exact.id,
        matchedPlayerName: exact.name,
        matchConfidence: 1,
        matchReason: 'Exact player name match',
      }
    }

    const likely = players
      .map((player) => {
        const distance = levenshteinDistance(player.normalizedName, normalized)
        const contains = player.normalizedName.includes(normalized) || normalized.includes(player.normalizedName)
        return {
          player,
          score: contains ? 0.88 : distance <= 2 ? 0.82 : 0,
          reason: contains ? 'Contained name match' : distance <= 2 ? 'Near spelling match' : '',
        }
      })
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)[0]

    if (likely) {
      return {
        name,
        status: 'likely',
        matchedPlayerId: likely.player.id,
        matchedPlayerName: likely.player.name,
        matchConfidence: likely.score,
        matchReason: likely.reason,
      }
    }

    return {
      name,
      status: 'unknown',
      matchedPlayerId: '',
      matchedPlayerName: '',
      matchConfidence: 0,
      matchReason: 'New player will be created if the scorecard is committed',
    }
  })
}

async function refreshDataAssistContributorStats(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from('data_assist_batches')
    .select('status, reviewed_at')
    .eq('submitted_by_user_id', profileId)

  if (error) throw new Error(error.message)

  const rows = (data || []) as StatsBatchRow[]
  const verifiedRows = rows.filter((row) => row.status === 'verified' || row.status === 'imported')
  const rejectedRows = rows.filter((row) => row.status === 'rejected')
  const pendingRows = rows.filter((row) => row.status !== 'verified' && row.status !== 'imported' && row.status !== 'rejected')
  const reviewedCount = verifiedRows.length + rejectedRows.length
  const accuracyScore = reviewedCount ? Math.round((verifiedRows.length / reviewedCount) * 100) / 100 : 0
  const badges = getContributorBadges(verifiedRows.length, accuracyScore)

  const { error: upsertError } = await supabase
    .from('data_assist_contributor_stats')
    .upsert({
      profile_id: profileId,
      verified_import_count: verifiedRows.length,
      rejected_import_count: rejectedRows.length,
      pending_review_count: pendingRows.length,
      contribution_accuracy_score: accuracyScore,
      admin_verified_imports: verifiedRows.length,
      badges,
      last_verified_at: latestReviewedAt(verifiedRows),
      last_rejected_at: latestReviewedAt(rejectedRows),
    })

  if (upsertError) throw new Error(upsertError.message)
}

function buildPreviewMessage(importPreview: DataAssistImportPreview) {
  const likelyPlayerCount = importPreview.playerMappings.filter((mapping) => mapping.status === 'likely').length
  const newPlayerCount = importPreview.playerMappings.filter((mapping) => mapping.status === 'unknown').length
  if (importPreview.unresolvedWinnerCount) {
    return `Import preview ready, but ${importPreview.unresolvedWinnerCount} winner${importPreview.unresolvedWinnerCount === 1 ? '' : 's'} need resolution before commit.`
  }
  if (likelyPlayerCount || newPlayerCount) {
    return `Import preview ready. ${likelyPlayerCount} likely player match${likelyPlayerCount === 1 ? '' : 'es'} and ${newPlayerCount} new player${newPlayerCount === 1 ? '' : 's'} were prepared.`
  }
  return 'Import preview ready. This scorecard can be committed.'
}

function buildImportedReviewNote(importResult: Extract<RunImportSuccess, { kind: 'scorecard' }>) {
  const createdPlayers = importResult.result.createdPlayersCount
  const linkedPlayers = importResult.result.linkedPlayersCount
  const resultLabel = importResult.result.updatedCount > 0 ? 'Scorecard corrected.' : 'Scorecard imported.'
  return `${resultLabel} ${linkedPlayers} player link${linkedPlayers === 1 ? '' : 's'} refreshed${createdPlayers ? `; ${createdPlayers} new player${createdPlayers === 1 ? '' : 's'} created` : ''}. Schedule and roster uploads can be added later, but this result is ready now.`
}

function getContributorBadges(verifiedImportCount: number, accuracyScore: number) {
  const badges: Array<{ id: string; label: string; detail: string }> = []
  if (verifiedImportCount >= 1) {
    badges.push({
      id: 'first_import',
      label: 'First Import',
      detail: 'First verified Data Assist upload.',
    })
  }
  if (verifiedImportCount >= 3 && accuracyScore >= 0.75) {
    badges.push({
      id: 'verified_contributor',
      label: 'Verified Contributor',
      detail: 'Three approved uploads with strong accuracy.',
    })
  }
  if (verifiedImportCount >= 8 && accuracyScore >= 0.8) {
    badges.push({
      id: 'community_scout',
      label: 'Community Scout',
      detail: 'Consistently improves local tennis intelligence.',
    })
  }
  return badges
}

function latestReviewedAt(rows: StatsBatchRow[]) {
  return rows
    .map((row) => cleanText(row.reviewed_at))
    .filter(Boolean)
    .sort()
    .at(-1) || null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function levenshteinDistance(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  return matrix[a.length][b.length]
}
