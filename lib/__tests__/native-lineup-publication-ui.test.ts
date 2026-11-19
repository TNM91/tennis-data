import {expect,it} from 'vitest'
import {availableLineupReserves,lineupConfirmationReminder,lineupConfirmationSummary,lineupPublicationHtml,lineupPublishPreviewHtml} from '../../mobile/src/team-lineup-publication'
import type {TeamMatchReplies} from '../team-match-replies-contract'

const player='22222222-2222-4222-8222-222222222222',captain='11111111-1111-4111-8111-111111111111',
 version='55555555-5555-4555-8555-555555555555'
const courts=[{format:'singles' as const,players:[player]}]
it('offers unassigned In players as reserves and escapes published previews',()=>{
 expect(availableLineupReserves(courts,[{id:player,name:'Alex',choice:'in'},{id:captain,name:'Blair',choice:'in'},{id:version,name:'Casey',choice:'maybe'}]))
  .toEqual([{id:captain,name:'Blair',choice:'in'}])
 const preview=lineupPublishPreviewHtml(courts,[{id:player,name:'<Alex>',choice:'in'}])
 expect(preview).toContain('&lt;Alex&gt;');expect(preview).not.toContain('<Alex>')
})
it('does not count a removed player as a current confirmed assignment',()=>{
 const removed=lineupPublicationHtml({own:null,sharedLineup:{version,courts,names:{[player]:'Alex'}},rosterComplete:true,lineupRoster:[],
  lineupReplies:[{profileId:player,id:captain,version,choice:'confirmed'}]},captain,true,false)
 expect(removed).toContain('0 of 1 assignments confirmed');expect(removed).toContain('No longer on roster')
})

function confirmationFixture():TeamMatchReplies{
 return {own:null,rosterComplete:true,
  sharedLineup:{version,courts:[{format:'doubles',players:[player,captain]},{format:'singles',players:['reserve']}],
   names:{[player]:'<Alex>',[captain]:'Blair',reserve:'Casey'}},
  lineupRoster:[{id:player,name:'<Alex>',choice:'in'},{id:captain,name:'Blair',choice:'out'},{id:'reserve',name:'Casey',choice:'in'}],
  lineupReplies:[{profileId:player,id:captain,version,choice:'confirmed'},{profileId:captain,id:player,version,choice:'confirmed'}]}
}

it('prioritizes an unavailable assignment over its old confirmation and attaches court context',()=>{
 const summary=lineupConfirmationSummary(confirmationFixture())
 expect(summary).toMatchObject({checked:true,confirmed:1,awaiting:1,review:1,unknown:0})
 expect(summary.rows.map(row=>[row.name,row.court,row.reason])).toEqual([
  ['Blair','Doubles 1','Can’t play'],['Casey','Singles 1','Awaiting confirmation'],['<Alex>','Doubles 1','Confirmed']])
 const markup=lineupPublicationHtml(confirmationFixture(),captain,true,false)
 expect(markup).toContain('aria-label="Review court for Blair"')
 expect(markup).toContain('&lt;Alex&gt;');expect(markup).not.toContain('<Alex>')
})

it('keeps change requests distinct from unanswered assignments and ignores confirmations for another version',()=>{
 const fixture=confirmationFixture()
 fixture.lineupRoster![1].choice='in'
 fixture.lineupReplies![0].choice='needs_change'
 fixture.lineupReplies![1].version='another-version'
 expect(lineupConfirmationSummary(fixture)).toMatchObject({confirmed:0,awaiting:2,review:1})
 expect(lineupConfirmationSummary(fixture).rows[0].reason).toBe('Needs a change')
})

it('does not invent pending confirmations when confirmation data or part of the roster is missing',()=>{
 const fixture=confirmationFixture()
 fixture.lineupReplies=undefined
 expect(lineupConfirmationSummary(fixture)).toMatchObject({checked:false,confirmed:0,awaiting:0,review:1,unknown:2})
 expect(()=>lineupConfirmationReminder(fixture,'Saturday')).toThrow('Reload the match')
 fixture.lineupReplies=[];fixture.rosterComplete=false;fixture.lineupRoster=[]
 expect(lineupConfirmationSummary(fixture)).toMatchObject({awaiting:0,review:0,unknown:3})
 expect(lineupConfirmationReminder(fixture,'Saturday')).toBeNull()
})

it('drafts only unanswered published assignments without including unavailable, confirmed or private-only players',()=>{
 const fixture=confirmationFixture()
 fixture.savedLineup={version:'private',courts:[{format:'singles',players:['private-player']}],names:{'private-player':'Private Player'}}
 const message=lineupConfirmationReminder(fixture,'our match vs Topspin')!
 expect(message).toContain('Casey — please open Team → Next match')
 for(const name of ['Alex','Blair','Private Player'])expect(message).not.toContain(name)
 expect(lineupPublicationHtml(fixture,captain,true,false)).toContain('Your private lineup has unpublished edits')
 expect(lineupPublicationHtml(fixture,player,false,false)).not.toContain('Your private lineup has unpublished edits')
 expect(lineupPublicationHtml(fixture,'unassigned',true,false)).not.toContain('aria-label="Your shared court"')
 expect(lineupPublicationHtml(fixture,'unassigned',false,false)).toContain('You don’t have a court assignment')
 fixture.lineupReplies!.push({profileId:'reserve',id:version,version,choice:'confirmed'})
 expect(lineupConfirmationReminder(fixture,'Saturday')).toBeNull()
})

it('keeps reminder drafts within the team composer limit',()=>{
 const fixture=confirmationFixture()
 expect(()=>lineupConfirmationReminder(fixture,'x'.repeat(2400))).toThrow('too long')
})
