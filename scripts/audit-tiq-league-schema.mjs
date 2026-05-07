import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const REQUIRED_TABLES = [
  {
    table: 'tiq_leagues',
    columns: 'id, league_name, league_format, starts_on, ends_on, max_weeks, scheduling_mode, is_public',
  },
  {
    table: 'tiq_player_league_entries',
    columns: 'id, league_id, player_name, entry_status',
  },
  {
    table: 'tiq_team_league_entries',
    columns: 'id, league_id, team_name, entry_status',
  },
  {
    table: 'tiq_league_schedule_items',
    columns: 'id, league_id, league_format, participant_a_name, participant_b_name, scheduled_date, status',
  },
  {
    table: 'tiq_individual_league_results',
    columns: 'id, league_id, schedule_item_id, player_a_name, player_b_name, winner_player_name, score, result_date',
  },
  {
    table: 'tiq_individual_league_suggestions',
    columns: 'id, league_id, individual_competition_format, suggestion_type, claimed_by_user_id, status',
  },
  {
    table: 'tiq_team_league_match_events',
    columns: 'id, league_id, schedule_item_id, team_a_name, team_b_name, match_date',
  },
  {
    table: 'tiq_team_league_match_lines',
    columns: 'id, event_id, line_number, match_type, winner_side, score',
  },
]

async function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {}
  const text = await readFile(filePath, 'utf8')
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([^#=]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, '')]),
  )
}

async function readSupabaseConstants() {
  const sourcePath = path.join(process.cwd(), 'lib', 'supabase.ts')
  if (!existsSync(sourcePath)) return {}

  const source = await readFile(sourcePath, 'utf8')
  return {
    url: source.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/)?.[1] || '',
    key: source.match(/supabaseKey\s*=\s*['"]([^'"]+)['"]/)?.[1] || '',
  }
}

function formatError(error) {
  if (!error) return ''
  return [error.code, error.message].filter(Boolean).join(' ')
}

async function main() {
  const env = {
    ...(await readEnvFile(path.join(process.cwd(), '.env'))),
    ...(await readEnvFile(path.join(process.cwd(), '.env.local'))),
    ...process.env,
  }
  const constants = await readSupabaseConstants()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || constants.url
  const supabaseKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    constants.key

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase URL/key. Set SUPABASE_SERVICE_ROLE_KEY or public Supabase env vars.')
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const failures = []

  for (const contract of REQUIRED_TABLES) {
    const { error } = await supabase.from(contract.table).select(contract.columns).limit(1)
    if (error) {
      failures.push({
        table: contract.table,
        error: formatError(error),
      })
    }
  }

  if (failures.length > 0) {
    console.error('TIQ league schema audit failed:')
    for (const failure of failures) {
      console.error(`- ${failure.table}: ${failure.error}`)
    }
    process.exitCode = 1
    return
  }

  console.log(`TIQ league schema audit passed (${REQUIRED_TABLES.length} tables).`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'TIQ league schema audit failed.')
  process.exitCode = 1
})
