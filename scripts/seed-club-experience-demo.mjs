import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = resolve(process.cwd())
const env = await readEnv(resolve(root, '.env.local')).catch(async () => await readEnv(resolve(root, '..', '..', '.env.local')))
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to seed the Club experience demo.')

const url = 'https://pwxppfazbyourjrsutgx.supabase.co'
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const roles = [
  { key: 'owner', email: env.TENACEIQ_QA_ADMIN_EMAIL, roles: ['owner', 'director'], name: 'Jordan Lee' },
  { key: 'coach', email: env.TENACEIQ_QA_COACH_EMAIL, roles: ['coach'], name: 'Maya Chen' },
  { key: 'captain', email: env.TENACEIQ_QA_CAPTAIN_EMAIL, roles: ['captain', 'coordinator'], name: 'Alex Morgan' },
  { key: 'player', email: env.TENACEIQ_QA_PLAYER_EMAIL, roles: ['player'], name: 'Taylor Brooks' },
  { key: 'member', email: env.TENACEIQ_QA_FREE_EMAIL, roles: ['player'], name: 'Riley Kim' },
].filter((item) => item.email)

const users = await listAllUsers(service)
for (const item of roles) {
  item.user = users.find((user) => user.email?.toLowerCase() === item.email.toLowerCase())
  if (!item.user) throw new Error(`QA user not found for ${item.key}.`)
}

const profileLinks = await mustData(
  service.from('profiles').select('id,linked_player_id,linked_player_name,linked_team_name').in('id', roles.map((item) => item.user.id)),
  'QA profile links',
)

const owner = roles.find((item) => item.key === 'owner')
const coach = roles.find((item) => item.key === 'coach')
const clubId = '4da7694c-c724-4a50-8cea-8c1f51f38a11'
const slug = 'northstar-tennis-club-demo'
const now = new Date().toISOString()
const logoObjectPath = `${clubId}/northstar-tennis-club.png`
const logoBytes = await readFile(resolve(root, 'public', 'brand', 'demo-clubs', 'northstar-tennis-club.png'))
await must(service.storage.from('club-branding').upload(logoObjectPath, logoBytes, {
  contentType: 'image/png',
  cacheControl: '31536000',
  upsert: true,
}), 'club logo')
const { data: logoPublicUrl } = service.storage.from('club-branding').getPublicUrl(logoObjectPath)

await must(service.from('club_billing_accounts').upsert({
  owner_user_id: owner.user.id,
  plan_id: 'club_unlimited',
  status: 'trial',
}, { onConflict: 'owner_user_id' }), 'club billing')

await must(service.from('clubs').upsert({
  id: clubId,
  owner_user_id: owner.user.id,
  name: 'Northstar Tennis Club',
  slug,
  description: 'A connected tennis community where players know what is next, coaches can see the whole development story, and every program and competition stays in one place.',
  logo_url: logoPublicUrl.publicUrl,
  hero_image_url: '',
  primary_color: '#64d4ff',
  location_label: 'St. Louis, Missouri',
  contact_email: 'tennis@northstar.example',
  time_zone: 'America/Chicago',
  is_public: true,
  onboarding_completed_at: now,
}, { onConflict: 'id' }), 'club')

const existingMemberships = await mustData(service.from('club_memberships').select('id,user_id').eq('club_id', clubId), 'existing memberships')
const membershipRows = roles.map((item, index) => ({
  id: existingMemberships.find((membership) => membership.user_id === item.user.id)?.id ?? `4da7694c-c724-4a50-8cea-8c1f51f38a${20 + index}`,
  club_id: clubId,
  user_id: item.user.id,
  roles: item.roles,
  status: 'active',
  display_name: item.name,
  email: item.email,
  phone: index < 3 ? `314-555-01${20 + index}` : '',
  joined_at: now,
}))
await must(service.from('club_memberships').upsert(membershipRows, { onConflict: 'id' }), 'memberships')

const groups = [
  {
    id: '4da7694c-c724-4a50-8cea-8c1f51f38b01',
    club_id: clubId,
    name: 'High Performance 4.0+',
    group_type: 'clinic',
    description: 'Live-ball patterns, match planning, and a clear personal focus for the week.',
    season_label: 'Fall 2026',
    lead_user_id: coach.user.id,
    capacity: 12,
    location_label: 'Courts 1–3',
    registration_url: 'https://example.com/northstar/high-performance',
    default_duration_minutes: 90,
    is_public: true,
    is_active: true,
    created_by_user_id: owner.user.id,
  },
  {
    id: '4da7694c-c724-4a50-8cea-8c1f51f38b02',
    club_id: clubId,
    name: 'Northstar Aces',
    group_type: 'team',
    description: 'Club team roster, availability, lineup work, match preparation, and communication.',
    season_label: 'Fall 2026',
    lead_user_id: roles.find((item) => item.key === 'captain').user.id,
    capacity: 16,
    location_label: 'Northstar Tennis Club',
    registration_url: '',
    default_duration_minutes: 120,
    is_public: true,
    is_active: true,
    created_by_user_id: owner.user.id,
  },
  {
    id: '4da7694c-c724-4a50-8cea-8c1f51f38b03',
    club_id: clubId,
    name: 'Future Stars Development',
    group_type: 'development_group',
    description: 'A shared development path with coach assignments, Level Up work, and progress reviews.',
    season_label: 'Fall 2026',
    lead_user_id: coach.user.id,
    capacity: 18,
    location_label: 'Courts 4–6',
    registration_url: 'https://example.com/northstar/future-stars',
    default_duration_minutes: 75,
    is_public: true,
    is_active: true,
    created_by_user_id: owner.user.id,
  },
]
await must(service.from('club_groups').upsert(groups, { onConflict: 'id' }), 'groups')

