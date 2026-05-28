export type CourtPoint = {
  x: number
  y: number
}

export type CourtVariant = 'isometric' | 'flat'
export type PlayerHandedness = 'righty' | 'lefty'
export type PlayerTeam = 'A' | 'B' | 'home' | 'away' | 'neutral'
export type ArrowType = 'movement' | 'ball' | 'recovery'
export type MarkerType = 'ball' | 'cone'
export type ZoneTone = 'green' | 'blue' | 'white'

export type DrillPlayer = {
  id: string
  label?: string
  team?: PlayerTeam
  handedness?: PlayerHandedness
  pose?: 'ready' | 'serve' | 'forehand' | 'volley'
  rotation?: number
  size?: number
  x: number
  y: number
}

export type DrillArrow = {
  id: string
  from: CourtPoint
  to: CourtPoint
  type?: ArrowType
  label?: string
  curved?: boolean
}

export type DrillZone = {
  id: string
  marker?: 'cone' | 'target'
  tone?: ZoneTone
  x: number
  y: number
  width: number
  height: number
  label?: string
}

export type DrillLabel = {
  id: string
  text: string
  x: number
  y: number
  tone?: 'default' | 'muted' | 'danger'
}

export type DrillMarker = CourtPoint & {
  id: string
  type: MarkerType
  label?: string
  size?: number
}

export type DrillOverlay = {
  players?: DrillPlayer[]
  arrows?: DrillArrow[]
  zones?: DrillZone[]
  labels?: DrillLabel[]
  markers?: DrillMarker[]
}

export type TacticalPlayer = DrillPlayer
export type TacticalArrow = DrillArrow
export type TacticalZone = DrillZone
export type TacticalMarker = DrillMarker
export type TiqCourtVariant = CourtVariant
