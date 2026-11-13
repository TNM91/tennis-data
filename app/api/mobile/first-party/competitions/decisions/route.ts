import { getLeagueEntryRequests, postLeagueEntryDecision } from '@/lib/native-league-decisions-route'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  return getLeagueEntryRequests(request, true)
}

export async function POST(request: Request) {
  return postLeagueEntryDecision(request, true)
}
