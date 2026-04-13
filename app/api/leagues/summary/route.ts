import { fetchLeagueSummary } from '@/lib/league-summary'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const summary = await fetchLeagueSummary()
    return Response.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load league summary.'
    return Response.json({ error: message }, { status: 500 })
  }
}
