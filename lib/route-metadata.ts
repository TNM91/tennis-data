import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pwxppfazbyourjrsutgx.supabase.co',
  'sb_publishable_FQBYCnXJy2vjIYlri8TG7g_2XZ9IqqZ',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
)

const DEFAULT_IMAGE = '/hero-tenaceiq-final.png'

function joinParts(parts: Array<string | null | undefined>, separator: string) {
  return parts.filter(Boolean).join(separator)
}

export function buildRouteMetadata({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      images: [
        {
          url: DEFAULT_IMAGE,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_IMAGE],
    },
  }
}

export async function getPlayerMetadataById(id: string): Promise<Metadata> {
  const { data } = await supabase
    .from('players')
    .select('name, location')
    .eq('id', id)
    .maybeSingle()

  const name = data?.name?.trim()
  const location = data?.location?.trim()
  const title = name ? `${name} Player Profile` : 'Player Profile'
  const description = name
    ? `${name}${location ? ` from ${location}` : ''} on TenAceIQ. Review dynamic ratings, recent match history, and matchup context in one place.`
    : 'Review player ratings, recent match history, and matchup context on TenAceIQ.'

  return buildRouteMetadata({
    title,
    description,
    path: `/players/${encodeURIComponent(id)}`,
  })
}

export async function getTeamMetadataByName(team: string): Promise<Metadata> {
  const { data } = await supabase
    .from('matches')
    .select('league_name, flight, usta_section')
    .or(`home_team.eq.${team},away_team.eq.${team}`)
    .order('match_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const title = `${team} Team Intelligence`
  const context = joinParts(
    [data?.league_name?.trim(), data?.flight?.trim(), data?.usta_section?.trim()],
    ' | ',
  )
  const description = context
    ? `${team} on TenAceIQ. Review roster depth, recent form, and captain tools for ${context}.`
    : `${team} on TenAceIQ. Review roster depth, recent form, and captain workflow tools in one place.`

  return buildRouteMetadata({
    title,
    description,
    path: `/teams/${encodeURIComponent(team)}`,
  })
}

export async function getLeagueMetadataByName(league: string): Promise<Metadata> {
  const { data } = await supabase
    .from('matches')
    .select('league_name, flight, usta_section, district_area')
    .eq('league_name', league)
    .order('match_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const leagueName = data?.league_name?.trim() || league
  const title = `${leagueName} League Season`
  const context = joinParts(
    [data?.flight?.trim(), data?.usta_section?.trim(), data?.district_area?.trim()],
    ' | ',
  )
  const description = context
    ? `${leagueName} on TenAceIQ. Explore season match history, team summaries, and league context for ${context}.`
    : `${leagueName} on TenAceIQ. Explore season match history, team summaries, and league context in one place.`

  return buildRouteMetadata({
    title,
    description,
    path: `/leagues/${encodeURIComponent(league)}`,
  })
}
