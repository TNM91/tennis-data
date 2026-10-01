import 'server-only'

import { getCaptainAvailabilityServiceClient, isUuid } from './captain-availability-request-server'

export type LeagueWeeklySharePreview = {
  leagueName: string
  logoUrl: string
  playOn: string
  facility: string
  responseDeadline: string
}

export async function getLeagueWeeklySharePreview(token: string): Promise<LeagueWeeklySharePreview | null> {
  if (!isUuid(token)) return null

  try {
    const service = getCaptainAvailabilityServiceClient()
    const { data: session } = await service
      .from('tiq_league_weekly_sessions')
      .select('league_id,play_on,response_deadline')
      .eq('public_token', token)
      .maybeSingle()
    if (!session) return null

    const { data: league } = await service
      .from('tiq_leagues')
      .select('league_name,photo_url,default_facility')
      .eq('id', session.league_id)
      .maybeSingle()
    if (!league) return null

    return {
      leagueName: String(league.league_name || 'TIQ League'),
      logoUrl: String(league.photo_url || ''),
      playOn: String(session.play_on || ''),
      facility: String(league.default_facility || ''),
      responseDeadline: String(session.response_deadline || ''),
    }
  } catch {
    return null
  }
}

export function formatLeagueWeeklyShareDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`)
  if (!value || Number.isNaN(parsed.getTime())) return 'This week'
  return parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
