import {describe,expect,it} from 'vitest'
import type {TeamMatchReplies} from '../team-match-replies-contract'
import type {TeamNextMatchSchedule} from '../../mobile/src/team-room-data'
import {captainMatchStatus} from '../../mobile/src/captain-match-status'
import {teamReadinessHtml} from '../../mobile/src/team-match-readiness'
import {teamMatchBriefAction} from '../../mobile/src/team-match-brief'

const version='v1'
const schedule=():TeamNextMatchSchedule=>({revision:'match',nextMatch:{opponent:'Aces',date:'2030-06-09',time:'18:00',facility:'Court 2',timeZone:'America/Chicago'}})
function replies():TeamMatchReplies{
 const lineup={version,courts:[{format:'doubles' as const,players:['alex','blair']}],names:{alex:'Alex',blair:'Blair'}}
 return {own:null,team:[],awaiting:['Reserve'],rosterComplete:true,
  lineupRoster:[{id:'alex',name:'Alex',choice:'in'},{id:'blair',name:'Blair',choice:'in'},{id:'reserve',name:'Reserve',choice:null}],
  savedLineup:lineup,sharedLineup:lineup,lineupReplies:['alex','blair'].map(profileId=>({profileId,id:profileId,version,choice:'confirmed'}))}
}

describe('captain published match readiness',()=>{
 it('checks logistics before assignments and keeps the action on the exact missing field',()=>{
  const match=schedule();match.nextMatch!.time='';match.nextMatch!.facility=''
  expect(captainMatchStatus(match,replies()).next?.key).toBe('time')
  match.nextMatch!.time='18:00'
  expect(captainMatchStatus(match,replies()).next?.key).toBe('venue')
  expect(captainMatchStatus(null,replies()).state).toBe('unchecked')
 })
 it('counts only published players and does not block a ready team on an unused reserve',()=>{
  const result=captainMatchStatus(schedule(),replies())
  expect(result).toMatchObject({state:'ready',published:true,confirmations:'2 of 2',next:{key:'publication'}})
 })
 it('never calls availability an assignment confirmation',()=>{
  const data=replies();data.lineupReplies=[]
  expect(captainMatchStatus(schedule(),data)).toMatchObject({state:'confirmations',confirmations:'0 of 2'})
  data.lineupReplies=replies().lineupReplies!.map(reply=>({...reply,version:'old'}))
  expect(captainMatchStatus(schedule(),data).confirmations).toBe('0 of 2')
 })
 it.each(['out','maybe',null] as const)('reviews a published player who is %s even if their assignment was confirmed',choice=>{
  const data=replies();data.lineupRoster![1].choice=choice
  expect(captainMatchStatus(schedule(),data).state).toBe('review')
 })
 it('keeps change requests and departed players visible even when a private plan has already replaced them',()=>{
  const data=replies();data.lineupReplies![1].choice='needs_change'
  data.savedLineup={version:'private',courts:[{format:'singles',players:['alex']}],names:{alex:'Alex'}}
  expect(captainMatchStatus(schedule(),data)).toMatchObject({state:'review',next:{key:'publication'}})
  expect(teamMatchBriefAction(schedule(),data,'alex',true)).toEqual({label:'Review lineup changes',section:'publication'})
  data.lineupReplies![1].choice='confirmed';data.lineupRoster!.splice(1,1)
  expect(captainMatchStatus(schedule(),data).state).toBe('review')
 })
 it('distinguishes an unpublished plan and unpublished edits from a ready shared lineup',()=>{
  const data=replies();data.savedLineup={...data.savedLineup!,version:'private'}
  expect(captainMatchStatus(schedule(),data)).toMatchObject({state:'unpublished',published:true,next:{key:'lineup'}})
  delete data.sharedLineup;delete data.lineupReplies
  expect(captainMatchStatus(schedule(),data)).toMatchObject({state:'unpublished',published:false,confirmations:'Not published'})
  delete data.savedLineup
  expect(captainMatchStatus(schedule(),data).next?.label).toBe('Add court assignments')
 })
 it.each(['roster','responses','partial','missing player'] as const)('requires a recheck for %s without inventing a ready state',missing=>{
  const data=replies()
  if(missing==='roster')delete data.lineupRoster
  if(missing==='responses')delete data.lineupReplies
  if(missing==='partial')data.rosterComplete=false
  if(missing==='missing player'){data.rosterComplete=false;data.lineupRoster!.splice(1,1)}
  expect(captainMatchStatus(schedule(),data)).toMatchObject({state:'unchecked',next:{key:'reload'}})
 })
 it('labels private availability and shared confirmations separately without changing editor readiness',()=>{
  const data=replies();delete data.sharedLineup;delete data.lineupReplies
  const status=captainMatchStatus(schedule(),data)
  const markup=teamReadinessHtml(data,data.savedLineup!.courts,false,[],status)
  expect(markup).toContain('Private players In');expect(markup).toContain('Not published')
  expect(markup).toContain('your private lineup');expect(markup).not.toContain('Ready for match day')
  const editor=teamReadinessHtml(data,data.savedLineup!.courts,true)
  expect(editor).toContain('Assigned players in');expect(editor).not.toContain('Assignment confirmations')
 })
})
