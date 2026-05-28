import type { TacticalRole, TacticalScenario } from './types'
import { scoreScenarioReadiness } from './utils'

export function scenarioToJson(scenario: TacticalScenario) {
  return JSON.stringify(scenario, null, 2)
}

export function scenarioBriefing(scenario: TacticalScenario, role: TacticalRole) {
  const roleCues = scenario.cues.filter((cue) => cue.role === role)
  const cues = roleCues.length ? roleCues : scenario.cues

  return [
    `${scenario.name} | ${scenario.focus}`,
    `Level: ${scenario.level}`,
    `Duration: ${scenario.duration}`,
    `Readiness: ${scoreScenarioReadiness(scenario)}%`,
    '',
    scenario.note,
    '',
    'Key cues:',
    ...(cues.length ? cues.map((cue) => `- ${cue.text}`) : ['- Name the target, run the pattern, review the recovery.']),
  ].join('\n')
}
