import { describe, expect, it } from 'vitest'
import { selectComputerPriors, type ComputerPriorLabel } from '../tiq-computer-priors'
const label = (overrides: Partial<ComputerPriorLabel> = {}): ComputerPriorLabel => ({ playerId: 'a', level: 4, designation: 'computer', effectiveDate: '2024-12-31', currentLabel: '4.0 C', ...overrides })
describe('valid computer starting evidence', () => {
  it('carries a two-year label for all ages', () => expect(selectComputerPriors([label()], 2026).get('a')).toBe(4))
  it('uses the newest annual label', () => expect(selectComputerPriors([label(), label({ level: 4.5, effectiveDate: '2025-12-31' })], 2026).get('a')).toBe(4.5))
  it('does not fall back past a conflicting or non-computer newest label', () => {
    expect(selectComputerPriors([label(), label({ effectiveDate: '2025-12-31', designation: 'self' })], 2026).size).toBe(0)
    expect(selectComputerPriors([label(), label({ effectiveDate: '2025-12-31' }), label({ effectiveDate: '2025-12-31', level: 4.5 })], 2026).size).toBe(0)
  })
  it('rejects expired, undated and current-season labels', () => {
    for (const effectiveDate of ['2023-12-31', '', '2026-12-31']) expect(selectComputerPriors([label({ effectiveDate })], 2026).size).toBe(0)
  })
  it('holds a carried label if the current owner profile changed or lacks a C label', () => {
    for (const currentLabel of ['4.5 C', '4.0 S', '', '4x0 C']) expect(selectComputerPriors([label({ currentLabel })], 2026).size).toBe(0)
  })
  it('rejects invalid levels without using an older label', () => {
    for (const level of [NaN, 4.1, 8]) expect(selectComputerPriors([label(), label({ level, effectiveDate: '2025-12-31' })], 2026).size).toBe(0)
  })
})
