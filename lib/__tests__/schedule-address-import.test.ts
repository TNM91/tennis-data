import {it,expect} from 'vitest'
import {parseTennisLinkExportFiles} from '../data-assist-export-parser'

it('retains explicit TennisLink address columns and empty captain cells without shifting the facility',()=>{
 const html='<table><tr><td>Match ID</td><td>Schedule Date</td><td>Time</td><td>Home Team</td><td>Home Captain</td><td>Visiting Team</td><td>Visiting Captain</td><td>Facility</td><td>Address</td><td>City</td><td>State</td><td>Zip</td></tr><tr><td>1012222932</td><td>9/13/2026</td><td>10:00 AM</td><td>Example A (F)</td><td></td><td>Example B (F)</td><td></td><td>Example Tennis Club</td><td>123 Source Rd</td><td>Springfield</td><td>IL</td><td>62701</td></tr></table>'
 const result=parseTennisLinkExportFiles([{fileName:'MatchSchedule.xls',mimeType:'application/vnd.ms-excel',uploadOrder:1,fileBuffer:Buffer.from(html),visualSignals:[],imageWidth:0,imageHeight:0,confidenceScore:1}])
 expect(result.rawText).toContain('Example Tennis Club — 123 Source Rd, Springfield, IL, 62701')
 // The structured row keeps both team names; address enrichment does not infer
 // a team, match result, date, or a similarly named club in another state.
 expect(result.rawText).toContain('Example A (F) | Example B (F) | Example Tennis Club')
})
