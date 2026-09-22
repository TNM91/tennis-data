import { createClient } from '@supabase/supabase-js'
import { cleanClubText, mapClubGroupRow, mapClubRow, mapClubTemplateRow } from '@/lib/club-workspace'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: clubRow, error } = await supabase
    .from('clubs')
    .select('id,owner_user_id,name,slug,description,logo_url,hero_image_url,primary_color,location_label,contact_email,time_zone,is_public,created_at,updated_at')
    .eq('slug', slug)
    .eq('is_public', true)
    .maybeSingle()

  if (error || !clubRow) return Response.json({ ok: false, message: 'Club not found.' }, { status: 404 })
  const club = mapClubRow(clubRow as Record<string, unknown>)

  const [groupResult, templateResult, leagueResult, tournamentResult] = await Promise.all([
    supabase.from('club_groups').select('id,club_id,name,group_type,description,season_label,lead_user_id,capacity,location_label,registration_url,default_duration_minutes,is_public,is_active,updated_at').eq('club_id', club.id).eq('is_public', true).eq('is_active', true),
    supabase.from('club_competition_templates').select('id,club_id,name,competition_type,entrant_type,format_id,division_label,default_facility,schedule_notes,is_public,updated_at').eq('club_id', club.id).eq('is_public', true),
    supabase.from('tiq_leagues').select('id,league_name,season_label,season_status,is_public').eq('club_id', club.id).eq('is_public', true),
    supabase.from('tiq_tournaments').select('id,name,starts_on,status,is_public').eq('club_id', club.id).eq('is_public', true),
  ])

  return Response.json({
    ok: true,
    club,
    groups: ((groupResult.data ?? []) as Record<string, unknown>[]).map((row) => mapClubGroupRow(row)),
    templates: ((templateResult.data ?? []) as Record<string, unknown>[]).map(mapClubTemplateRow),
    competitions: [
      ...((leagueResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: cleanClubText(row.id),
        name: cleanClubText(row.league_name),
        detail: [cleanClubText(row.season_label), cleanClubText(row.season_status)].filter(Boolean).join(' · '),
        type: 'league' as const,
        href: `/explore/leagues/tiq/${encodeURIComponent(cleanClubText(row.id))}`,
      })),
      ...((tournamentResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: cleanClubText(row.id),
        name: cleanClubText(row.name),
        detail: [cleanClubText(row.starts_on), cleanClubText(row.status)].filter(Boolean).join(' · '),
        type: 'tournament' as const,
        href: `/tournaments/${encodeURIComponent(cleanClubText(row.id))}`,
      })),
    ],
  })
}
