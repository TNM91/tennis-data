import { getNativeTournamentEntry, postNativeTournamentEntry } from '@/lib/native-tournament-entry-route'

export const runtime = 'nodejs'
export const maxDuration = 60

export const GET = (request: Request) => getNativeTournamentEntry(request)
export const POST = (request: Request) => postNativeTournamentEntry(request)
