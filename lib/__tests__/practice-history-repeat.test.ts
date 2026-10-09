import { describe, expect, it } from 'vitest'
import { buildPracticeHistoryRepeatHref } from '../practice-history-repeat'
const setup = { focusId: 'movement', workType: 'court', context: 'alone' }
describe('practice history repeat links', () => {
  it('restores the card, focus, work type, and setup without including proof data', () => {
    const url = new URL(buildPracticeHistoryRepeatHref('relentless-competitor-4-0', setup, { cardId: 'split-step-rhythm' }), 'https://tenaceiq.test')
    expect(Object.fromEntries(url.searchParams)).toEqual({ focus: 'movement', workType: 'court', context: 'alone', card: 'split-step-rhythm' })
    expect(url.hash).toBe('#level-up-flow')
  })
  it('preserves coach assignment scope for a resolved legacy drill', () => {
    const url = new URL(buildPracticeHistoryRepeatHref('style', { ...setup, context: 'coach', assignmentId: 'assigned', studentLinkId: 'linked' }, { drillId: 'movement-coach-court' }), 'https://tenaceiq.test')
    expect(url.searchParams.get('drill')).toBe('movement-coach-court')
    expect(url.searchParams.get('assignmentId')).toBe('assigned')
    expect(url.searchParams.get('studentLinkId')).toBe('linked')
    expect(url.searchParams.get('coach')).toBe('1')
  })
  it('does not offer a repeat link when the saved drill cannot be resolved', () => {
    expect(buildPracticeHistoryRepeatHref('style', setup, null)).toBe('')
  })
})
