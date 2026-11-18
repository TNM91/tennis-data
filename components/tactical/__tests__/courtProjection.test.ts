import { describe, expect, it } from 'vitest'
import { courtDiagramBounds, courtDiagramLines, courtDiagramPoint, projectCourtPoint, unprojectCourtPoint } from '@/lib/tactical/courtProjection'

describe('overhead tactics court', () => {
  it('keeps regulation doubles, singles, service and baseline proportions', () => {
    const [left, far, right, near] = courtDiagramBounds
    expect([right - left, near - far]).toEqual([36, 78])
    const [singlesLeft, , singlesRight, firstService] = courtDiagramLines[2]
    const secondService = courtDiagramLines[3][1]
    const net = courtDiagramLines.at(-1)![1]
    expect([singlesRight - singlesLeft, net - firstService, secondService - net]).toEqual([27, 21, 21])
    expect(net - far).toBe(near - net)
  })

  it('puts the approved art’s baselines and service lines on the overhead court landmarks', () => {
    const oldFar = { x: 374 / 1448 * 100, y: (92 + 257) / 1600 * 100 }
    const oldNear = { x: 1339 / 1448 * 100, y: (1007 + 257) / 1600 * 100 }
    const oldService = { x: 50, y: (731 + 257) / 1600 * 100 }
    expect(projectCourtPoint(oldFar, 'overhead')).toEqual(courtDiagramPoint(16, 6, false))
    expect(projectCourtPoint(oldNear, 'overhead-landscape')).toEqual(courtDiagramPoint(52, 84, true))
    expect(projectCourtPoint(oldService, 'overhead').y).toBe(courtDiagramPoint(34, 66, false).y)
  })

  it('round-trips saved placements and positions outside the lines in both orientations', () => {
    for (const view of ['overhead', 'overhead-landscape'] as const) {
      for (const x of [0, 10, 33, 50, 68, 88, 100]) {
        for (const y of [0, 17, 31, 42, 55, 77, 86, 100]) {
          const display = projectCourtPoint({ x, y }, view)
          const restored = unprojectCourtPoint(display, view)
          expect(restored.x).toBeCloseTo(x, 8)
          expect(restored.y).toBeCloseTo(y, 8)
        }
      }
    }
  })
})
