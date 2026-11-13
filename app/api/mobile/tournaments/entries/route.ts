import { getNativeTournamentEntries } from '@/lib/native-tournament-entries-route'

export const runtime = 'nodejs'
export const maxDuration = 30

export const GET = (request: Request) => getNativeTournamentEntries(request)
