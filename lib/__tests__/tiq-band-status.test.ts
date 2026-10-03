import { expect, it } from 'vitest'
import { getTiqBandStatus } from '../tiq-band-status'

it.each([
  [4.35, 'Below band'], [4.34, 'Lower band'], [4.499, 'Below band'],
  [4.5, 'Within band'], [4.597, 'Within band'], [4.849, 'Within band'],
  [4.85, 'Upper band'], [4.999, 'Upper band'], [5, 'Next band'],
] as const)('places strength %s in %s relative to a published 4.5', (strength, status) => {
  expect(getTiqBandStatus(4.5, strength)).toBe(status)
})
