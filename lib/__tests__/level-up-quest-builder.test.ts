import { describe, expect, it } from 'vitest'
import { LEVEL_UP_CARDS } from '../level-up/level-up-cards'
import { buildLevelUpQuestBuilderPlan, LEVEL_UP_QUEST_TEMPLATES } from '../level-up/quest-builder'

describe('Level Up Quest Builder', () => {
  it('links every public quest template to real Level Up drill cards', () => {
    const cardIds = new Set(LEVEL_UP_CARDS.map((card) => card.id))

    expect(LEVEL_UP_QUEST_TEMPLATES.length).toBeGreaterThanOrEqual(6)
    for (const template of LEVEL_UP_QUEST_TEMPLATES) {
      expect(template.title).not.toMatch(/abs|weight|calorie/i)
      expect(template.linkedCardIds.length).toBeGreaterThan(0)
      expect(template.linkedCardIds.every((cardId) => cardIds.has(cardId))).toBe(true)
    }
  })

  it('builds drill-backed quest plans with Level Up deep links', () => {
    const plan = buildLevelUpQuestBuilderPlan('pressure-closer-4-0')

    expect(plan.categories).toEqual(expect.arrayContaining(['tennis-skill', 'fitness', 'nutrition-hydration', 'mindset', 'recovery', 'match-prep']))
    expect(plan.templates).toContainEqual(expect.objectContaining({
      id: 'pressure-reset',
      drillHref: expect.stringContaining('/level-up/pressure-closer-4-0?card='),
    }))
    expect(plan.templates.every((template) => template.primaryCard.id === template.drillHref.split('?card=')[1].split('#')[0])).toBe(true)
  })
})
