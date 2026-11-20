import {describe, expect, it} from 'vitest'
import {orderedTiqProgress, tiqProgressComparison, tiqProgressSelection} from '../../mobile/src/tiq-progress-comparison'
import type {TiqAssessment, TiqAnswers} from '../tiq-self-assessment'

const answers: TiqAnswers = {serve: 2, return: 2, rally: 2, movement: 2, net: 2, points: 2}
const entry = (id: string, date: string, createdAt = '2026-11-20T12:00:00Z', values: TiqAnswers = answers): TiqAssessment =>
  ({id, date, createdAt, answers: values, version: 1})

describe('TiQ self-assessment progress', () => {
  it('compares assessment dates ahead of import dates and preserves the input order', () => {
    const rows = [entry('older-import', '2026-11-17', '2026-11-20T14:00:00Z'), entry('later', '2026-11-19')]
    expect(orderedTiqProgress(rows).map(row => row.id)).toEqual(['later', 'older-import'])
    expect(rows.map(row => row.id)).toEqual(['older-import', 'later'])
    expect(tiqProgressSelection(rows)).toEqual({earlier: 'older-import', later: 'later'})
    expect(tiqProgressComparison(rows, {earlier: 'later', later: 'older-import'})).toBeNull()
  })

  it('preserves microsecond save order for multiple assessments on the same day', () => {
    const rows = [entry('first', '2026-11-19', '2026-11-20T12:00:00.000001Z'), entry('second', '2026-11-19', '2026-11-20T06:00:00.000002-06:00')]
    expect(tiqProgressSelection(rows)).toEqual({earlier: 'first', later: 'second'})
    expect(tiqProgressComparison(rows, {earlier: 'second', later: 'first'})).toBeNull()
  })

  it('does not fabricate an order for equal instants or compare missing, duplicate or identical records', () => {
    const rows = [entry('one', '2026-11-19'), entry('two', '2026-11-19')]
    expect(tiqProgressSelection(rows)).toBeNull()
    expect(tiqProgressComparison(rows, {earlier: 'one', later: 'two'})).toBeNull()
    expect(tiqProgressComparison(rows, {earlier: 'missing', later: 'two'})).toBeNull()
    expect(tiqProgressSelection([rows[0], rows[0]])).toBeNull()
    expect(tiqProgressSelection([{...rows[0], createdAt: 'invalid'}, rows[1]])).toBeNull()
    expect(tiqProgressSelection([rows[0]])).toBeNull()
  })

  it('shows skill-level changes even when the rounded TiQ stays the same, without counting optional format answers', () => {
    const rows = [entry('before', '2026-11-17'), entry('after', '2026-11-19', undefined,
      {...answers, serve: 3, return: 1, 'singles-build': 0, 'singles-cover': 0})]
    const comparison = tiqProgressComparison(rows, {earlier: 'before', later: 'after'})!
    expect(comparison.before).toBe(7)
    expect(comparison.after).toBe(7)
    expect(comparison.skills).toHaveLength(6)
    expect([comparison.higher, comparison.same, comparison.lower]).toEqual([1, 4, 1])
    expect(comparison.skills.find(skill => skill.id === 'serve')).toMatchObject({before: 2, after: 3, direction: 'higher'})
    expect(comparison.skills.find(skill => skill.id === 'return')).toMatchObject({before: 2, after: 1, direction: 'lower'})
  })

  it('retains the exact selected records when earlier history is loaded', () => {
    const rows = [entry('newest', '2026-11-19'), entry('middle', '2026-11-18'), entry('oldest', '2026-11-17')]
    const selected = {earlier: 'oldest', later: 'middle'}
    expect(tiqProgressSelection([...rows, entry('extra', '2026-11-16')], selected)).toEqual(selected)
    expect(tiqProgressComparison(rows.slice(0, 2), selected)).toBeNull()
  })
})
