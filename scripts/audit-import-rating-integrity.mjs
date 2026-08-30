import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://pwxppfazbyourjrsutgx.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
}

const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: drafts, error: draftsError } = await supabase
  .from('data_assist_drafts')
  .select('id, updated_at, parsed_payload, validation_summary')
  .eq('draft_type', 'team_summary')
  .eq('status', 'imported')
  .order('updated_at', { ascending: false })
  .limit(100)

if (draftsError) throw new Error(`Could not load imported roster drafts: ${draftsError.message}`)

const expectedByPlayer = new Map()

for (const draft of drafts ?? []) {
  const validationSummary = asRecord(draft.validation_summary)
  const importSummary = asRecord(validationSummary.importSummary)
  const parsedPayload = asRecord(draft.parsed_payload)
  const rosterTeamName = cleanText(parsedPayload.rosterTeamName)
  const leagueName = cleanText(parsedPayload.leagueName)
  const flight = cleanText(parsedPayload.flight)
  const rosterPlayers = Array.isArray(importSummary.rosterPlayers)
    ? importSummary.rosterPlayers
    : Array.isArray(parsedPayload.players)
      ? parsedPayload.players
      : []

  for (const value of rosterPlayers) {
    const player = asRecord(value)
    const name = cleanText(player.name)
    const rating = toRating(player.ntrp)
    const key = normalizeName(name)
    if (!name || rating === null || expectedByPlayer.has(key)) continue
    expectedByPlayer.set(key, {
      draftId: draft.id,
      importedAt: draft.updated_at,
      name,
      expectedRating: rating,
      rosterTeamName: cleanText(player.teamName) || rosterTeamName,
      leagueName,
      flight,
    })
  }
}

const names = [...expectedByPlayer.values()].map((entry) => entry.name)
const storedPlayers = []

for (const chunk of chunks([...expectedByPlayer.keys()], 100)) {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, normalized_name, singles_rating, doubles_rating, overall_rating, rating_source')
    .in('normalized_name', chunk)
  if (error) throw new Error(`Could not load stored players: ${error.message}`)
  storedPlayers.push(...(data ?? []))
}

const resolvedNormalizedNames = new Set(storedPlayers.map((player) => normalizeName(player.normalized_name || player.name)))
for (const chunk of chunks(names.filter((name) => !resolvedNormalizedNames.has(normalizeName(name))), 100)) {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, normalized_name, singles_rating, doubles_rating, overall_rating, rating_source')
    .in('name', chunk)
  if (error) throw new Error(`Could not load stored players by exact name: ${error.message}`)
  storedPlayers.push(...(data ?? []))
}

const storedPlayersByName = new Map()
for (const player of storedPlayers) {
  const key = normalizeName(player.normalized_name || player.name)
  const rows = storedPlayersByName.get(key) ?? []
  rows.push(player)
  storedPlayersByName.set(key, rows)
}
const storedByPlayer = new Map([...storedPlayersByName].map(([key, players]) => [key, players[0]]))
const mismatches = []

const storedPlayerIds = storedPlayers.map((player) => player.id)
const rosterMemberships = []
for (const chunk of chunks(storedPlayerIds, 100)) {
  const { data, error } = await supabase
    .from('team_roster_members')
    .select('player_id, team_name, league_name, flight, ntrp, rating_source, updated_at')
    .in('player_id', chunk)
  if (error) throw new Error(`Could not load stored roster memberships: ${error.message}`)
  rosterMemberships.push(...(data ?? []))
}

const rosterByPlayerId = new Map()
for (const membership of rosterMemberships) {
  const rows = rosterByPlayerId.get(membership.player_id) ?? []
  rows.push(membership)
  rosterByPlayerId.set(membership.player_id, rows)
}

for (const expected of expectedByPlayer.values()) {
  const duplicatePlayers = storedPlayersByName.get(normalizeName(expected.name)) ?? []
  if (duplicatePlayers.length > 1) {
    mismatches.push({
      ...expected,
      issue: 'duplicate_player_identity',
      storedRating: null,
      duplicateRecords: duplicatePlayers.map((player) => ({
        playerId: player.id,
        singlesRating: player.singles_rating,
        doublesRating: player.doubles_rating,
        overallRating: player.overall_rating,
        ratingSource: player.rating_source,
      })),
    })
  }
  const stored = storedByPlayer.get(normalizeName(expected.name))
  if (!stored) {
    mismatches.push({ ...expected, issue: 'missing_player', storedRating: null })
    continue
  }

  const storedRatings = [stored.singles_rating, stored.doubles_rating, stored.overall_rating].map(toRating)
  if (storedRatings.some((rating) => rating !== expected.expectedRating)) {
    mismatches.push({
      ...expected,
      issue: 'player_rating_mismatch',
      storedRating: stored.overall_rating,
      storedSinglesRating: stored.singles_rating,
      storedDoublesRating: stored.doubles_rating,
      ratingSource: stored.rating_source,
    })
  }

  const matchingMembership = (rosterByPlayerId.get(stored.id) ?? []).find((membership) => (
    (!expected.rosterTeamName || normalizeName(membership.team_name) === normalizeName(expected.rosterTeamName)) &&
    (!expected.leagueName || cleanText(membership.league_name) === expected.leagueName) &&
    (!expected.flight || cleanText(membership.flight) === expected.flight)
  ))
  if (!matchingMembership) {
    mismatches.push({
      ...expected,
      issue: 'missing_roster_membership',
      storedRating: null,
      availableMemberships: (rosterByPlayerId.get(stored.id) ?? []).map((membership) => ({
        teamName: membership.team_name,
        leagueName: membership.league_name,
        flight: membership.flight,
        rating: membership.ntrp,
      })),
    })
  } else if (toRating(matchingMembership.ntrp) !== expected.expectedRating) {
    mismatches.push({
      ...expected,
      issue: 'roster_rating_mismatch',
      storedRating: matchingMembership.ntrp,
      ratingSource: matchingMembership.rating_source,
    })
  }
}

