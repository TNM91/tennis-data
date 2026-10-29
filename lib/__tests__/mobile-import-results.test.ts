import {it,expect} from 'vitest'
import {readImportedCourts,hasImportedRecords} from '../../mobile/src/data-import-results'
import type {ImportBatch,ImportDetail} from '../../mobile/src/data-imports-data'
it('opens result links only after a saved imported outcome with no recorded failures',()=>{
 const batch={status:'imported'} as ImportBatch,detail={status:'imported',reviewSource:{},outcome:[]} as unknown as ImportDetail
 expect(hasImportedRecords(batch,detail)).toBe(true);expect(hasImportedRecords({...batch,status:'verified'},detail)).toBe(false);expect(hasImportedRecords(batch,{...detail,outcome:[['Failed','1']]})).toBe(false)
})
it('refuses team totals, foreign match IDs, excess courts and ambiguous participant payloads',()=>{
 const row={id:'court-1',external_match_id:'1011650664::line:1',line_number:1,match_type:'singles',score:'6-4 6-3',match_players:[{player_id:'player-1',side:'A',seat:1,players:{name:'Alex Lee'}}]}
 expect(readImportedCourts([row],'1011650664')).toEqual([row]);expect(readImportedCourts([{...row,line_number:'1'}],'1011650664')[0].line_number).toBe(1);for(const value of [[{...row,external_match_id:'1011650664'}],[{...row,match_type:'team'}],Array(11).fill(row),[{...row,match_players:[{...row.match_players[0],players:[{name:'a'},{name:'b'}]}]}]])expect(()=>readImportedCourts(value,'1011650664')).toThrow()
})
