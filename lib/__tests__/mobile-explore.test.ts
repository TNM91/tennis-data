import {describe,expect,it} from 'vitest'
import {playerSummary} from '../../mobile/src/explore'
import {resultsHtml} from '../../mobile/src/results-view'

describe('native Explore player context',()=>{
  it('escapes public profile fields and gives missing fields honest labels',()=>{
    const summary=playerSummary({id:'sample',name:'<img src=x>',location:'Town & City',flight:null})
    expect(summary).not.toContain('<img')
    expect(summary).toContain('&lt;img src=x&gt;')
    expect(summary).toContain('Town &amp; City')
    expect(summary).toContain('Flight unavailable')
  })
  it('attributes results to the browsed player rather than the signed-in account',()=>{
    const markup=resultsHtml([{id:'match',match_date:'2026-10-23',match_type:'Singles',league_name:'League',score:'6-4',winner_side:'B',match_players:[{player_id:'browsed',side:'B'}]}],'browsed','All','this player’s')
    expect(markup).toContain('1 match in this player’s latest 1 connected results.')
    expect(markup).toContain('Won')
    expect(markup).not.toContain('in your latest')
  })
})
