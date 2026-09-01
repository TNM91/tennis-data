import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pwxppfazbyourjrsutgx.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const APPLY = process.argv.includes('--apply')
if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.')
}

function statedNtrpBaseline(value) {
  const label = typeof value === 'string' ? value.trim() : ''
  const match = label.match(/(?:^|\s)([1-7]\.[05])(?=\s|$)/)
  return match ? Number(match[1]) : null
}

function statedNtrpDesignation(value) {
  const label = typeof value === 'string' ? value.trim() : ''
  const match = label.match(/(?:^|\s)[1-7]\.[05]\s*([CS])(?=\s|$)/i)
  if (match?.[1]?.toUpperCase() === 'C') return 'computer'
  if (match?.[1]?.toUpperCase() === 'S') return 'self'
  return 'unknown'
}

async function main() {
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const staged = await fetchStatedNtrpRows(service)

  const baselinesBySourceKey = new Map(
    staged.flatMap((player) => {
      const baseline = statedNtrpBaseline(player.ntrp_label)
      return baseline === null ? [] : [[player.source_player_key, {
        baseline,
        designation: statedNtrpDesignation(player.ntrp_label),
      }]]
    }),
  )
  const sourceKeys = [...baselinesBySourceKey.keys()]
  const candidates = []
  const candidatesByDesignation = { computer: 0, self: 0, unknown: 0 }
  const repairedByDesignation = { computer: 0, self: 0, unknown: 0 }

  for (let start = 0; start < sourceKeys.length; start += 100) {
    const keys = sourceKeys.slice(start, start + 100)
    const { data: players, error: playersError } = await service
      .from('players')
      .select('id,external_source_key,rating_source,overall_rating,singles_rating,doubles_rating')
      .eq('external_source', 'tennisrecord')
      .eq('is_external_provisional', true)
      .eq('rating_source', 'self')
      .in('external_source_key', keys)
    if (playersError) throw new Error(playersError.message)

    const eligible = (players || []).filter((player) => [player.overall_rating, player.singles_rating, player.doubles_rating]
      .every((rating) => rating === null || Number(rating) === 3.5))
    for (const player of eligible) {
      const evidence = baselinesBySourceKey.get(player.external_source_key)
      if (!evidence) continue
      candidatesByDesignation[evidence.designation] += 1
      candidates.push({ player, evidence })
    }
  }

  if (!APPLY) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      statedNtrpSourceRecords: sourceKeys.length,
      eligibleProvisionalPlayers: candidates.length,
      candidatesByDesignation,
      repairedPlayers: 0,
      repairedByDesignation,
    }, null, 2))
    return
  }

  let repaired = 0
  for (const { player, evidence } of candidates) {
      const { error: updateError } = await service.from('players').update({
        // A "C" is factual computer-rated USTA evidence. An "S" or
        // unlabelled NTRP remains provisional; it supplies a starting level,
        // not the verified-baseline guard. TennisRecord's dynamic estimate is
        // deliberately never read here.
        rating_source: evidence.designation === 'computer' ? 'verified' : 'self',
        singles_rating: evidence.baseline,
        doubles_rating: evidence.baseline,
        overall_rating: evidence.baseline,
      }).eq('id', player.id).eq('rating_source', 'self')
      if (updateError) throw new Error(updateError.message)
      repaired += 1
      repairedByDesignation[evidence.designation] += 1
  }

  console.log(JSON.stringify({
    mode: 'apply',
    statedNtrpSourceRecords: sourceKeys.length,
    eligibleProvisionalPlayers: candidates.length,
    candidatesByDesignation,
    repairedPlayers: repaired,
    repairedByDesignation,
  }, null, 2))
}

async function fetchStatedNtrpRows(service) {
  const rows = []
  const pageSize = 1000
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await service
      .from('tennisrecord_staged_players')
      .select('source_player_key,ntrp_label')
      .not('ntrp_label', 'is', null)
      .order('source_player_key', { ascending: true })
      .range(start, start + pageSize - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if ((data || []).length < pageSize) return rows
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
