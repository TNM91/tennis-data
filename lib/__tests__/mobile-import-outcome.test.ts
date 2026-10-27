import {describe,it,expect} from 'vitest'
import {savedImportOutcome,importOutcomeHtml} from '../../mobile/src/data-import-outcome'
import {availableImportActions} from '../../mobile/src/data-import-actions'
import {readImportBatches,readImportDetail} from '../../mobile/src/data-imports-data'
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222'
const batch=readImportBatches([{id,submitted_by_user_id:owner,requested_import_type:'scorecard',status:'needs_review',screenshot_count:1,created_at:'2026-10-26',updated_at:'2026-10-26'}],owner).batches[0]
const detail=readImportDetail([{id:'33333333-3333-4333-8333-333333333333',batch_id:id,submitted_by_user_id:owner,draft_type:'scorecard',status:'ready_for_verification',ocr_status:'processed',parsed_payload:{lines:[{lineLabel:'Doubles 1'}]},validation_summary:{}}],batch)!
describe('saved upload outcome guidance',()=>{
 it('distinguishes imports, duplicates and recorded failed rows',()=>{
  const imported={...batch,status:'imported'}
  expect(savedImportOutcome(imported,detail).state).toBe('imported')
  expect(savedImportOutcome(imported,{...detail,duplicate:true}).state).toBe('duplicate')
  expect(savedImportOutcome(imported,{...detail,duplicate:true,outcome:[['Failed','1']]}).state).toBe('partial')
  expect(importOutcomeHtml(imported,{...detail,duplicate:true})).toContain('No row totals were recorded')
  expect(importOutcomeHtml(imported,detail)).not.toContain('<dt>Failed</dt>')
 })
 it('withholds actions for a confirmation already recorded on the upload',()=>{
  const waiting={...batch,status:'verified'}
  expect(savedImportOutcome(waiting,detail).state).toBe('waiting')
  expect(availableImportActions(waiting,detail)).toEqual([])
 })
 it('keeps rejected and conflicting outcomes separate from success',()=>{
  const rejected={...batch,status:'rejected'}
  expect(savedImportOutcome(rejected,detail).state).toBe('rejected')
  expect(savedImportOutcome(rejected,{...detail,status:'imported'}).state).toBe('conflict')
  expect(availableImportActions(rejected,detail)).toEqual([])
 })
 it('does not offer unavailable review or reading controls in its guidance',()=>{
  for(const total of [0,1,101])expect(savedImportOutcome(batch,{...detail,status:'blocked',total}).next).not.toContain('below')
  expect(savedImportOutcome(batch,{...detail,ocr:'',status:'blocked'}).state).toBe('unknown')
  expect(savedImportOutcome(batch,{...detail,ocr:'not_started',status:'blocked'}).state).toBe('ready')
  expect(savedImportOutcome(batch,{...detail,ocr:'failed',status:'blocked'}).state).toBe('read-failed')
 })
 it('distinguishes pending reads, empty extraction, large drafts and missing drafts',()=>{
  expect(savedImportOutcome(batch,{...detail,ocr:'processing'}).state).toBe('reading')
  expect(savedImportOutcome(batch,{...detail,total:0}).title).toBe('No rows extracted')
  expect(savedImportOutcome(batch,{...detail,total:101}).next).toContain('first 100 rows')
  expect(savedImportOutcome(batch,null).state).toBe('missing')
 })
 it('escapes recorded labels and values in the summary',()=>{
  const output=importOutcomeHtml(batch,{...detail,outcome:[['<script>','<img>']]})
  expect(output).toContain('&lt;script&gt;')
  expect(output).toContain('&lt;img&gt;')
  expect(output).not.toContain('<script>')
 })
})
