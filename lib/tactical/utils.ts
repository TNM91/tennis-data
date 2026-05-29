import type { TacticalPathKind, TacticalPoint, TacticalScenario, TacticalTokenType } from './types'

export function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function snapPercent(value: number, enabled = true) {
  const clamped = clampPercent(value)
  return enabled ? Math.round(clamped / 2.5) * 2.5 : clamped
}

export function makeTacticalId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function pointFromPointer(clientX: number, clientY: number, element: HTMLElement, snap = true): TacticalPoint {
  const rect = element.getBoundingClientRect()
  return {
    x: snapPercent(((clientX - rect.left) / rect.width) * 100, snap),
    y: snapPercent(((clientY - rect.top) / rect.height) * 100, snap),
  }
}

export function countScenarioObjects(scenario: TacticalScenario) {
  return scenario.tokens.length + scenario.paths.length + scenario.zones.length
}

export function scoreScenarioReadiness(scenario: TacticalScenario) {
  const hasPlayers = scenario.tokens.filter((token) => token.type === 'player').length >= 2
  const hasBall = scenario.tokens.some((token) => token.type === 'ball') || scenario.paths.some((path) => path.kind === 'ball')
  const hasPathOrCleanBoard = scenario.paths.length > 0 || scenario.name.toLowerCase().includes('basic')
  const hasCue = scenario.cues.length > 0 || scenario.note.trim().length > 20
  const hasContext = Boolean(scenario.duration && scenario.level && scenario.focus)
  return [hasPlayers, hasBall, hasPathOrCleanBoard, hasCue, hasContext].filter(Boolean).length * 20
}

export function tacticalSuggestions(scenario: TacticalScenario) {
  const suggestions: string[] = []
  if (scenario.tokens.filter((token) => token.type === 'player').length < 2) {
    suggestions.push('Add both sides so the pattern reads like a real point.')
  }
  if (!scenario.paths.some((path) => path.kind === 'ball') && !scenario.name.toLowerCase().includes('basic')) {
    suggestions.push('Add a ball path so the tactical intention is visible.')
  }
  if (!scenario.paths.some((path) => path.kind === 'recover') && !scenario.name.toLowerCase().includes('basic')) {
    suggestions.push('Add the recovery responsibility after the first action.')
  }
  if (!scenario.zones.length && !scenario.name.toLowerCase().includes('basic')) {
    suggestions.push('Mark the target window or pressure space.')
  }
  return suggestions.length ? suggestions : ['Ready to brief. Keep the cue short enough to use between points.']
}

export function defaultTokenLabel(type: TacticalTokenType) {
  if (type === 'player') return 'P'
  if (type === 'x') return 'X'
  if (type === 'o') return 'O'
  if (type === 'ball') return ''
  return ''
}

export function defaultPathLabel(kind: TacticalPathKind) {
  if (kind === 'ball') return 'Ball'
  if (kind === 'recover') return 'Recover'
  return 'Move'
}
