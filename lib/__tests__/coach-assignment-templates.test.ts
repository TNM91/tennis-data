import { describe, expect, it } from 'vitest'
import { COACH_ASSIGNMENT_TEMPLATES, getCoachAssignmentTemplate } from '../coach-assignment-templates'

describe('coach assignment templates', () => {
  it('provides practical first assignments for major development categories', () => {
    expect(COACH_ASSIGNMENT_TEMPLATES.map((template) => template.id)).toEqual([
      'serve-target-ladder',
      'split-recover-repeat',
      'attack-decision-audit',
      'doubles-first-move',
    ])
  })

  it('keeps every template measurable and Player+ ready', () => {
    for (const template of COACH_ASSIGNMENT_TEMPLATES) {
      expect(template.title).toBeTruthy()
      expect(template.focus).toBeTruthy()
      expect(template.assignment.tracker.length).toBeGreaterThanOrEqual(3)
      expect(template.assignment.playerPlusPrompt).toContain(' ')
    }
  })

  it('falls back to the first assignment template', () => {
    expect(getCoachAssignmentTemplate('missing-template')).toBe(COACH_ASSIGNMENT_TEMPLATES[0])
  })
})