const { data: allRosterMemberships, error: allRosterError } = await supabase
  .from('team_roster_members')
  .select('player_id, player_name, team_name, league_name, flight, ntrp, rating_source, updated_at')
  .not('ntrp', 'is', null)
  .order('updated_at', { ascending: false })
  .limit(5000)
if (allRosterError) throw new Error(`Could not load roster rating evidence: ${allRosterError.message}`)

const allRosterPlayerIds = [...new Set((allRosterMemberships ?? []).map((row) => row.player_id).filter(Boolean))]
const allRosterPlayers = []
for (const chunk of chunks(allRosterPlayerIds, 100)) {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, singles_rating, doubles_rating, overall_rating, rating_source')
    .in('id', chunk)
  if (error) throw new Error(`Could not load roster-linked players: ${error.message}`)
  allRosterPlayers.push(...(data ?? []))
}
const allRosterPlayerById = new Map(allRosterPlayers.map((player) => [player.id, player]))
const storedRosterRatingMismatches = (allRosterMemberships ?? []).flatMap((membership) => {
  const player = allRosterPlayerById.get(membership.player_id)
  const rosterRating = toRating(membership.ntrp)
  const playerRating = toRating(player?.overall_rating)
  if (!player || rosterRating === playerRating) return []
  return [{
    playerId: membership.player_id,
    name: membership.player_name || player.name,
    rosterRating,
    playerRating,
    teamName: membership.team_name,
    leagueName: membership.league_name,
    flight: membership.flight,
    rosterUpdatedAt: membership.updated_at,
  }]
})

const { data: triLevelMatches, error: triLevelMatchesError } = await supabase
  .from('matches')
  .select('id, external_match_id, league_name, flight, line_number')
  .ilike('league_name', '%tri-level%')
  .not('line_number', 'is', null)
  .limit(5000)
if (triLevelMatchesError) throw new Error(`Could not load Tri-Level match lines: ${triLevelMatchesError.message}`)

const triLevelMatchIds = (triLevelMatches ?? []).map((match) => match.id)
const triLevelMatchPlayers = []
for (const chunk of chunks(triLevelMatchIds, 100)) {
  const { data, error } = await supabase.from('match_players').select('match_id, player_id').in('match_id', chunk)
  if (error) throw new Error(`Could not load Tri-Level match players: ${error.message}`)
  triLevelMatchPlayers.push(...(data ?? []))
}
const triLevelPlayerIds = [...new Set(triLevelMatchPlayers.map((row) => row.player_id).filter(Boolean))]
const triLevelPlayers = []
for (const chunk of chunks(triLevelPlayerIds, 100)) {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, overall_rating, rating_source')
    .in('id', chunk)
  if (error) throw new Error(`Could not load Tri-Level player ratings: ${error.message}`)
  triLevelPlayers.push(...(data ?? []))
}
const triLevelMatchById = new Map((triLevelMatches ?? []).map((match) => [match.id, match]))
const triLevelPlayerById = new Map(triLevelPlayers.map((player) => [player.id, player]))
const triLevelLineRatingMismatches = triLevelMatchPlayers.flatMap((link) => {
  const match = triLevelMatchById.get(link.match_id)
  const player = triLevelPlayerById.get(link.player_id)
  const flightRatings = extractRatings(match?.flight).sort((left, right) => right - left)
  const lineNumber = Number.parseInt(cleanText(match?.line_number), 10)
  const expectedRating = flightRatings.length >= lineNumber ? flightRatings[lineNumber - 1] : null
  const playerRating = toRating(player?.overall_rating)
  if (!match || !player || expectedRating === null || playerRating === expectedRating) return []
  return [{
    externalMatchId: match.external_match_id,
    lineNumber,
    flight: match.flight,
    playerId: player.id,
    name: player.name,
    expectedRating,
    playerRating,
    ratingSource: player.rating_source,
  }]
})

console.log(JSON.stringify({
  importedDraftsChecked: drafts?.length ?? 0,
  ratedPlayersChecked: expectedByPlayer.size,
  mismatchCount: mismatches.length,
  mismatches,
  storedRosterRatingMismatchCount: storedRosterRatingMismatches.length,
  storedRosterRatingMismatches,
  triLevelLineRatingMismatchCount: triLevelLineRatingMismatches.length,
  triLevelAffectedPlayerCount: new Set(triLevelLineRatingMismatches.map((row) => row.playerId)).size,
  triLevelLineRatingMismatches,
}, null, 2))

if (mismatches.length > 0 || storedRosterRatingMismatches.length > 0 || triLevelLineRatingMismatches.length > 0) process.exitCode = 1

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizeName(value) {
  return cleanText(value).toLowerCase()
}

function toRating(value) {
  const rating = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(rating) ? rating : null
}

function extractRatings(value) {
  const ratings = new Set()
  for (const match of cleanText(value).matchAll(/(?:^|\b)([1-7](?:\.[05])?)(?:\b|$)/g)) {
    const rating = toRating(match[1])
    if (rating !== null) ratings.add(rating)
  }
  return [...ratings]
}

function chunks(values, size) {
  const result = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}
