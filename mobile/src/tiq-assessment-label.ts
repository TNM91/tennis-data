import {chatTimestamp} from '../../lib/chat-timestamp'
import {tiqSkills} from '../../lib/tiq-assessment-skills'
import {estimateTiqScore, type TiqAssessment} from '../../lib/tiq-self-assessment'

const assessmentDate = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'})

// Number only the loaded records. Save instants retain Postgres microseconds;
// input order and optional format answers do not change an assessment's label.
export function tiqAssessmentChoiceLabel(entry: TiqAssessment, rows: readonly TiqAssessment[]) {
  const sameDay = rows.filter(row => row.date === entry.date).sort((a, b) => {
    const first = chatTimestamp(a.createdAt)!, second = chatTimestamp(b.createdAt)!
    return first < second ? -1 : first > second ? 1 : a.id.localeCompare(b.id)
  })
  const position = sameDay.findIndex(row => row.id === entry.id)
  const numbered = sameDay.length > 1 && position >= 0 ? ` · ${position + 1} of ${sameDay.length}` : ''
  const score = estimateTiqScore(tiqSkills.map(skill => entry.answers[skill.id]))
  return `${assessmentDate.format(new Date(entry.date + 'T12:00:00Z'))}${numbered} · TiQ ${score}/10`
}
