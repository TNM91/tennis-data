export type TacticalRole = 'captain' | 'coach' | 'player'
export type TacticalCategory = 'match' | 'practice'
export type TacticalTokenType = 'player' | 'ball' | 'cone'
export type TacticalTeam = 'green' | 'blue' | 'white'
export type TacticalPathKind = 'ball' | 'move' | 'recover'
export type TacticalZoneTone = 'green' | 'blue' | 'white'

export type TacticalPoint = {
  x: number
  y: number
}

export type TacticalToken = TacticalPoint & {
  id: string
  type: TacticalTokenType
  label: string
  role?: string
  team?: TacticalTeam
  handedness?: 'righty' | 'lefty'
}

export type TacticalPath = {
  id: string
  kind: TacticalPathKind
  label: string
  from: TacticalPoint
  to: TacticalPoint
}

export type TacticalZone = TacticalPoint & {
  id: string
  label: string
  width: number
  height: number
  tone: TacticalZoneTone
}

export type TacticalCue = {
  id: string
  role: TacticalRole
  text: string
}

export type TacticalScenario = {
  id: string
  name: string
  category: TacticalCategory
  audience: TacticalRole[]
  duration: string
  level: string
  focus: string
  note: string
  tokens: TacticalToken[]
  paths: TacticalPath[]
  zones: TacticalZone[]
  cues: TacticalCue[]
}

export type TacticalTemplateKey = 'poach' | 'australian' | 'crosscourt' | 'coachProgression'
export type TacticalSelection =
  | { type: 'scenario'; id: 'scenario' }
  | { type: 'token'; id: string }
  | { type: 'path'; id: string }
  | { type: 'zone'; id: string }
