import { describe, expect, it } from 'vitest'
import { MISSOURI_2025_TRILEVEL_POLICY, yearEndDiagnosticEligibility } from '../year-end-eligibility'
const missouri = { section: 'USTA/MISSOURI VALLEY', district: 'MISSOURI' }
describe('season and official district year-end eligibility', () => {
 it('includes documented Missouri district Tri-Level evidence only with official district context', () => {
  expect(yearEndDiagnosticEligibility('2025 Tri-Level',2025,missouri)).toEqual({eligible:true,policy:'missouri-2025-trilevel-year-end',sourceUrl:MISSOURI_2025_TRILEVEL_POLICY})
 })
 it('does not mistake a state/area label for the official district',()=>{
  expect(yearEndDiagnosticEligibility('2025 Tri-Level Missouri Valley Missouri St. Louis',2025).eligible).toBe(false)
  expect(yearEndDiagnosticEligibility('2025 Tri-Level Missouri Valley Missouri St. Louis',2025,{section:'USTA/MISSOURI VALLEY',district:'ST. LOUIS'}).eligible).toBe(false)
  expect(yearEndDiagnosticEligibility('2025 Tri-Level',2025,{section:'USTA/MISSOURI VALLEY',district:'HEART OF AMERICA'}).eligible).toBe(false)
 })
 it('does not extend the rule to other years, sections or league types',()=>{
  expect(yearEndDiagnosticEligibility('Tri-Level',2026,missouri).eligible).toBe(false)
  expect(yearEndDiagnosticEligibility('Tri-Level',2025,{section:'OTHER',district:'MISSOURI'}).eligible).toBe(false)
  expect(yearEndDiagnosticEligibility('Mixed Adult',2025,missouri).eligible).toBe(false)
 })
})
