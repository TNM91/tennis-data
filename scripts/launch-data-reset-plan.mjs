#!/usr/bin/env node

const now = new Date()
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z')

const resetGroups = [
  {
    title: 'Reset review/import staging',
    reason: 'Clears pending reviewed uploads and OCR/import drafts before the fresh USTA/TennisLink run.',
    tables: [
      'public.data_assist_ocr_jobs',
      'public.data_assist_drafts',
      'public.data_assist_screenshots',
      'public.data_assist_batches',
      'public.import_queue',
    ],
  },
  {
    title: 'Reset derived tennis intelligence',
    reason: 'Clears rating outputs and reports that must be rebuilt from the new match/player data.',
    tables: [
      'public.rating_snapshots',
      'public.match_accuracy_reports',
    ],
  },
  {
    title: 'Reset imported tennis records',
    reason: 'Clears imported rosters, match participants, team records, matches, and players.',
    tables: [
      'public.team_roster_members',
      'public.match_players',
      'public.team_summary_teams',
      'public.matches',
      'public.players',
    ],
  },
]

const profileDetachmentSql = [
  'update public.profiles',
  'set',
  '  linked_player_id = null,',
  "  linked_player_name = '',",
  "  linked_team_name = '',",
  "  linked_league_name = '',",
  "  linked_flight = ''",
  'where linked_player_id is not null',
  "  or coalesce(linked_player_name, '') <> ''",
  "  or coalesce(linked_team_name, '') <> ''",
  "  or coalesce(linked_league_name, '') <> ''",
  "  or coalesce(linked_flight, '') <> '';",
].join('\n')

const staleReferenceDetachmentSql = [
  '-- Clear non-FK player references that would point at deleted imported players.',
  "update public.coach_player_links set player_id = '' where coalesce(player_id, '') <> '';",
  "update public.tiq_player_league_entries set player_id = null, player_location = null where player_id is not null or player_location is not null;",
].join('\n')

const tables = resetGroups.flatMap((group) => group.tables)

function backupTableName(table) {
  return table.replace('public.', `launch_backup.${stamp}_`)
}

function printHeader() {
  console.log('TenAceIQ launch data reset plan')
  console.log(`Generated: ${now.toISOString()}`)
  console.log('')
  console.log('This script is non-destructive. It prints the SQL plan only.')
  console.log('Do not run the reset SQL against production until the owner confirms scope and backup.')
  console.log('')
}

function printTablePlan() {
  for (const group of resetGroups) {
    console.log(`# ${group.title}`)
    console.log(group.reason)
    for (const table of group.tables) {
      console.log(`- ${table}`)
    }
    console.log('')
  }
}

function printBackupSql() {
  console.log('-- Backup SQL')
  console.log('-- Run this first and verify row counts before any reset.')
  console.log('create schema if not exists launch_backup;')
  for (const table of tables) {
    console.log(`create table ${backupTableName(table)} as table ${table};`)
  }
  console.log('')
}

function printResetSql() {
  console.log('-- Reset SQL')
  console.log('-- Owner confirmation required before running.')
  console.log('begin;')
  console.log('')
  console.log('-- Detach accounts from old imported player/team records, but keep accounts and entitlements.')
  console.log(profileDetachmentSql)
  console.log('')
  console.log(staleReferenceDetachmentSql)
  console.log('')
  console.log('-- Delete in dependency order. Keep Supabase auth, profiles, billing, messages, and entitlements intact.')
  for (const table of tables) {
    console.log(`delete from ${table};`)
  }
  console.log('')
  console.log('commit;')
  console.log('')
}

function printPostResetChecks() {
  console.log('-- Post-reset verification SQL')
  for (const table of tables) {
    console.log(`select '${table}' as table_name, count(*) as row_count from ${table};`)
  }
  console.log('')
  console.log('After reset:')
  console.log('1. Import Team Summary first to rebuild players and rosters.')
  console.log('2. Import Season Schedule second to rebuild team match shells.')
  console.log('3. Import Scorecards third so match lines can attach to existing schedule context.')
  console.log('4. Run rating recalculation after scorecards commit.')
  console.log('5. Spot-check /players, /teams, /leagues, /rankings, /matchup, /admin/import-queue.')
}

printHeader()
printTablePlan()
printBackupSql()
printResetSql()
printPostResetChecks()
