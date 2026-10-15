import { getCachedLeagueSummary } from '@/lib/league-summary-server'

export async function GET() {
  try {
    const summary = await getCachedLeagueSummary()
    return Response.json(summary)
  } catch (error) {
    console.error('League summary failed', error)
    return Response.json({ error: 'League summary could not be loaded.' }, { status: 500 })
  }
}
