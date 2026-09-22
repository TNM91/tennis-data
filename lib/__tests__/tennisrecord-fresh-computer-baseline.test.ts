import { describe, expect, it } from 'vitest'
import { floorFreshComputerRatedDynamic } from '../tennisrecord/service'

describe('fresh computer-rated TennisRecord baseline floor', () => {
  it('prevents an untouched provisional read from remaining below its factual computer-rated baseline', () => {
    expect(floorFreshComputerRatedDynamic(3.528, 4.5)).toBe(4.5)
    expect(floorFreshComputerRatedDynamic(null, 4.5)).toBe(4.5)
  })

  it('does not erase a stronger existing current read', () => {
    expect(floorFreshComputerRatedDynamic(4.62, 4.5)).toBe(4.62)
  })
})
