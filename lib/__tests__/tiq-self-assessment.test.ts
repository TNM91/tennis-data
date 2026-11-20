import {expect, it} from 'vitest'
import {readTiqAnswers, readTiqHistory, readTiqWrite, estimateTiqScore} from '../tiq-self-assessment'
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222'
const answers={serve:0,return:1,rally:2,movement:3,net:2,points:2}
const entry={id,date:'2026-11-19',answers,version:1,createdAt:'2026-11-19T12:00:00Z'}
const page={ok:true,owner,student:null,head:entry,items:[entry],next:null,coaches:[],moreCoaches:false,shares:[]}
it('retains equal skill weighting and optional paired formats without accepting a supplied score',()=>{
  expect(estimateTiqScore([0,0,0,0,0,0])).toBe(1)
  expect(estimateTiqScore([3,3,3,3,3,3])).toBe(10)
  expect(readTiqAnswers({...answers,'singles-build':0,'singles-cover':2})).toMatchObject({'singles-build':0})
  for(const input of [{...answers,score:10},{...answers,'singles-build':0},{...answers,serve:4},{...answers,net:null}]) expect(()=>readTiqAnswers(input)).toThrow()
})
it('requires an explicit head and rejects owner injection, unsupported versions and malformed dates',()=>{
  const write={kind:'save',id,date:entry.date,answers,version:1,expectedHead:null}
  expect(readTiqWrite(write)).toMatchObject({id,expectedHead:null})
  for(const input of [{...write,owner},{...write,expectedHead:undefined},{...write,date:'2026-02-30'},{...write,version:2}]) expect(()=>readTiqWrite(input)).toThrow()
})
it('withholds cross-account responses, duplicate history and unrelated share metadata',()=>{
  expect(readTiqHistory(page,owner).head?.answers.serve).toBe(0)
  for(const value of [{...page,owner:id},{...page,items:[entry,entry]}, {...page,shares:[{assessment:owner,student:'student',name:'Coach',operation:id,shared:true,active:true}]}]) expect(()=>readTiqHistory(value,owner)).toThrow()
  expect(()=>readTiqHistory({...page,student:'student',coaches:[{id:'student',name:'Coach',updatedAt:entry.createdAt}]},owner,'student')).toThrow()
})
