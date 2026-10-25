import type {SupabaseClient} from '@supabase/supabase-js'
import {readHistoricalRatingCheck,type HistoricalCheck,type HistoricalKind} from '../../lib/historical-rating-check'
import {canFollowPlayers} from './follows-data'
import {html} from './match-details'
import ui from '../generated/website-ui.json'
export async function loadHistoricalCheck(client:SupabaseClient,kind:HistoricalKind,current:()=>boolean){
 const own=async(owner?:string)=>{const {data,error}=await client.auth.getSession();if(error||!current()||!data.session||owner&&owner!==data.session.user.id)throw Error('Comparison is no longer open.');return data.session.user.id}
 const owner=await own();if(!await canFollowPlayers(client,current))throw Error('Player access is required.');await own(owner)
 const report=await readHistoricalRatingCheck(client,kind,current);await own(owner);return report
}
export function historicalCheckHtml(report:HistoricalCheck|null){
 if(!report)return '<p>Check today’s rating favorites against recent completed singles or doubles results. Pending and incomplete results are excluded.</p>'
 const values:Record<string,string>={TIQ_CHECK_SCANNED:String(report.scanned),TIQ_CHECK_COVERAGE:report.limited?'Older results are outside this search.':'This is a recent sample, not a complete career record.'}
 for(const [key,band]of Object.entries(report.bands)){values['TIQ_CHECK_'+key.toUpperCase()+'PERCENT']=band.total?Math.round(band.correct/band.total*100)+'%':'—';values['TIQ_CHECK_'+key.toUpperCase()+'COUNTS']=`${band.correct} of ${band.total} usable results`}
 for(const [key,count]of Object.entries(report.excluded))values['TIQ_CHECK_'+key.toUpperCase()]=String(count)
 return '<div class="website-ui website-historical-check">'+ui.historicalCheck[report.kind].replace(/TIQ_CHECK_[A-Z]+/g,key=>html(values[key]??key))+'</div>'
}
