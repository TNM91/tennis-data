import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import {
  isCaptainLineupCalibration,
  summarizeCaptainCalibrations,
  type CaptainLineupCalibration,
} from '@/lib/captain-lineup-calibration'

export const runtime = 'nodejs'

type CalibrationRow = {
  id: string
  team_name: string
  opponent_team: string
  league_name: string | null
  flight: string | null
  match_date: string
  calibration_json: unknown
  updated_at: string
}

export async function GET(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const teamName = url.searchParams.get('team')?.trim() || ''
  const service = getCaptainAvailabilityServiceClient()
  let query = service
    .from('captain_lineup_calibrations')
    .select('id,team_name,opponent_team,league_name,flight,match_date,calibration_json,updated_at')
    .eq('user_id', auth.userId)
    .order('match_date', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(100)
  if (teamName) query = query.ilike('team_name', teamName)

  const { data, error } = await query
  if (error) return Response.json({ ok: false, message: 'Prediction history could not be loaded.' }, { status: 500 })

  const calibrations = ((data || []) as CalibrationRow[]).flatMap((row) => {
    if (!isCaptainLineupCalibration(row.calibration_json)) return []
    return [{
      id: row.id,
      teamName: row.team_name,
      opponentTeam: row.opponent_team,
      leagueName: row.league_name,
      flight: row.flight,
      matchDate: row.match_date,
      updatedAt: row.updated_at,
      calibration: row.calibration_json,
    }]
  })
  const summary = summarizeCaptainCalibrations(calibrations.map((item) => item.calibration as CaptainLineupCalibration))
  return Response.json({ ok: true, summary, calibrations })
}
