import {describe,it,expect} from 'vitest'
import {playerLevelPath} from '../player-level-path'
import {labLevelPathHtml} from '../../mobile/src/lab-level-path'
import {ratingsHtml} from '../../mobile/src/player-ratings-view'
const player={overall_dynamic_rating:4.25,overall_usta_dynamic_rating:4.1,rating_source:'verified'}
describe('shared My Lab level path',()=>{
 it('preserves the website half-point band, comparison and remaining distance',()=>{
  expect(playerLevelPath(4.25,4.1)).toMatchObject({ustaBase:4,nextUstaLevel:4.5,levelProgress:50,hasLevelProgress:true,ratingToGo:.25,levelStatus:'Trending up'})
  expect(playerLevelPath(4,4)).toMatchObject({levelStatus:'Holding steady',levelProgress:0})
  expect(playerLevelPath(3.9,4.1).levelStatus).toBe('Needs work')
 })
 it('clamps only progress and remaining distance, preserving the website minimum base',()=>{
  expect(playerLevelPath(3,4.1)).toMatchObject({levelProgress:0,ratingToGo:1.5})
  expect(playerLevelPath(5,4.1)).toMatchObject({levelProgress:100,ratingToGo:0})
  expect(playerLevelPath(2.75,2)).toMatchObject({ustaBase:2.5,nextUstaLevel:3,levelProgress:50})
 })
 it('never substitutes self-ratings or missing estimates',()=>{
  for(const path of [playerLevelPath(4.25,4.1,true),playerLevelPath(null,4.1),playerLevelPath(4.25,null)])expect(path).toMatchObject({hasLevelProgress:false,levelProgress:0,tiqVsUsta:null,ratingToGo:null})
  expect(playerLevelPath(4.25,4.1,true).ustaBase).toBeNull()
 })
 it('rejects nonfinite, string and out-of-range values without rendering a meter',()=>{
  for(const value of [NaN,Infinity,'4.2',0,8,undefined]){
   expect(playerLevelPath(value,4.1).hasLevelProgress).toBe(false)
   expect(playerLevelPath(4.1,value).hasLevelProgress).toBe(false)
  }
 })
 it('labels estimates, band arithmetic and temporal limits explicitly',()=>{
  const output=labLevelPathHtml(player)
  expect(output).toContain('value="50"')
  expect(output).toContain('USTA-derived dynamic')
  expect(output).toContain('0.25 TIQ points')
  expect(output).toContain('not a promotion forecast')
  expect(output).toContain('does not measure change over time')
 })
 it('keeps pending comparisons separate and only adds the panel to My Lab',()=>{
  const self={...player,rating_source:'self'}
  expect(labLevelPathHtml(self)).not.toContain('<meter')
  expect(labLevelPathHtml(self)).toContain('Self-rated record')
  expect(labLevelPathHtml({...player,overall_dynamic_rating:NaN})).not.toContain('NaN')
  expect(ratingsHtml(player)).not.toContain('lab-level-path')
  expect(ratingsHtml(player,true)).toContain('lab-level-path')
 })
})
