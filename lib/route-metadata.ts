import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_IMAGE = '/tenaceiq/logos/tenaceiq-brand-preview.png'
let metadataSupabase: ReturnType<typeof createClient> | null = null

function getMetadataSupabase() {
  if (!metadataSupabase) {
    metadataSupabase = createClient(
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
  }

  return metadataSupabase
}

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
      type: 'website',
      locale: 'en_US',
      siteName: 'TenAceIQ',
      title,
      description,
      url: path,
      images: [
        {
          url: DEFAULT_IMAGE,
          width: 1600,
          height: 1000,
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

export function getExploreMetadata(): Metadata {
  return buildRouteMetadata({
    title: 'Explore Tennis Intelligence',
    description:
      'Browse players, rankings, leagues, teams, and public matchup prep across TenAceIQ.',
    path: '/explore',
  })
}

export function getRankingsMetadata(): Metadata {
  return buildRouteMetadata({
    title: 'Player Rankings',
    description:
      'Track leaderboard movement, compare singles and doubles strength, and scan top performers on TenAceIQ.',
    path: '/rankings',
  })
}

export function getMatchupMetadata(): Metadata {
  return buildRouteMetadata({
    title: 'Matchup Analysis',
    description:
      'Compare players or doubles teams with public matchup projections, head-to-head context, and rating-based insights.',
    path: '/matchup',
  })
}

export function getTournamentMetadataById(id: string): Metadata {
  const decoded = decodeURIComponent(id)
  const readableName = decoded
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
  const tournamentName = readableName || 'Tournament'
  const title = `${tournamentName} Tournament`

  return buildRouteMetadata({
    title,
    description:
      'Open a TenAceIQ tournament page with event details, divisions, entries, draws, schedule context, and results.',
    path: `/tournaments/${encodeURIComponent(id)}`,
  })
}

export async function getPlayerMetadataById(id: string): Promise<Metadata> {
  const preview = await getPlayerSharePreview(id)
  const name = preview.primary
  const location = preview.secondary
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
  const preview = await getTeamSharePreview(team)
  const title = `${team} Team Intelligence`
  const context = joinParts([preview.secondary, preview.tertiary], ' | ')
  const description = context
    ? `${team} on TenAceIQ. Review roster depth, recent form, and Team Hub context for ${context}.`
    : `${team} on TenAceIQ. Review roster depth, recent form, and Team Hub context in one place.`

  return buildRouteMetadata({
    title,
    description,
    path: `/teams/${encodeURIComponent(team)}`,
  })
}

export async function getLeagueMetadataByName(league: string): Promise<Metadata> {
  const preview = await getLeagueSharePreview(league)
  const leagueName = preview.primary
  const title = `${leagueName} League Season`
  const context = joinParts([preview.secondary, preview.tertiary], ' | ')
  const description = context
    ? `${leagueName} on TenAceIQ. Explore season match history, team summaries, and league context for ${context}.`
    : `${leagueName} on TenAceIQ. Explore season match history, team summaries, and league context in one place.`

  return buildRouteMetadata({
    title,
    description,
    path: `/leagues/${encodeURIComponent(league)}`,
  })
}

export async function getAwardMetadataById(id: string): Promise<Metadata> {
  const preview = await getAwardSharePreview(id)
  const title = preview.recipientName
    ? `${preview.recipientName} ${preview.title}`
    : 'TenAceIQ Award Certificate'
  const description = preview.recipientName
    ? `${preview.recipientName} earned ${preview.title} at ${preview.sourceName}. More Tennis. Less Chaos.`
    : 'Open a TenAceIQ award certificate. More Tennis. Less Chaos.'
  const path = `/awards/${encodeURIComponent(id)}`

  return {
    ...buildRouteMetadata({
      title,
      description,
      path,
    }),
    openGraph: {
      title,
      description,
      url: path,
      images: [
        {
          url: `${path}/opengraph-image`,
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
      images: [`${path}/opengraph-image`],
    },
  }
}

export async function getPlayerSharePreview(id: string) {
  const { data } = await getMetadataSupabase()
    .from('players')
    .select('name, location')
    .eq('id', id)
    .maybeSingle()
  const row = data as { name?: string | null; location?: string | null } | null

  return {
    primary: row?.name?.trim() || 'Player Profile',
    secondary: row?.location?.trim() || 'TenAceIQ player intelligence',
  }
}

export async function getTeamSharePreview(team: string) {
  const { data } = await getMetadataSupabase()
    .from('matches')
    .select('league_name, flight, usta_section')
    .or(`home_team.eq.${team},away_team.eq.${team}`)
    .order('match_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  const row = data as { league_name?: string | null; flight?: string | null; usta_section?: string | null } | null

  return {
    primary: team,
    secondary: row?.league_name?.trim() || 'Team intelligence',
    tertiary: joinParts([row?.flight?.trim(), row?.usta_section?.trim()], ' | '),
  }
}

export async function getLeagueSharePreview(league: string) {
  const { data } = await getMetadataSupabase()
    .from('matches')
    .select('league_name, flight, usta_section, district_area')
    .eq('league_name', league)
    .order('match_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  const row = data as { league_name?: string | null; flight?: string | null; usta_section?: string | null; district_area?: string | null } | null

  return {
    primary: row?.league_name?.trim() || league,
    secondary: row?.flight?.trim() || 'League season',
    tertiary: joinParts([row?.usta_section?.trim(), row?.district_area?.trim()], ' | '),
  }
}

export async function getAwardSharePreview(id: string) {
  const { data } = await getMetadataSupabase()
    .from('tiq_awards')
    .select('recipient_name,source_name,title,badge_label,badge_code,subtitle')
    .eq('id', id)
    .maybeSingle()
  const row = data as {
    recipient_name?: string | null
    source_name?: string | null
    title?: string | null
    badge_label?: string | null
    badge_code?: string | null
    subtitle?: string | null
  } | null

  return {
    recipientName: row?.recipient_name?.trim() || '',
    sourceName: row?.source_name?.trim() || 'TenAceIQ',
    title: row?.title?.trim() || 'Award Certificate',
    badgeLabel: row?.badge_label?.trim() || 'Award',
    badgeCode: row?.badge_code?.trim() || 'TIQ',
    subtitle: row?.subtitle?.trim() || 'More Tennis. Less Chaos.',
  }
}
