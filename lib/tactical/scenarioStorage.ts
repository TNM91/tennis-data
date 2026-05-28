import type { TacticalScenario } from './types'

export type TacticalScenarioRow = {
  id: string
  name: string
  focus: string
  category: string
  scenario_json: unknown
  updated_at: string
}

export type TacticalScenarioSummary = {
  id: string
  name: string
  focus: string
  updatedAt: string
  scenario: TacticalScenario
}

export function isTacticalScenario(value: unknown): value is TacticalScenario {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<TacticalScenario>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.focus === 'string' &&
    Array.isArray(candidate.tokens) &&
    Array.isArray(candidate.paths) &&
    Array.isArray(candidate.zones) &&
    Array.isArray(candidate.cues)
  )
}

export function mapTacticalScenarioRow(row: TacticalScenarioRow): TacticalScenarioSummary | null {
  if (!isTacticalScenario(row.scenario_json)) return null
  return {
    id: row.id,
    name: row.name,
    focus: row.focus,
    updatedAt: row.updated_at,
    scenario: row.scenario_json,
  }
}
