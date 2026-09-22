import { createClient } from '@supabase/supabase-js'
import { recalculateDynamicRatings } from '../lib/recalculateRatings'
import { supabaseUrl } from '../lib/supabase'

async function main() {
  if (!process.argv.includes('--apply')) {
    throw new Error('This recalculation is dry by default. Re-run with --apply after reviewing the cohort audit.')
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.')

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const result = await recalculateDynamicRatings(undefined, client)

  console.log(JSON.stringify({
    recalculatedPlayers: result.playerCount,
    eligibleMatches: result.eligibleMatchCount,
    ratingSnapshots: result.snapshotCount,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
