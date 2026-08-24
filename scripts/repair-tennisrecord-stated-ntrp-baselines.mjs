import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pwxppfazbyourjrsutgx.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!process.argv.includes('--apply')) {
  throw new Error('This repair is dry by default. Re-run with --apply after reviewing the cohort audit.')
}
if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.')
}

function statedNtrpBaseline(value) {
  const label = typeof value === 'string' ? value.trim() : ''
  const match = label.match(/(?:^|\s)([1-7]\.[05])(?=\s|$)/)
  return match ? Number(match[1]) : null
}

async function main() {
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: staged, error: stagedError } = await service
    .from('tennisrecord_staged_players')
    .select('source_player_key,ntrp_label')
    .not('ntrp_label', 'is', null)
    .range(0, 4999)
  if (stagedError) throw new Error(stagedError.message)

  const baselinesBySourceKey = new Map(
    (staged || []).flatMap((player) => {
      const baseline = statedNtrpBaseline(player.ntrp_label)
      return baseline === null ? [] : [[player.source_player_key, baseline]]
    }),
  )
  const sourceKeys = [...baselinesBySourceKey.keys()]
  let candidates = 0
  let repaired = 0

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
    candidates += eligible.length
    for (const player of eligible) {
      const baseline = baselinesBySourceKey.get(player.external_source_key)
      if (baseline === undefined) continue
      const { error: updateError } = await service.from('players').update({
        rating_source: 'verified',
        singles_rating: baseline,
        doubles_rating: baseline,
        overall_rating: baseline,
      }).eq('id', player.id).eq('rating_source', 'self')
      if (updateError) throw new Error(updateError.message)
      repaired += 1
    }
  }

  console.log(JSON.stringify({ statedNtrpSourceRecords: sourceKeys.length, eligibleProvisionalPlayers: candidates, repairedPlayers: repaired }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
