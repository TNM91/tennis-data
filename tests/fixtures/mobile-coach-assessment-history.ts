import type {CoachAssessment, CoachObservation} from '../../lib/native-coach-assessment-contract'
const entry = (n: number, day: string, context: CoachObservation['context'], skills: CoachObservation['skills'], focus: CoachObservation['focus']): CoachAssessment =>
  ({id: `cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12, '0')}`, coach: 'Morgan Courts', createdAt: day + 'T18:00:00Z', observation: {context, skills, focus, note: 'Saved court observation ' + n}})
export const coachAssessmentHistoryFixture = {
  enabled: new URL(location.href).searchParams.has('assessment-history'), failed: false, reads: 0,
  assessments: [
    entry(6, '2026-11-20', 'match', {serve: 3}, 'serve'),
    entry(1, '2026-11-01', 'drill', {serve: 0, return: 1}, 'serve'),
    entry(3, '2026-11-18', 'drill', {serve: 2, return: 2, movement: 1, rally: 0}, 'serve'),
    entry(5, '2026-11-10', 'lesson', {serve: 1, movement: 2}, 'movement'),
    entry(2, '2026-11-12', 'drill', {serve: 1, return: 2, movement: 3, net: 0}, 'return'),
    entry(4, '2026-11-03', 'lesson', {serve: 1}, 'serve'),
  ],
}
if (new URL(location.href).searchParams.get('assessment-history') === 'cap') {
  coachAssessmentHistoryFixture.assessments.push(...Array.from({length: 6}, (_, index) => entry(index + 7, '2026-10-' + String(index + 10), 'lesson', {serve: 0}, 'serve')))
}
if (new URL(location.href).searchParams.get('assessment-history') === 'same-day') {
  coachAssessmentHistoryFixture.assessments.find(row => row.id.endsWith('000000000002'))!.createdAt = '2026-11-18T17:00:00Z'
}
if (coachAssessmentHistoryFixture.enabled) Object.assign(window, {coachAssessmentHistoryFixture})
