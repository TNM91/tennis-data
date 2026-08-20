import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  parseScoreMetrics,
  recalculateDynamicRatings,
  type MatchRow,
} from '../lib/recalculateRatings'
import { parseTennisScoreSets, validateTiqTennisMatchScore } from '../lib/tiq-scoring'

const SUPABASE_URL = 'https://pwxppfazbyourjrsutgx.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const APPLY = process.argv.includes('--apply')
const PAGE_SIZE = 1000

const EXPECTED_RATINGS = new Map<string, number>([
  ['1170da17-7777-4d83-92b4-0af0208228a9', 4.5],
  ['ef83846f-a698-422f-9b55-479a48e6b281', 4.5],
  ['d8778639-672f-40fb-a7ad-e6a25cf1dd6c', 4.5],
  ['4e8f1585-a05d-4e73-8d4c-b573e2035243', 4.5],
  ['2550ade3-c77f-4255-aacf-976d0b057abb', 4.0],
  ['96f64e04-561a-4d02-867f-08ab1cfd2888', 4.0],
  ['34d1c376-b83f-4761-a554-af642d9b2b5f', 4.0],
  ['842f7c09-62ef-4bee-82f1-8d4f1a045371', 4.0],
  ['99177a48-8e0f-44eb-81f5-bbc1085f906e', 4.5],
  ['f9a5b8aa-d386-48b0-b3b3-ee90af5167f5', 4.5],
  ['50064a85-fe95-4d10-bc4c-f94caf1ac472', 4.0],
  ['6bf13316-7a48-4465-b045-01eebbcd86b8', 4.0],
  ['eac6bde9-db14-428b-aa21-3aba0b98d338', 4.5],
  ['09f0fa7e-5e7f-4a2f-85e8-1afeaa5f7c00', 4.5],
  ['98eb1c04-faa8-45a5-8067-102d1bef49ae', 4.0],
])

const EVIDENCE_MATCH_ROOTS = ['1012101421', '1012101422', '1012101423']
const CHRISTOPHER_KRIEGER = 'christopher krieger'

if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const auditNow = Date.now()

