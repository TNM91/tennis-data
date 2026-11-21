import {describe,it,expect} from 'vitest'
import {centerReplyReview,centerStepsHtml} from '../../mobile/src/captain-match-center-view'
import {captainCenterFixture} from '../../tests/fixtures/native-captain-match-center'

describe('captain reply review for the working lineup',()=>{
 it('uses lineup identities instead of a reply selection flag or a matching name',()=>{
  const center=captainCenterFixture()
  center.lineup.roster.push({key:'bench',playerId:'bench',name:'Jordan Lee'})
  center.replies.people.push({key:'bench',name:'Jordan Lee',status:'waiting',source:'player',selected:true})
  const review=centerReplyReview(center)
  expect(review).toMatchObject({selected:2,needsReview:1})
  expect(review.people.filter(person=>person.selected).map(person=>person.key)).toEqual(['alex','jordan'])
  expect(review.people.find(person=>person.key==='bench')).toMatchObject({selected:false,status:'waiting'})
  expect(centerStepsHtml(center,'availability')).toContain('1 needs review')
 })

 it('keeps a missing selected-player reply visible despite an available same-name roster player',()=>{
  const center=captainCenterFixture()
  center.replies.people=center.replies.people.filter(person=>person.key!=='jordan')
  center.replies.people.push({key:'other-jordan',name:'Jordan Lee',status:'available',source:'player',selected:true})
  const review=centerReplyReview(center)
  expect(review).toMatchObject({selected:2,needsReview:1})
  expect(review.people.find(person=>person.key==='jordan')).toMatchObject({name:'Jordan Lee',status:'unmatched',source:'',selected:true})
  expect(review.people.find(person=>person.key==='other-jordan')).toMatchObject({status:'available',selected:false})
 })

 it('does not count players on defaulted courts as selected or mark an empty lineup checked',()=>{
  const center=captainCenterFixture();center.lineup.plan.courts[0].defaulted=true
  const review=centerReplyReview(center)
  expect(review).toMatchObject({selected:0,needsReview:0})
  expect(review.people.every(person=>!person.selected)).toBe(true)
  expect(centerStepsHtml(center,'availability')).toContain('No players selected')
 })

 it('includes selected Unavailable, Maybe and Waiting players in the review count',()=>{
  for(const status of ['unavailable','maybe','waiting'] as const){
   const center=captainCenterFixture();center.replies.people[0].status=status
   expect(centerReplyReview(center)).toMatchObject({selected:2,needsReview:2})
   expect(centerStepsHtml(center,'availability')).toContain('2 need review')
  }
 })

 it('does not treat a removed roster identity as available or double-count duplicate court assignments',()=>{
  const center=captainCenterFixture();center.lineup.roster=center.lineup.roster.filter(person=>person.key!=='alex')
  center.lineup.plan.courts.push({...center.lineup.plan.courts[0],id:'duplicate-court'})
  const review=centerReplyReview(center)
  expect(review).toMatchObject({selected:2,needsReview:2})
  expect(review.people.find(person=>person.key==='alex')).toMatchObject({name:'Player no longer on roster',status:'unmatched',source:'',selected:true})
 })
})
