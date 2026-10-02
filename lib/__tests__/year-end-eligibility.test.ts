import { describe, expect, it } from 'vitest'
import { MISSOURI_2025_TRILEVEL_POLICY, yearEndDiagnosticEligibility } from '../year-end-eligibility'

describe('season and district year-end eligibility', () => {
  it('includes documented Missouri Tri-Level year-end evidence', () => {
    expect(yearEndDiagnosticEligibility('2025 Tri-Level Missouri Valley Missouri St. Louis', 2025)).toEqual({ eligible: true, policy: 'missouri-2025-trilevel-year-end', sourceUrl: MISSOURI_2025_TRILEVEL_POLICY })
  })
  it('does not extend a district/year rule to another year or district', () => {
    expect(yearEndDiagnosticEligibility('Tri-Level Missouri Valley Missouri St. Louis', 2026).eligible).toBe(false)
    expect(yearEndDiagnosticEligibility('Tri-Level Missouri Valley Kansas', 2025).eligible).toBe(false)
    expect(yearEndDiagnosticEligibility('Tri-Level Missouri Valley', 2025).eligible).toBe(false)
    expect(yearEndDiagnosticEligibility('Mixed Adult Missouri Valley Missouri', 2025).eligible).toBe(false)
  })
})
