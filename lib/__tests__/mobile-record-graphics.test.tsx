import {PlayerOpponentQualityPanel} from '../../app/components/player-benchmark-panels'
import {expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {PlayerRecordGraphics,playerRecordGraphicData} from '../../mobile/src/player-record-graphics'
import {RecordBars} from '../../mobile/src/record-graphics'
import type {PlayerPerformanceData} from '../../mobile/src/player-performance-data'
const data:PlayerPerformanceData={matches:[{id:'d1',date:'2026-10-24',matchType:'doubles',result:'L'},{id:'s1',date:'2026-10-23',matchType:'singles',result:'W'},{id:'s2',date:'2025-10-20',matchType:'singles',result:'L'}],snapshots:[],matchesLimited:false,ratingsLimited:true}
it('keeps selected-format season and recent-form denominators independent',()=>{
 const singles=playerRecordGraphicData(data,'singles')!
 expect(singles.total).toBe(2);expect(singles.wins).toBe(1);expect(singles.losses).toBe(1)
 expect(singles.seasons.map(s=>[s.year,s.wins,s.losses])).toEqual([['2026',1,0],['2025',0,1]])
 expect(singles.recent.map(m=>m.id)).toEqual(['s1','s2'])
 expect(playerRecordGraphicData(data,'doubles')!.wins).toBe(0)
 expect(playerRecordGraphicData(data,'overall')!.total).toBe(3)
})
it('withholds graphics for incomplete public match coverage without withholding confirmed match records for missing ratings',()=>{
 expect(playerRecordGraphicData({...data,matchesLimited:true},'overall')).toBeNull()
 expect(renderToStaticMarkup(<PlayerRecordGraphics data={{...data,matchesLimited:true}} view="overall"/>)).not.toContain('<meter')
 expect(renderToStaticMarkup(<PlayerRecordGraphics data={data} view="singles"/>)).toContain('50% wins')
})
it('does not turn an empty record into a zero-percent loss record and escapes row labels',()=>{
 const empty=renderToStaticMarkup(<RecordBars rows={[{key:'a',label:'<unknown>',wins:0,losses:0}]} label="Records"/>)
 expect(empty).toContain('&lt;unknown&gt;');expect(empty).toContain('No decided results');expect(empty).not.toContain('<meter');expect(empty).not.toContain('0% wins')
 const valid=renderToStaticMarkup(<RecordBars rows={[{key:'s',label:'Singles',wins:2,losses:1}]} label="Records"/>)
 expect(valid).toContain('2 wins from 3 decided results');expect(valid).toContain('67% wins');expect(valid).not.toContain('style=')
})

it('preserves website band evidence and renders native bars only for rated opponents',()=>{const bands={weaker:{w:2,l:1},similar:{w:1,l:1},stronger:{w:0,l:0}},chart=<RecordBars label="Opponent records" emptyLabel="No rated opponents in this band" rows={Object.entries(bands).map(([key,b])=>({key,label:key,wins:b.w,losses:b.l}))}/>;const markup=renderToStaticMarkup(<PlayerOpponentQualityPanel bands={bands} baseline={4} matchCount={8} recordChart={chart}/>);expect(markup).toContain('5 of 8 selected-format matches');expect(markup).toContain('No rated opponents in this band');expect(markup).toContain('67% wins');expect(markup).toContain('Missing opponent ratings are excluded.');expect(renderToStaticMarkup(<PlayerOpponentQualityPanel bands={bands} baseline={4} matchCount={8}/>)).toContain('No recorded opponents')})
