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

  it('returns a linked player to My Teams with a completion result', () => {
    const profileHref = new URL('/profile?returnTo=%2Fcompete%2Fteams#profile-identity', 'https://tenaceiq.example')
    const returnTo = getSafeWorkflowReturnTo(profileHref.searchParams.get('returnTo'))
    expect(returnTo).toBe('/compete/teams')
    expect(addWorkflowResult(returnTo, 'player-linked')).toBe('/compete/teams?setupResult=player-linked')
  })

  it('consumes one-time Coach handoffs without dropping the selected player', () => {
    const params = new URLSearchParams('studentLinkId=student-1&firstAssignment=1&levelUpPack=doubles&card=poach')
    expect(buildConsumedWorkflowHref('/coach', params, ['firstAssignment'], '#coach-lesson-frame'))
      .toBe('/coach?studentLinkId=student-1&levelUpPack=doubles&card=poach#coach-lesson-frame')
    expect(buildConsumedWorkflowHref('/outside', params, ['firstAssignment'])).toBe('')
  })

  it('consumes a Captain challenge after a destination loads without dropping team scope', () => {
    const params = new URLSearchParams('team=TIQ&league=Tri-Level&flight=3.5%2F4.0%2F4.5&levelUpChallenge=doubles-readiness&card=poach')
    expect(buildConsumedWorkflowHref('/captain/practice', params, ['levelUpChallenge', 'card'], '#practice'))
      .toBe('/captain/practice?team=TIQ&league=Tri-Level&flight=3.5%2F4.0%2F4.5#practice')
  })
})
