import {describe,it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {parsePlayerPerformance,type PlayerPerformanceData} from '../../mobile/src/player-performance-data'
import {matchTapeScorecard} from '../../mobile/src/player-match-tape-scorecard'
import {PlayerMatchTape} from '../../mobile/src/player-match-tape'
const raw={id:'match',match_date:'2025-10-20',match_type:'doubles',score:'6-4 3-6 10-8',league_name:'City League',winner_side:'A',public_history_eligible:true,match_players:[{player_id:'selected',side:'B'}]}
const parse=()=>parsePlayerPerformance([raw],[],'selected','2026-10-27')
describe('full scorecards from filtered public history',()=>{
 it('preserves exact recorded sides, score, date and league instead of inventing a winner from score order',()=>{
  const data=parse(),row=matchTapeScorecard(data,'match','selected')!
  expect(row).toEqual({id:'match',match_date:'2025-10-20',match_type:'doubles',score:'6-4 3-6 10-8',league_name:'City League',winner_side:'A',match_players:[{player_id:'selected',side:'B'}]});expect(data.matches[0].result).toBe('L')
  row.match_players[0].side='A';expect(data.matches[0].scorecard?.match_players[0].side).toBe('B')
 })
 it('withholds incomplete, duplicate, wrong-player and missing-source scorecard actions',()=>{
  const data=parse();expect(matchTapeScorecard({...data,matchesLimited:true},'match','selected')).toBeNull();expect(matchTapeScorecard({...data,matches:[...data.matches,...data.matches]},'match','selected')).toBeNull();expect(matchTapeScorecard(data,'other','selected')).toBeNull();expect(matchTapeScorecard(data,'match','other')).toBeNull();expect(matchTapeScorecard({...data,matches:[{...data.matches[0],scorecard:undefined}]},'match','selected')).toBeNull()
 })
 it('withholds mismatched loaded source identity, format, date, score and result',()=>{
  const data=parse(),source=data.matches[0].scorecard!
  for(const patch of [{id:'other'},{match_type:'singles'},{match_date:'2024-10-20'},{score:'6-0 6-0'},{winner_side:'B'},{winner_side:null},{match_players:[]},{match_players:[{player_id:'other',side:'B'}]},{match_players:[...source.match_players,...source.match_players]}])expect(matchTapeScorecard({...data,matches:[{...data.matches[0],scorecard:{...source,...patch}}]},'match','selected')).toBeNull()
 })
 it('keeps unknown league and score values missing without blocking the recorded result',()=>{
  const data=parsePlayerPerformance([{...raw,score:null,league_name:'x'.repeat(201)}],[],'selected','2026-10-27');expect(matchTapeScorecard(data,'match','selected')).toMatchObject({score:null,league_name:null})
 })
 it('renders full scorecard actions only when both selected identity and navigation exist',()=>{
  const data=parse(),render=(props:Partial<Parameters<typeof PlayerMatchTape>[0]>={})=>renderToStaticMarkup(<PlayerMatchTape data={data} view="overall" onView={()=>{}} {...props}/> )
  expect(render()).not.toContain('Open full scorecard');expect(render({playerId:'selected'})).not.toContain('Open full scorecard');expect(render({playerId:'selected',onOpenScorecard:()=>{}})).toContain('Open full scorecard, Oct 20, 2025, doubles');expect(render({playerId:'other',onOpenScorecard:()=>{}})).not.toContain('Open full scorecard')
 })
 it('summarizes every filtered result even when only twenty rows are rendered',()=>{
  const source=parse(),data:PlayerPerformanceData={...source,matches:Array.from({length:45},(_,i)=>({...source.matches[0],id:'m'+i,result:i<30?'W':'L'}))}
  const view=renderToStaticMarkup(<PlayerMatchTape data={data} view="overall" onView={()=>{}}/>);expect(view).toContain('30W');expect(view).toContain('15L');expect(view).toContain('67% wins');expect(view).toContain('all 45 loaded results');expect(view).toContain('Showing 20');expect(view.match(/<details/g)).toHaveLength(20)
 })
 it('keeps incomplete coverage distinct from zero results without misleading percentages',()=>{
  const source=parse(),limited=renderToStaticMarkup(<PlayerMatchTape data={{...source,matchesLimited:true}} view="overall" onView={()=>{}}/>);expect(limited).not.toContain('Record for filtered');expect(limited).not.toContain('<meter');const empty=renderToStaticMarkup(<PlayerMatchTape data={{...source,matches:[]}} view="overall" onView={()=>{}}/>);expect(empty).toContain('No decided results');expect(empty).not.toContain('NaN');expect(empty).not.toContain('100%')
 })
})
