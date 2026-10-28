import {describe,it,expect} from 'vitest'
import {playerLevelPath} from '../player-level-path'
import {publishedUstaRating,publishedUstaLabel} from '../published-usta-rating'
import {labLevelPathHtml} from '../../mobile/src/lab-level-path'
import {ratingsHtml} from '../../mobile/src/player-ratings-view'
const player={overall_rating:4,overall_dynamic_rating:4.25,overall_usta_dynamic_rating:4.42,rating_source:'verified'}
describe('TIQ bands and published USTA current',()=>{
 it('takes USTA current only from a verified published half-point value, never a dynamic estimate',()=>{
  expect(publishedUstaRating(player)).toBe(4);expect(publishedUstaLabel(player)).toBe('4.0')
  for(const p of [{...player,overall_rating:4.42},{...player,overall_rating:null},{...player,rating_source:'self'},{...player,rating_source:null},{...player,overall_rating:Infinity},{...player,overall_rating:''},{...player,overall_rating:true}])expect(publishedUstaRating(p)).toBeNull()
  expect(publishedUstaRating({...player,overall_rating:'4.5'})).toBe(4.5)
 })
 it('anchors progress to the TIQ half-point band independently of USTA current',()=>{
  for(const usta of [4,4.5,null,4.42])expect(playerLevelPath(4.25,usta)).toMatchObject({tiqBase:4,nextTiqBand:4.5,levelProgress:50,hasLevelProgress:true,ratingToGo:.25,levelStatus:'Within TIQ band'})
  expect(playerLevelPath(4.42,4).levelProgress).toBeCloseTo(84);expect(playerLevelPath(4.42,4).levelStatus).toBe('Upper TIQ band')
  expect(playerLevelPath(3.9,4.5).tiqBase).toBe(3.5)
  expect(playerLevelPath(7,4)).toMatchObject({hasLevelProgress:false,nextTiqBand:null,levelStatus:'Top TIQ band'})
 })
 it('withholds progress for self-rated or invalid TIQ without fabricating values',()=>{
  expect(playerLevelPath(4.25,4,true)).toMatchObject({hasLevelProgress:false,levelProgress:0,ratingToGo:null})
  for(const value of [NaN,Infinity,'4.2',0,8,undefined])expect(playerLevelPath(value,4)).toMatchObject({hasLevelProgress:false,tiqVsUsta:null})
 })
 it('renders TIQ progress and USTA current separately, never relabeling the legacy4.42 estimate',()=>{
  const output=labLevelPathHtml(player)
  expect(output).toContain('value="50"');expect(output).toContain('USTA current');expect(output).toContain('<dd>4.0</dd>');expect(output).not.toContain('4.42');expect(output).not.toContain('USTA-derived');expect(output).toContain('0.25 TIQ points');expect(output).toContain('do not predict a USTA promotion');expect(output).toContain('does not measure change over time')
  expect(labLevelPathHtml({...player,overall_rating:null})).toContain('Pending verification');expect(labLevelPathHtml({...player,overall_rating:null})).toContain('<meter')
  expect(ratingsHtml(player,true,true)).toContain('USTA current: <strong>4.0</strong>')
 })
 it('keeps starting estimates distinct and only mounts guidance when requested',()=>{
  const self={...player,rating_source:'self'};expect(labLevelPathHtml(self)).not.toContain('<meter');expect(labLevelPathHtml(self)).toContain('Self-rated record');expect(labLevelPathHtml({...player,overall_dynamic_rating:NaN})).not.toContain('NaN');expect(ratingsHtml(player)).not.toContain('lab-level-path');expect(ratingsHtml(player,true)).toContain('lab-level-path')
 })
})
