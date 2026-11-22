import {describe,it,expect} from 'vitest'
import {locateWorkingCourt,workingCourtsForPlayer} from '../../mobile/src/captain-court-context'
import {captainCenterFixture} from '../../tests/fixtures/native-captain-match-center'

describe('working court review targets',()=>{
 it('locates the current court and seat by identity after reordering, despite duplicate labels and names',()=>{
  const data=captainCenterFixture().lineup
  data.roster.push({key:'other-jordan',playerId:'other-jordan',name:'Jordan Lee'})
  data.plan.courts.unshift({...data.plan.courts[0],id:'other-court',players:['other-jordan','']})
  expect(locateWorkingCourt(data,{courtId:'d1',playerKey:'jordan'})).toEqual({courtIndex:1,seatIndex:1})
  data.plan.courts.reverse()
  expect(locateWorkingCourt(data,{courtId:'d1',playerKey:'jordan'})).toEqual({courtIndex:0,seatIndex:1})
  expect(locateWorkingCourt(data,{courtId:'d1',playerKey:'other-jordan'})).toBeNull()
 })

 it('does not follow a player who moved to a different court',()=>{
  const data=captainCenterFixture().lineup
  data.plan.courts[0].players[1]=''
  data.plan.courts.push({id:'moved',label:'Singles',slotType:'singles',defaulted:false,players:['jordan']})
  expect(locateWorkingCourt(data,{courtId:'d1',playerKey:'jordan'})).toBeNull()
 })

 it('withholds a target for removed, defaulted or ambiguous court assignments',()=>{
  for(const change of ['removed','defaulted','duplicate-court','duplicate-seat'] as const){
   const data=captainCenterFixture().lineup
   if(change==='removed')data.plan.courts=[]
   if(change==='defaulted')data.plan.courts[0].defaulted=true
   if(change==='duplicate-court')data.plan.courts.push(structuredClone(data.plan.courts[0]))
   if(change==='duplicate-seat')data.plan.courts[0].players=['jordan','jordan']
   expect(locateWorkingCourt(data,{courtId:'d1',playerKey:'jordan'}),change).toBeNull()
  }
  expect(locateWorkingCourt(captainCenterFixture().lineup,{courtId:'',playerKey:''})).toBeNull()
 })

 it('shows the working doubles partner and no court for unassigned players or defaulted courts',()=>{
  const data=captainCenterFixture().lineup
  expect(workingCourtsForPlayer(data,'jordan')).toEqual([{courtId:'d1',playerKey:'jordan',index:0,label:'Doubles 1',detail:'Doubles · Partner: Alex Rivera'}])
  expect(workingCourtsForPlayer(data,'bench')).toEqual([])
  data.plan.courts[0].defaulted=true
  expect(workingCourtsForPlayer(data,'jordan')).toEqual([])
 })

 it('distinguishes an open partner, a removed partner and ambiguous assignments',()=>{
  const data=captainCenterFixture().lineup
  data.plan.courts[0].players=['','jordan']
  expect(workingCourtsForPlayer(data,'jordan')[0].detail).toBe('Doubles · Partner not assigned')
  data.plan.courts[0].players=['removed','jordan']
  expect(workingCourtsForPlayer(data,'jordan')[0].detail).toBe('Doubles · Partner no longer on roster')
  data.plan.courts[0].players=['jordan','jordan']
  expect(workingCourtsForPlayer(data,'jordan')[0].detail).toBe('Doubles · Check the court assignments')
 })

 it('does not add a partner to a singles court',()=>{
  const data=captainCenterFixture().lineup
  data.plan.courts=[{id:'single',label:'Court A',slotType:'singles',defaulted:false,players:['jordan']}]
  expect(workingCourtsForPlayer(data,'jordan')[0]).toMatchObject({label:'Court A',detail:'Singles'})
 })
})
