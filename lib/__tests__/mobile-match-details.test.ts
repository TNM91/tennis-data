import { describe, expect, it } from 'vitest'
import { html, participantNames, matchParticipantChoice } from '../../mobile/src/match-details'

describe('bundled match details', () => {
  it('keeps partners on the correct side and orders them by seat', () => {
    const rows = [
      {player_id: 'partner', side: 'A', seat: 2, players: {name: 'Partner'}},
      {player_id: 'opponent', side: 'B', seat: 1, players: [{name: 'Opponent'}]},
      {player_id: 'player', side: 'A', seat: 1, players: {name: 'Player'}},
    ]
    expect(participantNames(rows, 'A')).toEqual(['Player', 'Partner'])
    expect(participantNames(rows, 'B')).toEqual(['Opponent'])
  })
  it('handles missing player names without inventing an opponent', () => {
    expect(participantNames([{player_id: 'a', side: 'A', seat: null, players: null}], 'A')).toEqual(['Player name unavailable'])
    expect(participantNames([], 'B')).toEqual([])
  })
  it('escapes hosted names and scores before inserting them into HTML', () => {
    expect(html('<img src=x onerror="alert(1)">&\'')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;')
  })
})


describe('scorecard profile identities',()=>{
 const row={player_id:'canonical',side:'A',seat:1,players:{name:'Same Name'}}
 it('uses the recorded participant ID rather than matching names',()=>{
  const rows=[row,{...row,player_id:'second',side:'B'}]
  expect(matchParticipantChoice(rows,0)?.id).toBe('canonical');expect(matchParticipantChoice(rows,1)?.id).toBe('second')
 })
 it('withholds ambiguous or unavailable profile actions',()=>{
  for(const rows of [[row,row],[{...row,player_id:'bad/id'}],[{...row,side:null}],[{...row,players:null}],[{...row,players:[{name:'First'},{name:'Second'}]}],[{...row,players:{name:' '}}],[{...row,players:{name:'x'.repeat(201)}}]])expect(matchParticipantChoice(rows,0)).toBeNull()
  expect(matchParticipantChoice([],0)).toBeNull()
 })
 it('accepts a single joined identity and never supplies invented location or flight',()=>{
  expect(matchParticipantChoice([{...row,players:[{name:' <Alex> '}]}],0)).toEqual({id:'canonical',name:'<Alex>',location:null,flight:null})
 })
})
