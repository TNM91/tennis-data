import {expect, it} from 'vitest'
import type {CoachAssessment, CoachObservation} from '../native-coach-assessment-contract'
import {assessmentComparison, comparableAssessmentContexts, contextAssessments} from '../../mobile/src/coach-assessment-comparison'

const assessment = (id: string, createdAt: string, skills: CoachObservation['skills'], context: CoachObservation['context'] = 'drill'): CoachAssessment =>
  ({id, createdAt, coach: 'Morgan Courts', observation: {context, skills, focus: null, note: ''}})
const earlier = assessment('earlier', '2026-11-12T12:00:00Z', {serve: 1, return: 2, movement: 3, net: 0})
const later = assessment('later', '2026-11-18T12:00:00Z', {serve: 2, return: 2, movement: 1, rally: 0})
const selection = {context: 'drill' as const, earlier: 'earlier', later: 'later'}

it('compares only shared observations and keeps missing observations distinct from the Learning level', () => {
  const result = assessmentComparison([later, earlier], selection)!
  expect(result).toMatchObject({comparable: 3, higher: 1, same: 1, lower: 1})
  expect(result.skills.find(row => row.id === 'serve')).toMatchObject({before: 1, after: 2, direction: 'higher'})
  expect(result.skills.find(row => row.id === 'movement')).toMatchObject({direction: 'lower'})
  expect(result.skills.find(row => row.id === 'rally')).toMatchObject({before: undefined, after: 0, direction: 'first'})
  expect(result.skills.find(row => row.id === 'net')).toMatchObject({before: 0, after: undefined, direction: 'unobserved'})
  expect(result.skills.some(row => row.id === 'points')).toBe(false)
})

it('does not compare different court contexts, reversed dates, the same assessment, or another coach', () => {
  for (const rows of [[earlier, {...later, observation: {...later.observation, context: 'match' as const}}],
    [earlier, {...later, coach: 'Another coach'}]]) expect(assessmentComparison(rows, selection)).toBeNull()
  expect(assessmentComparison([earlier, later], {...selection, earlier: 'later', later: 'earlier'})).toBeNull()
  expect(assessmentComparison([earlier, later], {...selection, earlier: 'later'})).toBeNull()
  expect(assessmentComparison([earlier], selection)).toBeNull()
})

it('groups eligible contexts using actual chronology without mutating the loaded history', () => {
  const rows = [earlier, assessment('lesson-old', '2026-11-13T12:00:00Z', {serve: 1}, 'lesson'), later,
    assessment('lesson-new', '2026-11-19T12:00:00Z', {serve: 3}, 'lesson'), assessment('match-only', '2026-11-20T12:00:00Z', {serve: 2}, 'match')]
  const ids = rows.map(row => row.id)
  expect(comparableAssessmentContexts(rows)).toEqual(['lesson', 'drill'])
  expect(contextAssessments(rows, 'drill').map(row => row.id)).toEqual(['later', 'earlier'])
  expect(rows.map(row => row.id)).toEqual(ids)
})

it('preserves microsecond chronology and refuses an equal-time or duplicate-ID comparison', () => {
  const a = {...earlier, createdAt: '2026-11-18T12:00:00.123400Z'}
  const b = {...later, createdAt: '2026-11-18T06:00:00.123500-06:00'}
  expect(assessmentComparison([b, a], selection)?.comparable).toBe(3)
  expect(comparableAssessmentContexts([a, {...b, createdAt: a.createdAt}])).toEqual([])
  expect(assessmentComparison([a, {...b, createdAt: a.createdAt}], selection)).toBeNull()
  expect(assessmentComparison([a, b, b], selection)).toBeNull()
})

it('never treats disjoint observations as gains or losses', () => {
  const a = {...earlier, observation: {...earlier.observation, skills: {serve: 3 as const}}}
  const b = {...later, observation: {...later.observation, skills: {net: 0 as const}}}
  expect(assessmentComparison([a, b], selection)).toMatchObject({comparable: 0, higher: 0, lower: 0, same: 0})
})