const membersByKey = new Map(roles.map((item, index) => [item.key, membershipRows[index].id]))
await must(service.from('club_group_members').upsert([
  ...['player', 'member', 'captain'].map((key) => ({ group_id: groups[0].id, membership_id: membersByKey.get(key), status: 'active' })),
  ...['player', 'member', 'captain'].map((key) => ({ group_id: groups[1].id, membership_id: membersByKey.get(key), status: 'active' })),
  ...['player', 'member'].map((key) => ({ group_id: groups[2].id, membership_id: membersByKey.get(key), status: 'active' })),
], { onConflict: 'group_id,membership_id' }), 'group members')

await must(service.from('club_clinic_sessions').upsert([
  { id: '4da7694c-c724-4a50-8cea-8c1f51f38c01', group_id: groups[0].id, title: 'Pressure patterns + first four balls', starts_at: '2026-08-13T23:00:00.000Z', ends_at: '2026-08-14T00:30:00.000Z', location_label: 'Courts 1–3', court_label: '1–3', focus: 'Own the first four balls', plan: 'Serve +1, return depth, live-ball score play', player_next_step: 'Save one pattern to My Quest before the weekend.', status: 'scheduled', created_by_user_id: coach.user.id, updated_by_user_id: coach.user.id },
  { id: '4da7694c-c724-4a50-8cea-8c1f51f38c02', group_id: groups[0].id, title: 'Match play lab', starts_at: '2026-08-16T15:00:00.000Z', ends_at: '2026-08-16T16:30:00.000Z', location_label: 'Courts 1–4', court_label: '1–4', focus: 'Turn scouting into a match plan', plan: 'Player-led warmup, scenario sets, review', player_next_step: 'Review the saved plan in My Lab.', status: 'scheduled', created_by_user_id: coach.user.id, updated_by_user_id: coach.user.id },
], { onConflict: 'id' }), 'clinic sessions')

await must(service.from('club_competition_templates').upsert([
  { id: '4da7694c-c724-4a50-8cea-8c1f51f38d01', club_id: clubId, name: 'Northstar Singles Ladder', competition_type: 'league', entrant_type: 'players', format_id: 'ladder', division_label: 'Open 3.5–4.5', default_facility: 'Northstar Tennis Club', schedule_notes: 'Player-arranged matches with a seven-day window.', is_public: true, created_by_user_id: owner.user.id },
  { id: '4da7694c-c724-4a50-8cea-8c1f51f38d02', club_id: clubId, name: 'Northstar Club Championships', competition_type: 'tournament', entrant_type: 'players', format_id: 'single_elimination', division_label: 'Open Singles', default_facility: 'Northstar Tennis Club', schedule_notes: 'Friday evening through Sunday finals.', is_public: true, created_by_user_id: owner.user.id },
], { onConflict: 'id' }), 'competition templates')

await must(service.from('tiq_leagues').upsert({
  id: 'northstar-fall-singles-2026',
  competition_layer: 'tiq',
  league_format: 'individual',
  individual_competition_format: 'ladder',
  scoring_system: 'standard',
  league_name: 'Northstar Fall Singles Ladder',
  season_label: 'Fall 2026',
  season_status: 'active',
  starts_on: '2026-08-15',
  ends_on: '2026-10-31',
  max_weeks: 12,
  max_match_events: 120,
  is_public: true,
  scheduling_mode: 'player_arranged',
  default_match_day: '',
  default_match_time: '',
  default_facility: 'Northstar Tennis Club',
  scheduling_notes: 'Arrange matches in the seven-day challenge window.',
  flight: 'Open 3.5–4.5',
  location_label: 'St. Louis, Missouri',
  notes: 'Club ladder with results contributing to public history and TIQ rating.',
  teams: [],
  players: ['Taylor Brooks', 'Riley Kim', 'Alex Morgan', 'Maya Chen'],
  club_id: clubId,
  club_group_id: null,
  result_mode: 'tiq_rated',
  created_by_user_id: owner.user.id,
  updated_by_user_id: owner.user.id,
}, { onConflict: 'id' }), 'league')

await must(service.from('tiq_tournaments').upsert({
  id: 'northstar-club-championships-2026',
  name: 'Northstar Club Championships',
  format: 'single_elimination',
  entrant_type: 'players',
  status: 'open',
  starts_on: '2026-09-18',
  location_label: 'Northstar Tennis Club',
  director_notes: 'All main-draw results count toward public match history and TIQ rating.',
  entrants: ['Taylor Brooks', 'Riley Kim', 'Alex Morgan', 'Maya Chen'],
  results: {},
  is_public: true,
  club_id: clubId,
  club_group_id: null,
  result_mode: 'tiq_rated',
  created_by_user_id: owner.user.id,
  updated_by_user_id: owner.user.id,
}, { onConflict: 'id' }), 'tournament')

console.log(JSON.stringify({
  ok: true,
  clubId,
  slug,
  users: roles.map((item) => {
    const profile = profileLinks.find((row) => row.id === item.user.id)
    return {
      key: item.key,
      email: item.email,
      playerLinked: Boolean(profile?.linked_player_id),
      playerName: profile?.linked_player_name || '',
      teamName: profile?.linked_team_name || '',
    }
  }),
}, null, 2))

async function listAllUsers(client) {
  const result = []
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    result.push(...data.users)
    if (data.users.length < 1000) break
  }
  return result
}

async function must(query, label) {
  const { error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
}

async function mustData(query, label) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return data ?? []
}

async function readEnv(path) {
  const source = await readFile(path, 'utf8')
  return Object.fromEntries(source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => {
    const separator = line.indexOf('=')
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')]
  }))
}
