import { describe, expect, it } from 'vitest'
import { addWorkflowResult, getSafeWorkflowReturnTo } from '../workflow-return'

describe('workflow return', () => {
  it('keeps approved product paths and rejects external returns', () => {
    expect(getSafeWorkflowReturnTo('/captain/lineup-builder?team=TIQ')).toBe('/captain/lineup-builder?team=TIQ')
    expect(getSafeWorkflowReturnTo('https://bad.example/captain')).toBe('')
    expect(getSafeWorkflowReturnTo('//bad.example/captain')).toBe('')
    expect(getSafeWorkflowReturnTo('/admin')).toBe('')
  })

  it('adds completion proof without dropping scope or the destination anchor', () => {
    expect(addWorkflowResult('/captain?team=TIQ#captain-team-scope', 'player-linked'))
      .toBe('/captain?team=TIQ&setupResult=player-linked#captain-team-scope')
  })
})
