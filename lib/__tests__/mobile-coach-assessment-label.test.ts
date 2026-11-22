import {expect,it} from 'vitest'
import type {CoachAssessment} from '../native-coach-assessment-contract'
import {coachAssessmentChoiceLabel as label} from '../../mobile/src/coach-assessment-label'

const record=(id:string,createdAt:string,coach='Morgan Courts',context:CoachAssessment['observation']['context']='drill'):CoachAssessment=>({id,createdAt,coach,observation:{context,skills:{serve:2},focus:'serve',note:''}})
const before=record('z-earlier','2026-11-20T12:00:00.123400Z'),after=record('a-later','2026-11-20T06:00:00.123500-06:00')

it('preserves microsecond order across equivalent timezone offsets',()=>{
  expect(label(before,[after,before])).toContain('1 of 2')
  expect(label(after,[before,after])).toContain('2 of 2')
})
it('uses stable IDs for observations recorded at exactly the same instant',()=>{
  const a=record('a','2026-11-20T12:00:00Z'),b=record('b','2026-11-20T06:00:00-06:00')
  expect(label(a,[b,a])).toContain('1 of 2');expect(label(b,[a,b])).toContain('2 of 2')
  expect(label(a,[a,b])).toBe(label(a,[b,a]))
})
it('distinguishes loaded same-day observations across coaches and court contexts',()=>{
  const other=record('third','2026-11-20T12:01:00Z','Coach Alex','match'),rows=[other,after,before]
  expect(label(other,rows)).toContain('3 of 3 · Coach Alex · Match play')
  expect(label(after,rows)).toContain('2 of 3 · Morgan Courts · On-court drill')
})
it('numbers only the loaded local day and omits numbering for a single observation',()=>{
  const yesterday=record('yesterday','2026-11-19T12:00:00Z'),tomorrow=record('tomorrow','2026-11-21T12:00:00Z')
  expect(label(before,[yesterday,before,tomorrow])).not.toMatch(/\d of \d/)
  expect(label(before,[yesterday,after,before,tomorrow])).toContain('1 of 2')
})
it('does not reorder or modify authorized history or its observations',()=>{
  const rows=Object.freeze([Object.freeze(after),Object.freeze(before)])
  const original=JSON.stringify(rows);label(before,rows);expect(JSON.stringify(rows)).toBe(original)
})
it('does not invent an ordinal when the observation is not in the loaded records',()=>{
  const unknown=record('unknown','2026-11-20T12:02:00Z')
  expect(label(unknown,[before,after])).not.toMatch(/\d of \d/)
  expect(label(unknown,[before,after])).toContain('Morgan Courts · On-court drill')
})
