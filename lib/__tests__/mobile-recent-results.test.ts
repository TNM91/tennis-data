import { describe, expect, it } from 'vitest'
import {recentPulseHtml} from '../../mobile/src/results-view'
import {recentScorecardRow} from '../../mobile/src/recent-scorecard-row'
import { matchDate, matchResult, type RecentMatchRow } from '../../mobile/src/recent-results'

const match: RecentMatchRow = {
  id: 'match', match_date: '2026-10-23', match_type: 'Doubles', league_name: 'League',
  score: '6-4 6-3', winner_side: 'A', match_players: [{player_id: 'linked', side: 'A'}],
}
describe('bundled recent results', () => {
  it('labels the opposing side in seat order and omits ambiguous or incomplete lineups',()=>{
    const own={player_id:'linked',side:'A',seat:1,players:{name:'My player'}}
    const partner={player_id:'partner',side:'A',seat:2,players:{name:'My partner'}}
    const first={player_id:'opponent-1',side:'B',seat:1,players:[{name:'Casey <Rivera>'}]}
    const second={player_id:'opponent-2',side:'B',seat:2,players:{name:'Morgan Wells'}}
    const render=(participants:RecentMatchRow['participants'])=>recentScorecardRow({...match,participants},0,'Won','linked')
    const pair=render([second,own,partner,first])
    expect(pair).toContain('vs Casey &lt;Rivera&gt; &amp; Morgan Wells')
    expect(pair).not.toContain('My partner')
    expect(recentScorecardRow({...match,match_type:'singles',participants:[own,first]},0,'Won','linked')).toContain('vs Casey &lt;Rivera&gt;')
    for(const lineup of [undefined,[own,partner,first],[own,partner,first,{...second,players:null}],[own,first,{...second,player_id:first.player_id}],[partner,first,second]]){
      expect(render(lineup)).not.toContain('recent-scorecard-opponent')
      expect(render(lineup)).toContain('6-4 6-3')
    }
  })
  it('calculates recent win percentage from decided results only and identifies pending form',()=>{
    const markup=recentPulseHtml([match,{...match,winner_side:'B'},{...match,winner_side:null}], 'linked')
    expect(markup).toContain('value="50"')
    expect(markup).toContain('1 win · 1 loss')
    expect(markup).toContain('Newest first · 1 pending')
    expect(markup).toContain('data-outcome="W"')
    expect(markup).toContain('data-outcome="L"')
    expect(markup).toContain('Result pending')
    expect(recentPulseHtml([{...match,winner_side:null}], 'linked')).not.toContain('<meter')
    expect(recentPulseHtml([], 'linked')).toContain('No decided results yet.')
  })

  it('reads the result from the linked player’s side, not score ordering', () => {
    expect(matchResult(match, 'linked')).toBe('Won')
    expect(matchResult({...match, winner_side: 'B'}, 'linked')).toBe('Lost')
  })
  it('does not invent a loss when participant or winner data is missing or unknown', () => {
    expect(matchResult(match, 'other')).toBe('Result pending')
    expect(matchResult({...match, winner_side: null}, 'linked')).toBe('Result pending')
    expect(matchResult({...match, winner_side: 'unknown'}, 'linked')).toBe('Result pending')
    expect(matchResult({...match, match_players: [{player_id: 'linked', side: null}]}, 'linked')).toBe('Result pending')
  })
  it('preserves calendar dates rather than shifting into the previous day', () => {
    expect(matchDate('2026-10-23')).toBe(matchDate('2026-10-23T00:00:00Z'))
    expect(matchDate(null)).toBe('Date unavailable')
    expect(matchDate('bad date')).toBe('Date unavailable')
    expect(matchDate('2026-02-30')).toBe('Date unavailable')
  })
})
