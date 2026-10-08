import { beforeEach,describe,it,expect,vi } from 'vitest'
const state=vi.hoisted(()=>({latest:{} as Record<string,unknown>,failure:'',payload:null as Record<string,unknown>|null,filters:[] as Array<[string,unknown]>}))
vi.mock('../supabase',()=>({supabase:{from:()=>{
  let updating=false
  const query={select:()=>query,eq:(key:string,value:unknown)=>{if(updating)state.filters.push([key,value]);return query},
    update:(payload:Record<string,unknown>)=>{updating=true;state.payload=payload;return query},
    maybeSingle:async()=>{if(!updating)return {data:state.latest,error:null};if(state.failure==='throw')throw new Error('network');return state.failure ? {data:null,error:state.failure==='stale' ? null:{message:'denied'}}:{data:{id:'groups'},error:null}}
  };return query
}}}))
import { buildTournamentGroupChampionship,readTiqTournamentRegistry,saveTiqTournamentGroupResult,writeTiqTournamentRegistry,type TiqTournamentRecord } from '../tiq-tournament-registry'
function record():TiqTournamentRecord{return {id:'groups',eventId:'pumpkin',name:'4.0',format:'group_playoffs',entrantType:'teams',status:'scheduled',startsOn:'2026-10-17',locationLabel:'',directorNotes:'',entrants:['A','B','C','D','E','F'],results:{},schedule:{},contacts:{},entrantPlayerIds:{},isPublic:false,createdAt:'',updatedAt:''}}
beforeEach(()=>{
  const storage=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)}})
  state.failure='';state.payload=null;state.filters=[]
  const division=record();writeTiqTournamentRegistry([division])
  state.latest={format:division.format,entrants:division.entrants,results:{},schedule:{},status:division.status,updated_at:'version-1'}
})
describe('group result persistence',()=>{
  it('merges current cloud scores, preserves scheduling, and patches only results and status with a version guard',async()=>{
    const division=record(),matches=buildTournamentGroupChampionship(division).groups[0].matches
    state.latest.results={[matches[1].id]:{winner:matches[1].sideA,score:'6-4',sideA:matches[1].sideA,sideB:matches[1].sideB,updatedAt:''}}
    state.latest.schedule={'p-r1-m1':{date:'2026-10-17',time:'20:00',court:'2',updatedAt:''}}
    const saved=await saveTiqTournamentGroupResult({tournamentId:division.id,matchId:matches[0].id,winner:matches[0].sideA,score:'6-4'},'organizer')
    expect(saved.error).toBeNull();expect(saved.data?.results[matches[1].id].winner).toBe(matches[1].sideA)
    expect(saved.data?.schedule['p-r1-m1'].court).toBe('2')
    expect(Object.keys(state.payload!).sort()).toEqual(['results','status','updated_at','updated_by_user_id'])
    expect(state.filters).toContainEqual(['updated_at','version-1'])
  })
  it.each(['denied','stale','throw'])('restores local data when a %s write fails',async(failure)=>{
    state.failure=failure;const match=buildTournamentGroupChampionship(record()).groups[0].matches[0]
    const saved=await saveTiqTournamentGroupResult({tournamentId:'groups',matchId:match.id,winner:match.sideA,score:'6-4'},'organizer')
    expect(saved.error).toBeInstanceOf(Error);expect(saved.data).toBeNull();expect(readTiqTournamentRegistry()[0].results).toEqual({})
  })
  it('rejects a match removed from the fresh draw without attempting a write',async()=>{
    const match=buildTournamentGroupChampionship(record()).groups[0].matches[0]
    state.latest.entrants=['A','B']
    expect((await saveTiqTournamentGroupResult({tournamentId:'groups',matchId:match.id,winner:match.sideA},'organizer')).error).toBeInstanceOf(Error)
    expect(state.payload).toBeNull()
  })
  it('clears dependent results and reopens a completed division after a group score is cleared',async()=>{
    const division=record()
    for(const group of buildTournamentGroupChampionship(division).groups)for(const match of group.matches){const winner=[match.sideA,match.sideB].includes(group.entrants[0]) ? group.entrants[0]:match.sideA;division.results[match.id]={winner,score:winner===match.sideA ? '6-4':'4-6',sideA:match.sideA,sideB:match.sideB,updatedAt:''}}
    const final=buildTournamentGroupChampionship(division).playoffs.at(-1)!
    division.results[final.id]={winner:final.sideA,score:'6-4',sideA:final.sideA,sideB:final.sideB,updatedAt:''}
    state.latest.results=division.results;state.latest.status='completed'
    const cleared=await saveTiqTournamentGroupResult({tournamentId:'groups',matchId:buildTournamentGroupChampionship(division).groups[0].matches[0].id},'organizer')
    expect(cleared.error).toBeNull();expect(cleared.data?.status).toBe('scheduled');expect(cleared.data?.results[final.id]).toBeUndefined()
    expect(cleared.removedResultIds).toContain(final.id)
  })
})
