import {expect,it} from 'vitest'
import {createClient} from '@supabase/supabase-js'
import {loadNativeCoach} from '../native-coach'
import {coachRosterPattern,readCoachRosterFilter} from '../coach-roster-filter'
import {coachOwner,coachRevision} from '../../tests/fixtures/native-coach'

it('validates filters, trims names and treats SQL wildcard characters literally',()=>{
  expect(readCoachRosterFilter(new URLSearchParams('q=%20Zara%20&status=paused&connection=roster'))).toEqual({q:'Zara',status:'paused',connection:'roster'})
  expect(coachRosterPattern('A%_\\')).toBe('%A\\%\\_\\\\%')
  for(const query of ['q='+ 'a'.repeat(101),'q=%00','status=admin','connection=any'])expect(()=>readCoachRosterFilter(new URLSearchParams(query))).toThrow()
})
it('searches the whole owned roster before applying the 100-row display bound',async()=>{
  const calls:URL[]=[]
  const rows=Array.from({length:151},(_,i)=>({id:'student-'+i,coach_user_id:coachOwner,player_user_id:i%2?'linked-player':null,player_name:i===150?'Zara Patel':'Player '+i,level_label:'4.0',identity_slug:'',status:i%2?'active':'paused',notes:'',updated_at:coachRevision}))
  const client=createClient('https://synthetic.invalid','synthetic-key',{auth:{persistSession:false},global:{fetch:async raw=>{
    const url=new URL(String(raw));calls.push(url);let result=rows.filter(r=>r.coach_user_id===url.searchParams.get('coach_user_id')?.slice(3))
    const name=url.searchParams.get('player_name');if(name)result=result.filter(r=>r.player_name.includes(name.slice(7,-1)))
    const status=url.searchParams.get('status');if(status)result=result.filter(r=>r.status===status.slice(3))
    const link=url.searchParams.get('player_user_id');if(link==='is.null')result=result.filter(r=>!r.player_user_id);if(link==='not.is.null')result=result.filter(r=>r.player_user_id)
    return Response.json(result.slice(0,Number(url.searchParams.get('limit'))))
  }}})
  const all=await loadNativeCoach(client,coachOwner);expect(all.students).toHaveLength(100);expect(all.moreStudents).toBe(true)
  const found=await loadNativeCoach(client,coachOwner,'',{q:'Zara',status:'paused',connection:'roster'})
  expect(found.students.map(s=>s.name)).toEqual(['Zara Patel']);expect(found.moreStudents).toBe(false)
  expect(calls[1].searchParams.get('player_name')).toBe('ilike.%Zara%');expect(calls[1].searchParams.get('player_user_id')).toBe('is.null')
  expect(calls[1].searchParams.get('order')).toBe('updated_at.desc,id.asc')
})
