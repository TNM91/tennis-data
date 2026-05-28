import type { CourtPoint, DrillZone } from './types'

export function clampPercent(value: number) {
  return Number.isNaN(value) ? 0 : Math.max(0, Math.min(100, value))
}

export function pointToCss(point: CourtPoint) {
  return {
    left: `${clampPercent(point.x)}%`,
    top: `${clampPercent(point.y)}%`,
  }
}

// Coordinates are calibrated to the locked isometric court artwork, not a flat
// mathematical court. Keep serve targets inside the visible service boxes.
export const courtCoordinates = {
  attackBall: { x: 58, y: 63 },
  netPlayer: { x: 68, y: 53 },
  returnerDeuce: { x: 33, y: 18 },
  serverDeuce: { x: 63, y: 88 },
} satisfies Record<string, CourtPoint>

export const courtSpots = {
  ...courtCoordinates,
  deuceServeBody: { x: 41, y: 38 },
  deuceServeT: { x: 50, y: 38 },
  deuceServeWide: { x: 33, y: 38 },
  returnDepthMiddle: { x: 50, y: 72 },
  serverRecovery: { x: 50, y: 74 },
} satisfies Record<string, CourtPoint>

export const courtZones = {
  deuceBodyWindow: { height: 13, id: 'deuce-body-window', marker: 'target', tone: 'green', width: 10, x: 37, y: 32 },
  deuceServiceTargets: { height: 15, id: 'deuce-service-targets', marker: 'target', tone: 'green', width: 22, x: 31, y: 31 },
  returnDepthMiddle: { height: 12, id: 'return-depth-middle', marker: 'target', tone: 'blue', width: 14, x: 43, y: 66 },
} satisfies Record<string, DrillZone>
