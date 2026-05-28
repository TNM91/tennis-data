import { describe, expect, it } from 'vitest'
import { createTacticalTemplate } from '../templates'
import { isTacticalScenario, mapTacticalScenarioRow } from '../scenarioStorage'

describe('tactical scenario storage', () => {
  it('accepts template scenarios as cloud-save payloads', () => {
    const scenario = createTacticalTemplate('poach')

    expect(isTacticalScenario(scenario)).toBe(true)
    expect(mapTacticalScenarioRow({
      id: scenario.id,
      name: scenario.name,
      focus: scenario.focus,
      category: scenario.category,
      scenario_json: scenario,
      updated_at: '2026-05-27T00:00:00.000Z',
    })).toMatchObject({
      id: scenario.id,
      name: scenario.name,
      focus: scenario.focus,
      scenario,
    })
  })

  it('rejects incomplete scenario payloads', () => {
    expect(isTacticalScenario({ id: 'x', name: 'Broken' })).toBe(false)
    expect(mapTacticalScenarioRow({
      id: 'row-1',
      name: 'Broken',
      focus: '',
      category: 'practice',
      scenario_json: { id: 'x', name: 'Broken' },
      updated_at: '2026-05-27T00:00:00.000Z',
    })).toBeNull()
  })
})
