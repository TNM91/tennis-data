import { describe, expect, it } from 'vitest'
import {
  addWorkflowResult,
  buildConsumedWorkflowHref,
  buildConsumedWorkflowResultHref,
  getSafeWorkflowReturnTo,
  readWorkflowResult,
} from '../workflow-return'

describe('workflow return', () => {
  it('keeps approved product paths and rejects external returns', () => {
    expect(getSafeWorkflowReturnTo('/captain/lineup-builder?team=TIQ')).toBe('/captain/lineup-builder?team=TIQ')
    expect(getSafeWorkflowReturnTo('https://bad.example/captain')).toBe('')
    expect(getSafeWorkflowReturnTo('//bad.example/captain')).toBe('')
    expect(getSafeWorkflowReturnTo('/admin')).toBe('')
  })

  it('adds completion proof without dropping scope or the destination anchor', () => {
    const href = addWorkflowResult('/captain?team=TIQ#captain-team-scope', 'player-linked')
    expect(href).toBe('/captain?team=TIQ&setupResult=player-linked#captain-team-scope')

    const url = new URL(href, 'https://tenaceiq.example')
    expect(readWorkflowResult(url.searchParams)).toBe('player-linked')
    expect(buildConsumedWorkflowResultHref(url.pathname, url.searchParams, url.hash))
      .toBe('/captain?team=TIQ#captain-team-scope')
  })

  it('consumes one-time Coach handoffs without dropping the selected player', () => {
    const params = new URLSearchParams('studentLinkId=student-1&firstAssignment=1&levelUpPack=doubles&card=poach')
    expect(buildConsumedWorkflowHref('/coach', params, ['firstAssignment'], '#coach-lesson-frame'))
      .toBe('/coach?studentLinkId=student-1&levelUpPack=doubles&card=poach#coach-lesson-frame')
    expect(buildConsumedWorkflowHref('/outside', params, ['firstAssignment'])).toBe('')
  })
})
