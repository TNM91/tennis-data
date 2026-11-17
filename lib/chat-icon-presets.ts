export const chatIconPresets = [
  { id: 'rally', label: 'Rally', glyph: 'matchup' },
  { id: 'baseline', label: 'Baseline', glyph: 'leagues' },
  { id: 'doubles', label: 'Doubles', glyph: 'teams' },
  { id: 'break-point', label: 'Break Point', glyph: 'tactics' },
  { id: 'champion', label: 'Champion', glyph: 'tournaments' },
  { id: 'clubhouse', label: 'Clubhouse', glyph: 'coach' },
] as const

export type ChatIconPreset = typeof chatIconPresets[number]['id']
export const chatIconModeHeader = 'X-TenAceIQ-Chat-Icons'
export const chatIconModePresets = 'presets-v1'
const prefix = 'tiq-icon:'

export function readChatIconPreset(value: unknown): ChatIconPreset | undefined {
  return chatIconPresets.find(icon => icon.id === value)?.id
}

export function chatIconPresetValue(preset: ChatIconPreset) {
  return prefix + preset
}

export function chatIconFromValue(value: unknown) {
  return typeof value === 'string' && value.startsWith(prefix) ? readChatIconPreset(value.slice(prefix.length)) : undefined
}
