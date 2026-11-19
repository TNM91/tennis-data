import {expect,it} from 'vitest'
import type {TeamMatchReplies} from '../team-match-replies-contract'
import {teamMatchBriefLineupHtml} from '../../mobile/src/team-match-brief'

const owner='11111111-1111-4111-8111-111111111111',partner='22222222-2222-4222-8222-222222222222'
const version='33333333-3333-4333-8333-333333333333'
function fixture():TeamMatchReplies{
 return {own:null,rosterComplete:true,
  sharedLineup:{version,courts:[{format:'doubles',players:[owner,partner]}],names:{[owner]:'Alex',[partner]:'<Blair>'}},
  savedLineup:{version:'private',courts:[{format:'singles',players:['private-player']}],names:{'private-player':'Private Player'}},
  lineupRoster:[{id:owner,name:'Alex',choice:'in'},{id:partner,name:'<Blair>',choice:'out'}],
  lineupReplies:[{profileId:owner,id:owner,version,choice:'confirmed'},{profileId:partner,id:partner,version,choice:'confirmed'}],
  lineupReply:{id:owner,version,choice:'confirmed'}}
}

it('summarizes published confirmations and unavailable players without counting a private replacement',()=>{
 const markup=teamMatchBriefLineupHtml(fixture(),owner,true)
 expect(markup).toContain('1 of 2 assignments confirmed')
 expect(markup).toContain('<dt>Needs review</dt><dd>1</dd>')
 expect(markup).toContain('Private edits are not published yet')
 expect(markup).not.toContain('Private Player')
})

it('shows a player only their own published court, escaped partner and current confirmation',()=>{
 const markup=teamMatchBriefLineupHtml(fixture(),owner,false)
 expect(markup).toContain('Your court · Doubles 1')
 expect(markup).toContain('Partner · &lt;Blair&gt;');expect(markup).not.toContain('<Blair>')
 expect(markup).toContain('Confirmed')
 for(const text of ['Needs review','To confirm','Private edits','Private Player'])expect(markup).not.toContain(text)
})

it('prioritizes an Out reply and never reuses an older-version player confirmation',()=>{
 const replies=fixture();replies.lineupReply!.version='old'
 expect(teamMatchBriefLineupHtml(replies,owner,false)).toContain('Confirm your assignment')
 replies.own={id:owner,choice:'out'};replies.lineupReply!.version=version
 expect(teamMatchBriefLineupHtml(replies,owner,false)).toContain('You’re marked Out')
 expect(teamMatchBriefLineupHtml(replies,'unassigned',false)).toContain('You’re not assigned')
})

it('does not turn missing or partial roster data into a ready lineup',()=>{
 const replies=fixture();replies.lineupRoster=undefined
 expect(teamMatchBriefLineupHtml(replies,owner,true)).toContain('check lineup access')
 replies.lineupRoster=[];replies.rosterComplete=false
 const markup=teamMatchBriefLineupHtml(replies,owner,true)
 expect(markup).toContain('2 assignments need rechecking')
 expect(markup).not.toContain('2 of 2')
 expect(teamMatchBriefLineupHtml(null,owner,true)).toContain('Open Next match')
})

it('distinguishes a captain’s saved private lineup from the player’s unpublished state',()=>{
 const replies=fixture();replies.sharedLineup=undefined
 expect(teamMatchBriefLineupHtml(replies,owner,true)).toContain('Your private lineup is saved')
 const playerMarkup=teamMatchBriefLineupHtml(replies,owner,false)
 expect(playerMarkup).toContain('Your availability · Not replied')
 expect(playerMarkup).toContain('hasn’t published')
 expect(playerMarkup).not.toContain('private')
})
