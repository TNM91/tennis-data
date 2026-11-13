import { getNativeLeagueEntry, postNativeLeagueEntry } from '@/lib/native-league-entry-route'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  return getNativeLeagueEntry(request)
}

export async function POST(request: Request) {
  return postNativeLeagueEntry(request)
}
