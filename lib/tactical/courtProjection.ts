import type { TacticalPoint, TacticalZone } from './types'

export type CourtView = 'perspective' | 'overhead' | 'overhead-landscape'

// The diagram includes 16 ft of space outside each doubles sideline and 6 ft behind each baseline.
const diagramWidth = 68
const diagramLength = 90
export const courtDiagramSize = { width: diagramWidth, length: diagramLength }
const doublesLeft = 16
const doublesRight = 52
const farBaseline = 6
const nearBaseline = 84
const net = 45
const serviceDistance = 21
const farService = net - serviceDistance
const nearService = net + serviceDistance
const singlesLeft = doublesLeft + 4.5
const singlesRight = doublesRight - 4.5

const percent = (value: number, max: number) => value / max * 100

export function courtDiagramPoint(x: number, y: number, landscape: boolean): TacticalPoint {
  return landscape
    ? { x: percent(y, diagramLength), y: 100 - percent(x, diagramWidth) }
    : { x: percent(x, diagramWidth), y: percent(y, diagramLength) }
}

export const courtDiagramBounds = [doublesLeft, farBaseline, doublesRight, nearBaseline] as const
export const courtDiagramLines = [
  [singlesLeft, farBaseline, singlesLeft, nearBaseline, 'line'],
  [singlesRight, farBaseline, singlesRight, nearBaseline, 'line'],
  [singlesLeft, farService, singlesRight, farService, 'line'],
  [singlesLeft, nearService, singlesRight, nearService, 'line'],
  [diagramWidth / 2, farService, diagramWidth / 2, nearService, 'line'],
  [diagramWidth / 2, farBaseline, diagramWidth / 2, farBaseline + 1 / 3, 'line'],
  [diagramWidth / 2, nearBaseline - 1 / 3, diagramWidth / 2, nearBaseline, 'line'],
  [doublesLeft - 3, net, doublesRight + 3, net, 'net'],
] as const

// Calibrated to the approved perspective PNG in the original 1448 × 1600 coordinate frame.
// The 1086 px image is centered vertically, with 257 px of padding above it.
const perspectiveLandmarks = [0, ...[92, 230, 420, 731, 1007].map(y => percent(y + 257, 1600)), 100]
const overheadLandmarks = [0, ...[farBaseline, farService, net, nearService, nearBaseline].map(y => percent(y, diagramLength)), 100]
const overheadLateral = [0, percent(doublesLeft, diagramWidth), percent(doublesRight, diagramWidth), 100]

function between(value: number, domain: number[], target: number[]) {
  const next = domain.findIndex(stop => value <= stop)
  const end = next < 0 ? domain.length - 1 : Math.max(next, 1)
  const start = end - 1
  const fraction = (value - domain[start]) / (domain[end] - domain[start])
  return target[start] + fraction * (target[end] - target[start])
}

function perspectiveLateral(y: number) {
  const depth = (y - perspectiveLandmarks[1]) / (perspectiveLandmarks[5] - perspectiveLandmarks[1])
  const left = Math.max(1, percent(374 + (89 - 374) * depth, 1448))
  const right = Math.min(99, percent(1071 + (1339 - 1071) * depth, 1448))
  return [0, left, right, 100]
}

export function projectCourtPoint(point: TacticalPoint, view: CourtView): TacticalPoint {
  if (view === 'perspective') return point
  const x = between(point.x, perspectiveLateral(point.y), overheadLateral)
  const y = between(point.y, perspectiveLandmarks, overheadLandmarks)
  return view === 'overhead-landscape' ? { x: y, y: 100 - x } : { x, y }
}

export function unprojectCourtPoint(point: TacticalPoint, view: CourtView): TacticalPoint {
  if (view === 'perspective') return point
  const overhead = view === 'overhead-landscape' ? { x: 100 - point.y, y: point.x } : point
  const y = between(overhead.y, overheadLandmarks, perspectiveLandmarks)
  return { x: between(overhead.x, overheadLateral, perspectiveLateral(y)), y }
}

export function projectCourtZone(zone: TacticalZone, view: CourtView): readonly [TacticalPoint, TacticalPoint] {
  const right = zone.x + zone.width
  const bottom = zone.y + zone.height
  if (view === 'perspective') return [zone, { x: right, y: bottom }]
  const corners = [
    zone, { x: right, y: zone.y }, { x: zone.x, y: bottom }, { x: right, y: bottom },
  ].map(point => projectCourtPoint(point, view))
  return [
    { x: Math.min(...corners.map(p => p.x)), y: Math.min(...corners.map(p => p.y)) },
    { x: Math.max(...corners.map(p => p.x)), y: Math.max(...corners.map(p => p.y)) },
  ]
}
