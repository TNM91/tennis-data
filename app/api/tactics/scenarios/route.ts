import { getCoachApiAuth } from '@/lib/coach-api-auth'
import {
  isTacticalScenario,
  mapTacticalScenarioRow,
  type TacticalScenarioRow,
} from '@/lib/tactical/scenarioStorage'
import type { TacticalScenario } from '@/lib/tactical/types'

export const runtime = 'nodejs'

type SaveScenarioBody = {
  scenario?: unknown
}

export async function GET(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('tactical_scenarios')
    .select('id,name,focus,category,scenario_json,updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Tactical scenario load failed', error)
    return Response.json({ ok: false, message: 'Tactical scenarios could not be loaded.' }, { status: 500 })
  }

  const scenarios = ((data ?? []) as TacticalScenarioRow[])
    .map(mapTacticalScenarioRow)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  return Response.json({ ok: true, scenarios })
}

export async function POST(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  let body: SaveScenarioBody
  try {
    body = (await request.json()) as SaveScenarioBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid scenario request.' }, { status: 400 })
  }

  if (!isTacticalScenario(body.scenario)) {
    return Response.json({ ok: false, message: 'Scenario is not valid.' }, { status: 400 })
  }

  const scenario: TacticalScenario = body.scenario
  const payload = {
    id: scenario.id,
    user_id: auth.userId,
    name: scenario.name,
    focus: scenario.focus,
    category: scenario.category,
    scenario_json: scenario,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await auth.supabase
    .from('tactical_scenarios')
    .upsert(payload, { onConflict: 'id' })
    .select('id,name,focus,category,scenario_json,updated_at')
    .single()

  if (error) {
    console.error('Tactical scenario save failed', error)
    return Response.json({ ok: false, message: 'The tactical scenario could not be saved.' }, { status: 500 })
  }

  return Response.json({ ok: true, scenario: mapTacticalScenarioRow(data as TacticalScenarioRow) })
}

export async function DELETE(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const id = url.searchParams.get('id')?.trim() ?? ''
  if (!id) return Response.json({ ok: false, message: 'Missing scenario id.' }, { status: 400 })

  const { error } = await auth.supabase
    .from('tactical_scenarios')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Tactical scenario delete failed', error)
    return Response.json({ ok: false, message: 'The tactical scenario could not be deleted.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
