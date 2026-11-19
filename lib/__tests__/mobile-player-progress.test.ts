import {expect, it} from 'vitest'
import type {CoachAssessment} from '../native-coach-assessment-contract'
import {assessmentPractice, playerObservations, playerPracticePriority, savedPracticeWeek, selfSkill, type SelfAssessmentHistory} from '../../mobile/src/player-progress-model'
import type {TrainingSession} from '../../mobile/src/level-up-data'
import type {TrainingCoachWork} from '../../mobile/src/training-inbox-data'
const self: SelfAssessmentHistory = {history: {current: {date: '2026-11-19', answers: {serve: 1, return: 2, rally: 2, movement: 2, net: 2, points: 2}}, previous: null}, legacy: undefined}
const observation = (id: string, createdAt: string, skills: CoachAssessment['observation']['skills'], context: CoachAssessment['observation']['context'] = 'drill', coach = 'Taylor'): CoachAssessment =>
  ({id, createdAt, coach, observation: {context, skills, focus: Object.keys(skills)[0] as 'serve', note: ''}})
const earlier = observation('first', '2026-11-18T12:00:00.123400Z', {serve: 0, return: 2, net: 0})
const later = observation('last', '2026-11-18T06:00:00.123500-06:00', {serve: 2, return: 1, rally: 0})
it('compares strictly earlier observations in the chosen context with microsecond precision', () => {
  const match = observation('match', '2026-11-19T18:00:00Z', {serve: 3}, 'match')
  const result = playerObservations([earlier, match, later], 'drill')
  expect(result.latest?.id).toBe('last'); expect(result.earlier?.id).toBe('first')
  expect(result.contexts).toEqual(['match', 'drill'])
  expect(result.changes.find(row => row.id === 'serve')).toMatchObject({before: 0, after: 2, direction: 'higher'})
  expect(result.changes.find(row => row.id === 'net')).toMatchObject({before: 0, after: undefined, direction: 'unobserved'})
  expect(result.changes.find(row => row.id === 'rally')).toMatchObject({before: undefined, after: 0, direction: 'first'})
  expect(result.changes.find(row => row.id === 'return')?.direction).toBe('lower')
})
it('keeps both coach labels and does not infer identity from a shared or changed display name', () => {
  const result = playerObservations([earlier, {...later, coach: 'Morgan'}], 'drill')
  expect(result.earlier?.coach).toBe('Taylor'); expect(result.latest?.coach).toBe('Morgan')
  expect(result.changes).toHaveLength(4)
})
it('does not compare tied timestamps, duplicate IDs, or a different court context', () => {
  expect(playerObservations([earlier, {...later, createdAt: earlier.createdAt}], 'drill').earlier).toBeUndefined()
  expect(playerObservations([earlier, later, later], 'drill').latest).toBeUndefined()
  expect(playerObservations([earlier, {...later, observation: {...later.observation, context: 'match'}}], 'drill').earlier).toBeUndefined()
})
it('takes the selected coach priority first and preserves the separate self-assessment', () => {
  const before = JSON.stringify(self)
  expect(playerPracticePriority(self, later)).toMatchObject({source: 'coach', drill: {id: 'serve-target-call'}, assessment: later})
  expect(playerPracticePriority(self)).toMatchObject({source: 'self', drill: {id: 'serve-target-call'}})
  expect(playerPracticePriority({history: null, legacy: [1,1,1]})).toBeNull()
  expect(selfSkill(self, 'serve')).toBe(1)
  expect(JSON.stringify(self)).toBe(before)
})
it('only links the exact observed drill assignment through a currently active coach connection', () => {
  const assignment: TrainingCoachWork['assignments'][number] = {id: later.id, studentLinkId: 'link', title: 'Serve Target Call',
    focus: 'Serve', dueDate: null, status: 'assigned', updatedAt: later.createdAt, assignment: {cardId: 'serve-target-call'}}
  const work: TrainingCoachWork = {links: [{id: 'link', status: 'active', identitySlug: ''}], assignments: [assignment]}
  expect(assessmentPractice(work, later, 'serve-target-call')).toBe(assignment)
  expect(assessmentPractice(work, later, 'split-step-rhythm')).toBeUndefined()
  expect(assessmentPractice(work, earlier, 'serve-target-call')).toBeUndefined()
  expect(assessmentPractice({...work, links: [{id: 'link', status: 'paused', identitySlug: ''}]}, later, 'serve-target-call')).toBeUndefined()
})
it('counts saved practice days in local calendar time and excludes future or older records', () => {
  const now = new Date(2026, 10, 19, 23, 45), row = (id: string, date: Date): TrainingSession =>
    ({id, completedAt: date.toISOString(), elapsedSeconds: 300} as TrainingSession)
  const rows = [row('one', new Date(2026,10,19,8)), row('two', new Date(2026,10,19,18)), row('edge', new Date(2026,10,13,0,1)),
    row('old', new Date(2026,10,12,23,59)), row('future', new Date(2026,10,20,0,1))]
  const result = savedPracticeWeek(rows, now)
  expect(result).toMatchObject({count: 3, minutes: 15, activeDays: 2, latest: {id: 'two'}})
  expect(result.days.map(day => day.count)).toEqual([1,0,0,0,0,0,2])
  expect(rows[0].id).toBe('one')
})
it('can show an earlier latest session without counting it as practice in the current week', () => {
  const row = {completedAt: new Date(2026,9,1).toISOString(), elapsedSeconds: 300} as TrainingSession
  expect(savedPracticeWeek([row], new Date(2026,10,19))).toMatchObject({count: 0, activeDays: 0, minutes: 0, latest: row})
})
