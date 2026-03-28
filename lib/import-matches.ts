import type { SupabaseClient } from '@supabase/supabase-js';

type MatchResult = 'W' | 'L';

type PlayerRow = {
  id: string;
  name: string;
  rating: number | null;
  dynamic_rating: number | null;
  location: string | null;
};

type MatchInsertRow = {
  player_id: string;
  opponent_id: string;
  opponent: string;
  result: MatchResult;
  date: string;
};

export type ImportedMatchInput = {
  playerName: string;
  opponentName: string;
  date: string;
  result: string;
  location?: string | null;
};

export type ImportMatchesResult = {
  parsedCount: number;
  expandedRowCount: number;
  uniqueRowCount: number;
  insertedRowCount: number;
  skippedDuplicateRowCount: number;
  createdPlayerCount: number;
};

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function normalizeResult(result: string): MatchResult {
  const normalized = result.trim().toUpperCase();

  if (normalized === 'W' || normalized === 'WIN') return 'W';
  if (normalized === 'L' || normalized === 'LOSS') return 'L';

  throw new Error(`Invalid result "${result}". Expected W/L or Win/Loss.`);
}

function normalizeDate(input: string): string {
  const parsed = new Date(input);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date "${input}"`);
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function invertResult(result: MatchResult): MatchResult {
  return result === 'W' ? 'L' : 'W';
}

function buildMatchKey(row: MatchInsertRow): string {
  return `${row.player_id}|${row.opponent_id}|${row.date}|${row.result}`;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  return chunks;
}

async function fetchPlayersByNames(
  supabase: SupabaseClient,
  names: string[]
): Promise<Map<string, PlayerRow>> {
  const uniqueNames = [...new Set(names.map(normalizeName))];
  const playerMap = new Map<string, PlayerRow>();

  if (uniqueNames.length === 0) return playerMap;

  const chunks = chunkArray(uniqueNames, 500);

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, rating, dynamic_rating, location')
      .in('name', chunk);

    if (error) {
      throw new Error(`Failed loading players: ${error.message}`);
    }

    for (const player of (data ?? []) as PlayerRow[]) {
      playerMap.set(normalizeName(player.name), player);
    }
  }

  return playerMap;
}

async function createMissingPlayers(
  supabase: SupabaseClient,
  missingNames: string[],
  defaultLocation?: string | null
): Promise<PlayerRow[]> {
  const uniqueMissingNames = [...new Set(missingNames.map(normalizeName))];

  if (uniqueMissingNames.length === 0) return [];

  const rows = uniqueMissingNames.map((name) => ({
    name,
    rating: 3.0,
    dynamic_rating: 3.0,
    location: defaultLocation ?? null,
  }));

  const { data, error } = await supabase
    .from('players')
    .insert(rows)
    .select('id, name, rating, dynamic_rating, location');

  if (error) {
    throw new Error(`Failed creating players: ${error.message}`);
  }

  return (data ?? []) as PlayerRow[];
}

function buildTwoSidedRows(
  player: PlayerRow,
  opponent: PlayerRow,
  date: string,
  result: MatchResult
): [MatchInsertRow, MatchInsertRow] {
  return [
    {
      player_id: player.id,
      opponent_id: opponent.id,
      opponent: opponent.name,
      result,
      date,
    },
    {
      player_id: opponent.id,
      opponent_id: player.id,
      opponent: player.name,
      result: invertResult(result),
      date,
    },
  ];
}

/**
 * Replace these with your actual existing functions.
 * Keep them client-safe if you are calling them from the browser.
 */
async function recalculateRatingsSequentially(
  supabase: SupabaseClient
): Promise<void> {
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, rating')
    .order('name', { ascending: true });

  if (playersError) {
    throw new Error(`Failed loading players for recalc: ${playersError.message}`);
  }

  const baseRatings = new Map<string, number>();
  for (const player of players ?? []) {
    baseRatings.set(player.id, Number(player.rating ?? 3.0));
  }

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('id, player_id, opponent_id, result, date')
    .order('date', { ascending: true })
    .order('id', { ascending: true });

  if (matchesError) {
    throw new Error(`Failed loading matches for recalc: ${matchesError.message}`);
  }

  const currentRatings = new Map(baseRatings);

  for (const match of matches ?? []) {
    const playerId = match.player_id as string;
    const opponentId = match.opponent_id as string;
    const result = match.result as MatchResult;

    const playerRating = currentRatings.get(playerId) ?? 3.0;
    const opponentRating = currentRatings.get(opponentId) ?? 3.0;

    let delta = 0.04;

    if (result === 'W') {
      if (playerRating < opponentRating) delta = 0.07;
      currentRatings.set(playerId, Number((playerRating + delta).toFixed(3)));
    } else {
      if (playerRating > opponentRating) delta = 0.07;
      currentRatings.set(playerId, Number((playerRating - delta).toFixed(3)));
    }
  }

  const updates = [...currentRatings.entries()].map(([id, dynamic_rating]) => ({
    id,
    dynamic_rating,
  }));

  for (const chunk of chunkArray(updates, 500)) {
    const { error } = await supabase.from('players').upsert(chunk, {
      onConflict: 'id',
    });

    if (error) {
      throw new Error(`Failed updating dynamic ratings: ${error.message}`);
    }
  }
}

async function rebuildRatingSnapshots(
  supabase: SupabaseClient
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('rating_snapshots')
    .delete()
    .neq('id', 0);

  if (deleteError) {
    throw new Error(`Failed clearing rating snapshots: ${deleteError.message}`);
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, rating');

  if (playersError) {
    throw new Error(`Failed loading players for snapshots: ${playersError.message}`);
  }

  const currentRatings = new Map<string, number>();
  for (const player of players ?? []) {
    currentRatings.set(player.id, Number(player.rating ?? 3.0));
  }

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('id, player_id, opponent_id, result, date')
    .order('date', { ascending: true })
    .order('id', { ascending: true });

  if (matchesError) {
    throw new Error(`Failed loading matches for snapshots: ${matchesError.message}`);
  }

  const snapshotRows: {
    player_id: string;
    match_id: string;
    snapshot_date: string;
    dynamic_rating: number;
  }[] = [];

  for (const match of matches ?? []) {
    const playerId = match.player_id as string;
    const opponentId = match.opponent_id as string;
    const result = match.result as MatchResult;

    const playerRating = currentRatings.get(playerId) ?? 3.0;
    const opponentRating = currentRatings.get(opponentId) ?? 3.0;

    let delta = 0.04;

    if (result === 'W') {
      if (playerRating < opponentRating) delta = 0.07;
      currentRatings.set(playerId, Number((playerRating + delta).toFixed(3)));
    } else {
      if (playerRating > opponentRating) delta = 0.07;
      currentRatings.set(playerId, Number((playerRating - delta).toFixed(3)));
    }

    snapshotRows.push({
      player_id: playerId,
      match_id: match.id as string,
      snapshot_date: match.date as string,
      dynamic_rating: currentRatings.get(playerId)!,
    });
  }

  for (const chunk of chunkArray(snapshotRows, 500)) {
    const { error } = await supabase.from('rating_snapshots').insert(chunk);

    if (error) {
      throw new Error(`Failed inserting rating snapshots: ${error.message}`);
    }
  }
}

export async function importMatches(
  supabase: SupabaseClient,
  inputMatches: ImportedMatchInput[],
  options?: {
    defaultLocation?: string | null;
  }
): Promise<ImportMatchesResult> {
  if (!inputMatches.length) {
    return {
      parsedCount: 0,
      expandedRowCount: 0,
      uniqueRowCount: 0,
      insertedRowCount: 0,
      skippedDuplicateRowCount: 0,
      createdPlayerCount: 0,
    };
  }

  const normalizedMatches = inputMatches.map((match) => ({
    playerName: normalizeName(match.playerName),
    opponentName: normalizeName(match.opponentName),
    date: normalizeDate(match.date),
    result: normalizeResult(match.result),
    location: match.location?.trim() || null,
  }));

  const allNames = normalizedMatches.flatMap((match) => [
    match.playerName,
    match.opponentName,
  ]);

  const playerMap = await fetchPlayersByNames(supabase, allNames);

  const missingNames = [...new Set(allNames)].filter((name) => !playerMap.has(name));

  const createdPlayers = await createMissingPlayers(
    supabase,
    missingNames,
    options?.defaultLocation ?? null
  );

  for (const player of createdPlayers) {
    playerMap.set(normalizeName(player.name), player);
  }

  const expandedRows: MatchInsertRow[] = [];

  for (const match of normalizedMatches) {
    const player = playerMap.get(match.playerName);
    const opponent = playerMap.get(match.opponentName);

    if (!player || !opponent) {
      throw new Error(
        `Unable to resolve player IDs for ${match.playerName} vs ${match.opponentName}`
      );
    }

    const [rowA, rowB] = buildTwoSidedRows(
      player,
      opponent,
      match.date,
      match.result
    );

    expandedRows.push(rowA, rowB);
  }

  const dedupedRowMap = new Map<string, MatchInsertRow>();

  for (const row of expandedRows) {
    dedupedRowMap.set(buildMatchKey(row), row);
  }

  const uniqueRows = [...dedupedRowMap.values()];

  let insertedRowCount = 0;

  for (const chunk of chunkArray(uniqueRows, 500)) {
    const { data, error } = await supabase
      .from('matches')
      .upsert(chunk, {
        onConflict: 'player_id,opponent_id,date,result',
        ignoreDuplicates: true,
      })
      .select('id');

    if (error) {
      throw new Error(`Failed inserting matches: ${error.message}`);
    }

    insertedRowCount += data?.length ?? 0;
  }

  if (insertedRowCount > 0) {
    await recalculateRatingsSequentially(supabase);
    await rebuildRatingSnapshots(supabase);
  }

  return {
    parsedCount: normalizedMatches.length,
    expandedRowCount: expandedRows.length,
    uniqueRowCount: uniqueRows.length,
    insertedRowCount,
    skippedDuplicateRowCount: uniqueRows.length - insertedRowCount,
    createdPlayerCount: createdPlayers.length,
  };
}