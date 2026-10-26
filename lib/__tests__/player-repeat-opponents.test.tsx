import {it,expect} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {playerRepeatOpponents} from '../player-repeat-opponents'
import {parseRepeatOpponents,loadRepeatOpponents} from '../../mobile/src/player-repeat-opponents'
import {PlayerPerformance} from '../../mobile/src/player-performance-view'
import type {SupabaseClient} from '@supabase/supabase-js'
const match=(id:string,result:'W'|'L'='W',matchType:'singles'|'doubles'='singles')=>({id,date:'2026-10-20',result,matchType})
const participant=(match_id:string,player_id:string,side='A',seat=1)=>({match_id,player_id,side,seat,players:{id:player_id,name:player_id==='p'?'Alex':'Jordan'}})
const rows=['a','b'].flatMap(id=>[participant(id,'p'),participant(id,'q','B')])
it('counts repeated opposing identities, keeping homonyms separate and reversed doubles pairs together',()=>{
 const records=playerRepeatOpponents([{date:'2026-10-20',result:'W',opponent:'Jordan / Drew',opponentIds:['q','r']},{date:'2026-10-19',result:'L',opponent:'Drew / Jordan',opponentIds:['r','q']},{date:'2026-10-18',result:'L',opponent:'Jordan / Drew',opponentIds:['other','another']}])
 expect(records).toEqual([{key:'q|r',name:'Jordan / Drew',id:'q',wins:1,losses:1,lastDate:'2026-10-20',total:2}])
 expect(playerRepeatOpponents([{date:'2026-01-01',result:'W',opponent:'Player not linked',opponentIds:['q']}])).toEqual([])
})
it('validates full singles and doubles participation before producing records',()=>{
 expect(parseRepeatOpponents(rows,4,[match('a'),match('b','L')],'p')[0]).toMatchObject({wins:1,losses:1,total:2})
 const doubles=['a','b'].flatMap(id=>[participant(id,'p'),participant(id,'partner','A',2),participant(id,'q','B'),participant(id,'r','B',2)])
 expect(parseRepeatOpponents(doubles,8,[match('a','W','doubles'),match('b','W','doubles')],'p')[0].total).toBe(2)
 for(const invalid of [rows.slice(1),[...rows,rows[0]],rows.map(r=>({...r,match_id:'outside'})),rows.map(r=>({...r,players:{id:'wrong',name:'Jordan'}})),rows.map(r=>({...r,side:'unknown'}))])expect(()=>parseRepeatOpponents(invalid,invalid.length,[match('a'),match('b')],'p')).toThrow()
 expect(()=>parseRepeatOpponents(rows,10,[match('a'),match('b')],'p')).toThrow()
})
it('shows honest unavailable/empty records and escaped profile buttons without inline styles',()=>{
 const data={matches:[match('a'),match('b')],snapshots:[],matchesLimited:false,ratingsLimited:false,repeatOpponents:parseRepeatOpponents(rows,4,[match('a'),match('b')],'p')}
 const markup=renderToStaticMarkup(<PlayerPerformance data={data} onOpenPlayer={()=>{}}/>);expect(markup).toContain('Repeat opponents');expect(markup).toContain('View player profile');expect(markup).toContain('2W-0L');expect(markup).not.toContain('style=')
 expect(renderToStaticMarkup(<PlayerPerformance data={{...data,repeatOpponents:null}} onRefresh={()=>{}}/>)).toContain('Retry opponent records')
 expect(renderToStaticMarkup(<PlayerPerformance data={{...data,repeatOpponents:[]}}/>)).toContain('No repeat opponents')
})
it('reads only eligible supplied match ids in bounded batches, withholds caps, and stops a closed visit',async()=>{
 const requests:Array<{ids:string[];limit:number}>=[];let capped=false,current=true
 const client={from(table:string){expect(table).toBe('match_players');let ids:string[]=[],limit=0;const q={select(_columns:string,options:unknown){expect(options).toEqual({count:'exact'});return q},in(column:string,value:string[]){expect(column).toBe('match_id');ids=value;return q},limit(n:number){limit=n;return q},abortSignal(){return q},then(resolve:(value:unknown)=>unknown){requests.push({ids,limit});const data=ids.flatMap(id=>[participant(id,'p'),participant(id,'q','B')]);return Promise.resolve({data,count:data.length+(capped?1:0),error:null}).then(resolve)}};return q}} as unknown as SupabaseClient
 const matches=Array.from({length:201},(_,i)=>match('m'+i));expect((await loadRepeatOpponents(client,matches,'p',()=>current))?.[0].total).toBe(201);expect(requests.map(r=>r.ids.length)).toEqual([100,100,1]);expect(requests.every(r=>r.limit===401)).toBe(true)
 capped=true;expect(await loadRepeatOpponents(client,matches,'p')).toBeNull();const count=requests.length;current=false;expect(await loadRepeatOpponents(client,matches,'p',()=>current)).toBeNull();expect(requests.length).toBe(count)
})
