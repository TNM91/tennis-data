import type { ParsedTennisRecordPage } from './types'
import { hasMissouriPageEvidence } from './current-refresh'

/**
 * Public, explicit-season history pages provide a bounded starting frontier.
 * They are discovery-only: the collector extracts direct match-result URLs
 * from each page, and never treats profile/history ratings as TIQ inputs.
 */
const MISSOURI_PUBLIC_HISTORY_PLAYERS = [
  'Nathan Meinert',
  'April Obermier',
  'Angela Reckelhoff',
  'Dallas Miller',
  'MacKenzie Robertson',
  'Brandon Johnson',
  'Andrea Layton',
  'Kay Jones',
] as const

export type TennisRecordFrontierCampaign = {
  slug: string
  startsOn: string
  endsOn: string
}

export type TennisRecordCampaignPlayerSeed = TennisRecordFrontierCampaign & {
  playerName: string
  state: string
}

const CAMPAIGN_ALLOWED_STATES: Record<string, readonly string[]> = {
  'missouri-2025-current': ['MO'],
  'us-2025-current': [],
}

const MISSOURI_VALLEY_DIRECTORY_MARKER = /missouri(?:[+\s]|%20)*valley/i

function campaignYears(campaign: TennisRecordFrontierCampaign) {
  const startYear = Number(campaign.startsOn.slice(0, 4))
  const endYear = Number(campaign.endsOn.slice(0, 4))
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) return []
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index)
}

/** Keep an open historical campaign scoped through the day it is seeded. */
export function tennisRecordCampaignCurrentEndOn(endsOn: string, now = new Date()) {
  const today = now.toISOString().slice(0, 10)
  return /^20\d{2}-\d{2}-\d{2}$/.test(endsOn) && endsOn >= today ? endsOn : today
}

export function getTennisRecordCampaignSeedUrls(campaign: TennisRecordFrontierCampaign) {
  const years = campaignYears(campaign)
  if (!years.length) return []

  if (campaign.slug === 'us-2025-current') {
    return years.map((year) => `https://www.tennisrecord.com/adult/league/leaguetype.aspx?year=${year}`)
  }
  if (campaign.slug !== 'missouri-2025-current') return []

  // Begin at the ordinary public league directory too, but keep subsequent
  // directory traversal explicitly bounded to the Missouri Valley branch.
  // This discovers team and flight pages that a player-history-only seed can
  // never reach, without turning the Missouri campaign into a U.S. crawl.
  const urls: string[] = years.map((year) => `https://www.tennisrecord.com/adult/league/leaguetype.aspx?year=${year}`)
  for (const year of years) {
    for (const playerName of MISSOURI_PUBLIC_HISTORY_PLAYERS) {
      const params = new URLSearchParams({ playername: playerName, year: String(year) })
      urls.push(`https://www.tennisrecord.com/adult/matchhistory.aspx?${params.toString()}`)
    }
  }
  return urls
}

function isLeagueDirectoryUrl(url: URL) {
  return url.pathname.toLowerCase().startsWith('/adult/league')
}

function isMissouriValleyDirectoryUrl(url: URL) {
  return MISSOURI_VALLEY_DIRECTORY_MARKER.test(`${url.pathname}?${url.searchParams.toString()}`)
}

/**
 * The initial league type and section directory pages have no geographic
 * parameter. They are a small public index. Every deeper Missouri campaign
 * directory link must identify Missouri Valley and cannot name another
 * district. Non-directory expansion requires Missouri district/profile data.
 */
export function isTennisRecordCampaignDiscoveryAllowed(campaignSlug: string | null | undefined, sourceUrl: string, candidateUrl: string, page?: ParsedTennisRecordPage) {
  try {
    const source = new URL(sourceUrl)
    const candidate = new URL(candidateUrl)
    if (!['tennisrecord.com', 'www.tennisrecord.com'].includes(candidate.hostname) || !['http:', 'https:'].includes(candidate.protocol)) return false
    const year = candidate.searchParams.get('year')
    if (campaignSlug === 'missouri-2025-current' && year && (!/^20\d{2}$/.test(year) || Number(year) < 2025 || Number(year) > new Date().getUTCFullYear())) return false
    if (campaignSlug !== 'missouri-2025-current') return true
    const candidatePath = candidate.pathname.toLowerCase()
    if (candidatePath === '/adult/league/leaguetype.aspx' || candidatePath === '/adult/league/leaguesection.aspx') return true
    const district = candidate.searchParams.get('districtname')?.trim().toLowerCase()
    if (isLeagueDirectoryUrl(candidate)) return isMissouriValleyDirectoryUrl(candidate) && (!district || district === 'missouri')
    const sourceDistrict = source.searchParams.get('districtname')?.trim().toLowerCase()
    const inScope = (isMissouriValleyDirectoryUrl(source) && sourceDistrict === 'missouri') || hasMissouriPageEvidence(page)
    // Participant profiles remain factual references, not permission to crawl
    // that opponent's unrelated history. Their own profile must prove MO.
    if (candidatePath.endsWith('/profile.aspx')) return Boolean(page?.players.some(p => p.sourceUrl === candidateUrl))
    return inScope
  } catch {
    return false
  }
}

/**
 * Expand only from source profiles that the current campaign has already
 * discovered. The source profile must provide a state inside the campaign's
 * approved geographic boundary; this keeps a Missouri backfill from quietly
 * turning into an unbounded nationwide crawl.
 */
export function getTennisRecordCampaignPlayerHistoryUrls(seed: TennisRecordCampaignPlayerSeed) {
  const allowedStates = CAMPAIGN_ALLOWED_STATES[seed.slug] || []
  const state = seed.state.trim().toUpperCase()
  const playerName = seed.playerName.trim()
  const allowed = seed.slug === 'us-2025-current' ? /^[A-Z]{2}$/.test(state) : allowedStates.includes(state)
  if (!playerName || !allowed) return []

  return campaignYears(seed).map((year) => {
    const params = new URLSearchParams({ playername: playerName, year: String(year) })
    return `https://www.tennisrecord.com/adult/matchhistory.aspx?${params.toString()}`
  })
}

export function tennisRecordFrontierStatus(knownPages: number, availableSeedUrls: number) {
  if (knownPages > 0) return 'seeded' as const
  return availableSeedUrls > 0 ? 'ready_to_seed' as const : 'needs_admin_seed' as const
}
