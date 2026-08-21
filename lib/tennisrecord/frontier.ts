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

export function getTennisRecordCampaignSeedUrls(campaign: TennisRecordFrontierCampaign) {
  if (campaign.slug !== 'missouri-2025-current') return []
  const startYear = Number(campaign.startsOn.slice(0, 4))
  const endYear = Number(campaign.endsOn.slice(0, 4))
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) return []

  const urls: string[] = []
  for (const year of Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index)) {
    for (const playerName of MISSOURI_PUBLIC_HISTORY_PLAYERS) {
      const params = new URLSearchParams({ playername: playerName, year: String(year) })
      urls.push(`https://www.tennisrecord.com/adult/matchhistory.aspx?${params.toString()}`)
    }
  }
  return urls
}

export function tennisRecordFrontierStatus(knownPages: number, availableSeedUrls: number) {
  if (knownPages > 0) return 'seeded' as const
  return availableSeedUrls > 0 ? 'ready_to_seed' as const : 'needs_admin_seed' as const
}