async function main() {
const evidence = await loadAndValidateLineEvidence(supabase)
const currentPlayers = await loadPlayers(supabase)
const currentById = new Map(currentPlayers.map((player) => [String(player.id), player]))
const intendedChanges = [...EXPECTED_RATINGS].flatMap(([playerId, expectedRating]) => {
  const player = currentById.get(playerId)
  if (!player) throw new Error(`Expected repair player is missing: ${playerId}`)
  const ratings = [player.singles_rating, player.doubles_rating, player.overall_rating].map(toNumber)
  if (ratings.every((rating) => rating === expectedRating)) return []
  return [{
    playerId,
    name: player.name,
    expectedRating,
    before: {
      singles: player.singles_rating,
      doubles: player.doubles_rating,
      overall: player.overall_rating,
      source: player.rating_source,
    },
  }]
})
const rosterRepair = await resolveChristopherRosterRepair(supabase)
const eligibleMatches = await loadEligibleMatches(supabase)
const intendedScoreChanges = eligibleMatches.flatMap(buildScoreOrientationRepair)
const dryRun = await recalculateDynamicRatings(undefined, supabase, { dryRun: true, now: auditNow })
const auditBefore = buildRatingAudit(currentPlayers, eligibleMatches, dryRun)

if (!APPLY) {
  console.log(JSON.stringify({
    mode: 'dry-run',
    lineEvidenceRows: evidence.length,
    intendedPlayerChanges: intendedChanges,
    intendedScoreChanges,
    rosterRepair,
    ratingAudit: auditBefore,
    nextStep: 'Run with --apply only after the dual-track snapshot migration is present.',
  }, null, 2))
  process.exit(0)
}

const backupPath = await writeBackup(supabase, {
  auditNow,
  evidence,
  intendedChanges,
  intendedScoreChanges,
  rosterRepair,
  auditBefore,
})

for (const expectedRating of [4.0, 4.5]) {
  const ids = [...EXPECTED_RATINGS]
    .filter(([, rating]) => rating === expectedRating)
    .map(([playerId]) => playerId)
  const { data, error } = await supabase
    .from('players')
    .update({
      singles_rating: expectedRating,
      doubles_rating: expectedRating,
      overall_rating: expectedRating,
      usta_base_updated_at: new Date(auditNow).toISOString(),
    })
    .in('id', ids)
    .select('id')
  if (error) throw new Error(`Failed to update ${expectedRating.toFixed(1)} baselines: ${error.message}`)
  if ((data ?? []).length !== ids.length) {
    throw new Error(`Updated ${(data ?? []).length} of ${ids.length} expected ${expectedRating.toFixed(1)} players`)
  }
}

if (rosterRepair.action === 'insert') {
  const { error } = await supabase
    .from('team_roster_members')
    .upsert(rosterRepair.payload, {
      onConflict: 'normalized_team_name,player_id,league_name,flight',
    })
  if (error) throw new Error(`Failed to repair Christopher Krieger roster membership: ${error.message}`)
}

for (const scoreChange of intendedScoreChanges) {
  const { data, error } = await supabase
    .from('matches')
    .update({ score: scoreChange.after })
    .eq('id', scoreChange.matchId)
    .select('id')
  if (error) throw new Error(`Failed to orient score for ${scoreChange.matchId}: ${error.message}`)
  if ((data ?? []).length !== 1) throw new Error(`Score repair did not update ${scoreChange.matchId}`)
}

const appliedRecalculation = await recalculateDynamicRatings(undefined, supabase, { now: auditNow })
const playersAfter = await loadPlayers(supabase)
const dryRunAfter = await recalculateDynamicRatings(undefined, supabase, { dryRun: true, now: auditNow })
const eligibleMatchesAfter = await loadEligibleMatches(supabase)
const auditAfter = buildRatingAudit(playersAfter, eligibleMatchesAfter, dryRunAfter)
const repairedById = new Map(playersAfter.map((player) => [String(player.id), player]))

for (const [playerId, expectedRating] of EXPECTED_RATINGS) {
  const player = repairedById.get(playerId)
  const ratings = [player?.singles_rating, player?.doubles_rating, player?.overall_rating].map(toNumber)
  if (!player || !ratings.every((rating) => rating === expectedRating)) {
    throw new Error(`Post-write verification failed for ${playerId}; expected ${expectedRating.toFixed(1)}`)
  }
}

if (auditAfter.dynamicDriftCount !== 0) {
  throw new Error(`Post-write verification found ${auditAfter.dynamicDriftCount} stored dynamic rating drifts`)
}
if (auditAfter.scoreAudit.unparsed !== 0) {
  throw new Error(`Post-write verification found ${auditAfter.scoreAudit.unparsed} unparsed eligible scores`)
}

console.log(JSON.stringify({
  mode: 'applied',
  backupPath,
  repairedPlayerCount: EXPECTED_RATINGS.size,
  changedPlayerCount: intendedChanges.length,
  rosterRepairApplied: rosterRepair.action === 'insert',
  reorientedScoreCount: intendedScoreChanges.length,
  recalculation: {
    eligibleMatchCount: appliedRecalculation.eligibleMatchCount,
    processedMatchCount: appliedRecalculation.processedMatchCount,
    snapshotCount: appliedRecalculation.snapshots.length,
    skippedMatches: appliedRecalculation.skippedMatches,
  },
  ratingAuditBefore: auditBefore,
  ratingAuditAfter: auditAfter,
}, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

async function loadAndValidateLineEvidence(client: SupabaseClient) {
  const externalIds = EVIDENCE_MATCH_ROOTS.flatMap((root) => (
    [1, 2, 3].map((line) => `${root}::line:${line}`)
  ))
  const { data: matches, error: matchError } = await client
    .from('matches')
    .select('id, external_match_id, flight, line_number')
    .in('external_match_id', externalIds)
  if (matchError) throw new Error(`Could not load repair match evidence: ${matchError.message}`)

  const matchIds = (matches ?? []).map((match) => match.id)
  const { data: participants, error: participantError } = await client
    .from('match_players')
    .select('match_id, player_id, side, seat')
    .in('match_id', matchIds)
  if (participantError) throw new Error(`Could not load repair participant evidence: ${participantError.message}`)

  const matchById = new Map((matches ?? []).map((match) => [match.id, match]))
  const rows = (participants ?? []).flatMap((participant) => {
    const match = matchById.get(participant.match_id)
    const lineNumber = Number.parseInt(cleanText(match?.line_number), 10)
    const flightRatings = extractRatings(match?.flight).sort((a, b) => b - a)
    const expectedRating = flightRatings[lineNumber - 1]
    if (!match || !Number.isFinite(expectedRating)) return []
    return [{ ...participant, externalMatchId: match.external_match_id, lineNumber, expectedRating }]
  })

  for (const [playerId, expectedRating] of EXPECTED_RATINGS) {
    const supportingRows = rows.filter((row) => row.player_id === playerId)
    if (supportingRows.length === 0) throw new Error(`No Tri-Level line evidence found for ${playerId}`)
    if (supportingRows.some((row) => row.expectedRating !== expectedRating)) {
      throw new Error(`Conflicting Tri-Level line evidence found for ${playerId}`)
    }
  }

  return rows.filter((row) => EXPECTED_RATINGS.has(row.player_id))
}

async function resolveChristopherRosterRepair(client: SupabaseClient) {
  const { data: players, error: playerError } = await client
    .from('players')
    .select('id, name, normalized_name')
    .eq('normalized_name', CHRISTOPHER_KRIEGER)
  if (playerError) throw new Error(`Could not resolve Christopher Krieger: ${playerError.message}`)
  if ((players ?? []).length !== 1) throw new Error(`Expected one Christopher Krieger player, found ${(players ?? []).length}`)
  const player = players![0]

  const { data: drafts, error: draftError } = await client
    .from('data_assist_drafts')
    .select('id, updated_at, parsed_payload, validation_summary')
    .eq('draft_type', 'team_summary')
    .eq('status', 'imported')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (draftError) throw new Error(`Could not load roster evidence: ${draftError.message}`)

  let evidence: Record<string, unknown> | null = null
  for (const draft of drafts ?? []) {
    const parsed = asRecord(draft.parsed_payload)
    const validation = asRecord(draft.validation_summary)
    const summary = asRecord(validation.importSummary)
    const rosterPlayers = Array.isArray(summary.rosterPlayers)
      ? summary.rosterPlayers
      : Array.isArray(parsed.players) ? parsed.players : []
    const found = rosterPlayers.map(asRecord).find((entry) => normalizeName(entry.name) === CHRISTOPHER_KRIEGER)
    if (!found) continue
    evidence = {
      draftId: draft.id,
      updatedAt: draft.updated_at,
      teamName: cleanText(found.teamName) || cleanText(parsed.rosterTeamName),
      leagueName: cleanText(parsed.leagueName),
      flight: cleanText(parsed.flight),
      ustaSection: cleanText(parsed.ustaSection) || null,
      districtArea: cleanText(parsed.districtArea) || null,
      source: cleanText(parsed.source) || 'data_assist_team_summary',
      ntrp: toNumber(found.ntrp),
      ageDivision: cleanText(found.ageDivision) || null,
    }
    break
  }
  if (!evidence || toNumber(evidence.ntrp) !== 4.5 || !cleanText(evidence.teamName)) {
    throw new Error('Verified 4.5 roster evidence for Christopher Krieger was not found')
  }

  const { data: memberships, error: membershipError } = await client
    .from('team_roster_members')
    .select('*')
    .eq('player_id', player.id)
  if (membershipError) throw new Error(`Could not inspect Christopher Krieger memberships: ${membershipError.message}`)
  const exists = (memberships ?? []).some((membership) => (
    normalizeName(membership.team_name) === normalizeName(evidence!.teamName) &&
    cleanText(membership.league_name) === cleanText(evidence!.leagueName) &&
    cleanText(membership.flight) === cleanText(evidence!.flight)
  ))
  const payload = {
    team_name: cleanText(evidence.teamName),
    normalized_team_name: normalizeName(evidence.teamName),
    player_id: player.id,
    player_name: player.name,
    league_name: cleanText(evidence.leagueName),
    flight: cleanText(evidence.flight),
    usta_section: evidence.ustaSection,
    district_area: evidence.districtArea,
    source: evidence.source,
    ntrp: 4.5,
    rating_source: 'verified',
    mixed_pair_role: 'unknown',
    age_division: evidence.ageDivision,
    eligibility_verified_at: new Date(auditNow).toISOString(),
  }
  return { action: exists ? 'none' as const : 'insert' as const, player, evidence, payload, memberships }
}

function buildRatingAudit(
  storedPlayers: Array<Record<string, unknown>>,
  matches: MatchRow[],
  calculation: Awaited<ReturnType<typeof recalculateDynamicRatings>>,
) {
  const calculatedById = new Map(calculation.players.map((player) => [player.id, player]))
  const invalidBasePlayers = storedPlayers.flatMap((player) => {
    const values = [player.singles_rating, player.doubles_rating, player.overall_rating].map(toNumber)
    return values.some((value) => value === null || value < 1.5 || value > 7)
      ? [{ id: player.id, name: player.name, ratings: values }]
      : []
  })
  const dynamicDrifts = storedPlayers.flatMap<Record<string, unknown>>((player) => {
    const calculated = calculatedById.get(String(player.id))
    if (!calculated) return [{ id: player.id, name: player.name, issue: 'missing-from-calculation' }]
    const fields: Array<[string, unknown, number]> = [
      ['singles_dynamic_rating', player.singles_dynamic_rating, calculated.singlesDynamic],
      ['doubles_dynamic_rating', player.doubles_dynamic_rating, calculated.doublesDynamic],
      ['overall_dynamic_rating', player.overall_dynamic_rating, calculated.overallDynamic],
      ['singles_usta_dynamic_rating', player.singles_usta_dynamic_rating, calculated.singlesUstaDynamic],
      ['doubles_usta_dynamic_rating', player.doubles_usta_dynamic_rating, calculated.doublesUstaDynamic],
      ['overall_usta_dynamic_rating', player.overall_usta_dynamic_rating, calculated.overallUstaDynamic],
    ]
    const drifted = fields.filter(([, stored, expected]) => {
      const storedNumber = toNumber(stored)
      return storedNumber === null || Math.abs(storedNumber - expected) > 0.0005
    })
    return drifted.length > 0 ? [{
      id: player.id,
      name: player.name,
      fields: drifted.map(([field, stored, expected]) => ({ field, stored, expected })),
    }] : []
  })
  const scoreAudit = matches.reduce((result, match) => {
    const parsed = parseScoreMetrics(match.score, match.winner_side).parsed
    if (parsed) result.parsed += 1
    else if (!cleanText(match.score)) result.missing += 1
    else if (/W\/?O|DEF|RET|ABD|CANC|BYE/i.test(cleanText(match.score))) result.special += 1
    else result.unparsed += 1
    return result
  }, { parsed: 0, missing: 0, special: 0, unparsed: 0 })
  const expectedSnapshotCount = matches
    .filter((match) => !calculation.skippedMatches.some((skipped) => skipped.matchId === match.id))
    .reduce((sum, match) => {
      const perTrack = match.match_type === 'singles' ? 4 : 8
      return sum + perTrack * ((match.match_source ?? 'usta') === 'usta' ? 2 : 1)
    }, 0)
  return {
    playerCount: storedPlayers.length,
    eligibleMatchCount: calculation.eligibleMatchCount,
    processedMatchCount: calculation.processedMatchCount,
    skippedMatchCount: calculation.skippedMatches.length,
    skippedMatches: calculation.skippedMatches,
    invalidBasePlayerCount: invalidBasePlayers.length,
    invalidBasePlayers: invalidBasePlayers.slice(0, 25),
    dynamicDriftCount: dynamicDrifts.length,
    dynamicDrifts: dynamicDrifts.slice(0, 25),
    expectedSnapshotCount,
    calculatedSnapshotCount: calculation.snapshots.length,
    snapshotCountMatches: expectedSnapshotCount === calculation.snapshots.length,
    scoreAudit,
    unparsedScoreExamples: matches
      .filter((match) => cleanText(match.score) && !parseScoreMetrics(match.score, match.winner_side).parsed)
      .slice(0, 20)
      .map((match) => ({ id: match.id, score: match.score, winnerSide: match.winner_side })),
  }
}

async function writeBackup(client: SupabaseClient, context: Record<string, unknown>) {
  const players = await loadPlayers(client)
  const matches = await loadAll(client, 'matches', '*', 'id')
  const snapshots = await loadAll(client, 'rating_snapshots', '*', 'id')
  const roster = await loadAll(client, 'team_roster_members', '*', 'id')
  const timestamp = new Date(auditNow).toISOString().replace(/[:.]/g, '-')
  const outputDirectory = path.resolve('output', 'data-integrity')
  const outputPath = path.join(outputDirectory, `trilevel-rating-repair-before-${timestamp}.json`)
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(outputPath, JSON.stringify({
    createdAt: new Date(auditNow).toISOString(),
    purpose: 'Before-state backup for Tri-Level baseline repair and full dynamic recalculation',
    context,
    players,
    matches,
    ratingSnapshots: snapshots,
    teamRosterMembers: roster,
  }, null, 2), 'utf8')
  return outputPath
}

function buildScoreOrientationRepair(match: MatchRow) {
  const parsedSets = parseTennisScoreSets(match.score)
  if (parsedSets.length < 2) return []
  const sideAWins = parsedSets.filter((set) => set.sideAGames > set.sideBGames).length
  const sideBWins = parsedSets.filter((set) => set.sideBGames > set.sideAGames).length
  const winnerWins = match.winner_side === 'A' ? sideAWins : sideBWins
  const loserWins = match.winner_side === 'A' ? sideBWins : sideAWins
  if (winnerWins >= loserWins) return []

  const corrected = parsedSets
    .map((set) => `${set.sideBGames}-${set.sideAGames}`)
    .join(' ')
  const validation = validateTiqTennisMatchScore(corrected, match.winner_side)
  if (!validation.valid) {
    throw new Error(`Cannot safely reorient score for ${match.id}: ${validation.message}`)
  }
  return [{ matchId: match.id, winnerSide: match.winner_side, before: match.score, after: corrected }]
}

async function loadPlayers(client: SupabaseClient) {
  return loadAll(client, 'players', [
    'id', 'name', 'normalized_name', 'singles_rating', 'doubles_rating', 'overall_rating',
    'singles_dynamic_rating', 'doubles_dynamic_rating', 'overall_dynamic_rating',
    'singles_usta_dynamic_rating', 'doubles_usta_dynamic_rating', 'overall_usta_dynamic_rating',
    'rating_source', 'usta_base_updated_at',
  ].join(','), 'id')
}

async function loadEligibleMatches(client: SupabaseClient): Promise<MatchRow[]> {
  const rows: MatchRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('matches')
      .select('id,match_date,match_type,score,winner_side,match_source,rating_eligible,created_at')
      .not('match_type', 'is', null)
      .not('winner_side', 'is', null)
      .eq('rating_eligible', true)
      .order('match_date', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Could not load eligible matches: ${error.message}`)
    const page = (data ?? []) as MatchRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

async function loadAll(client: SupabaseClient, table: string, columns: string, orderColumn: string) {
  const rows: Array<Record<string, unknown>> = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Could not load ${table}: ${error.message}`)
    const page = (data ?? []) as unknown as Array<Record<string, unknown>>
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeName(value: unknown) {
  return cleanText(value).toLowerCase()
}

function toNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function extractRatings(value: unknown) {
  const ratings = new Set<number>()
  for (const match of cleanText(value).matchAll(/(?:^|\b)([1-7](?:\.[05])?)(?:\b|$)/g)) {
    const rating = toNumber(match[1])
    if (rating !== null) ratings.add(rating)
  }
  return [...ratings]
}
