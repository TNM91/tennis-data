import { describe, expect, it } from 'vitest'
import { html, participantNames } from '../../mobile/src/match-details'

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
