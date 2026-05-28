import { describe, expect, it } from 'vitest'
import { courtSpots, courtZones } from '../coordinates'

function expectPointInsideZone(point: { x: number; y: number }, zone: { height: number; width: number; x: number; y: number }) {
  expect(point.x).toBeGreaterThanOrEqual(zone.x)
  expect(point.x).toBeLessThanOrEqual(zone.x + zone.width)
  expect(point.y).toBeGreaterThanOrEqual(zone.y)
  expect(point.y).toBeLessThanOrEqual(zone.y + zone.height)
}

describe('TenAceIQ tactical court coordinates', () => {
  it('keeps deuce serve targets inside the calibrated receiving service box', () => {
    const targetBox = courtZones.deuceServiceTargets

    expectPointInsideZone(courtSpots.deuceServeWide, targetBox)
    expectPointInsideZone(courtSpots.deuceServeBody, targetBox)
    expectPointInsideZone(courtSpots.deuceServeT, targetBox)
  })

  it('keeps the second serve body target inside the body target window', () => {
    expectPointInsideZone(courtSpots.deuceServeBody, courtZones.deuceBodyWindow)
  })
})
