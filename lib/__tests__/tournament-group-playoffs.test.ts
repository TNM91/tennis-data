import { describe,it,expect,beforeEach } from 'vitest'
import { buildTournamentGroupChampionship,summarizeTournamentResults,updateTiqTournamentMatchResult,clearTiqTournamentMatchResult,writeTiqTournamentRegistry,readTiqTournamentRegistry,upsertTiqTournamentRecord, type TiqTournamentRecord, type TiqTournamentMatchPreview } from '../tiq-tournament-registry'
import { buildGroupStandings } from '../tournament-group-playoffs'
import { buildTournamentEventPass } from '../tournament-event-pass'

function record(count=6):TiqTournamentRecord { return {id:'groups',eventId:'pumpkin',name:'Men’s 4.0 Doubles',format:'group_playoffs',entrantType:'teams',status:'scheduled',startsOn:'2026-10-17',locationLabel:'Woodsmill',directorNotes:'',entrants:Array.from({length:count},(_,index)=>String.fromCharCode(65+index)),results:{},schedule:{},contacts:{},entrantPlayerIds:{},isPublic:false,createdAt:'',updatedAt:''} }
function result(match:TiqTournamentMatchPreview,winner=match.sideA,score=winner===match.sideA ? '6-4':'4-6') { return {winner,score,sideA:match.sideA,sideB:match.sideB,updatedAt:''} }
function finishedGroups() {
  const division=record()
  const championship=buildTournamentGroupChampionship(division)
  for (const group of championship.groups) for (const match of group.matches) division.results[match.id]=result(match,[match.sideA,match.sideB].includes(group.entrants[0]) ? group.entrants[0]:match.sideA)
  return division
}
beforeEach(()=>{
  const storage=new Map<string,string>()
  Object.defineProperty(globalThis,'window',{value:{localStorage:{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)}},configurable:true})
})
describe('group play and championship',()=>{
  it('gives every entrant two or three distinct group opponents for fields of 6–40',()=>{
    for (let count=6;count<=40;count++) {
      const division=record(count), championship=buildTournamentGroupChampionship(division)
      expect(championship.groups.every(group=>[3,4].includes(group.entrants.length))).toBe(true)
      for (const entrant of division.entrants) {
        const own=championship.groups.flatMap(group=>group.matches).filter(match=>[match.sideA,match.sideB].includes(entrant))
        expect([2,3]).toContain(own.length)
        expect(new Set(own.map(match=>match.sideA===entrant ? match.sideB:match.sideA)).size).toBe(own.length)
      }
      expect(new Set(championship.matches.map(match=>match.id)).size).toBe(championship.matches.length)
    }
  })
  it('uses a bracket for small fields and handles an empty draft',()=>{
    expect(buildTournamentGroupChampionship(record(0)).matches).toEqual([])
    const small=buildTournamentGroupChampionship(record(5))
    expect(small.smallField).toBe(true); expect(small.groups).toEqual([]); expect(small.playoffs.at(-1)?.label).toBe('Final')
  })
  it('does not qualify an early leader or accept scores against unresolved group winners',()=>{
    const division=record(), first=buildTournamentGroupChampionship(division).groups[0].matches[0]
    division.results[first.id]=result(first)
    const championship=buildTournamentGroupChampionship(division)
    expect(championship.groups[0].qualifier).toBe('')
    expect(championship.playoffs.at(-1)?.ready).toBe(false)
    writeTiqTournamentRegistry([division])
    expect(updateTiqTournamentMatchResult({tournamentId:division.id,matchId:'p-r1-m1',winner:'Winner Group A'})).toBeNull()
  })
  it('connects group winners to the final, then advances the player pass and confirms a champion',()=>{
    const division=finishedGroups(), championship=buildTournamentGroupChampionship(division)
    expect(championship.groups.map(group=>group.qualifier)).toEqual(['A','B'])
    expect(championship.playoffs.at(-1)).toMatchObject({sideA:'A',sideB:'B',ready:true,label:'Final'})
    expect(buildTournamentEventPass(division,'A')?.next?.matchId).toBe('p-r1-m1')
    division.results['p-r1-m1']=result(championship.playoffs.at(-1)!,'A')
    expect(summarizeTournamentResults(division)).toMatchObject({champion:'A',openMatches:0})
  })
  it('uses head-to-head for a two-way tie even when the winner has a lower game difference',()=>{
    const division=record(8), group=buildTournamentGroupChampionship(division).groups[0]
    for (const match of group.matches) {
      const winner=[match.sideA,match.sideB].includes('A') && [match.sideA,match.sideB].includes('C') ? 'A'
        : [match.sideA,match.sideB].includes('C') ? 'C'
        : [match.sideA,match.sideB].includes('G') && [match.sideA,match.sideB].includes('A') ? 'G'
        : [match.sideA,match.sideB].includes('A') ? 'A':match.sideA
      const margin=winner==='C' ? '6-0':'6-4'
      division.results[match.id]=result(match,winner,winner===match.sideA ? margin:margin.split('-').reverse().join('-'))
    }
    const completed=buildTournamentGroupChampionship(division).groups[0]
    expect(completed.qualifier).toBe('A'); expect(completed.standings[0].entrant).toBe('A')
  })
  it('provides a real tie-break draw for a fully tied group without choosing alphabetically',()=>{
    const division=finishedGroups(), group=buildTournamentGroupChampionship(division).groups[0]
    const beats:Record<string,string>={A:'C',C:'E',E:'A'}
    for (const match of group.matches) division.results[match.id]=result(match,beats[match.sideA]===match.sideB ? match.sideA:match.sideB)
    let tied=buildTournamentGroupChampionship(division).groups[0]
    expect(tied.qualifier).toBe(''); expect(tied.tied).toHaveLength(3)
    for (let round=0;round<3;round++) {
      for (const match of tied.tieMatches.filter(match=>match.ready && !match.result)) division.results[match.id]=result(match)
      tied=buildTournamentGroupChampionship(division).groups[0]
    }
    expect(tied.qualifier).not.toBe(''); expect(buildTournamentGroupChampionship(division).playoffs.at(-1)?.ready).toBe(true)
  })
  it('invalidates a final when a correction changes its opponent, even if the saved winner is unchanged',()=>{
    const division=finishedGroups(), final=buildTournamentGroupChampionship(division).playoffs.at(-1)!
    division.results[final.id]=result(final,'A')
    writeTiqTournamentRegistry([division])
    const match=buildTournamentGroupChampionship(division).groups[1].matches.find(item=>[item.sideA,item.sideB].includes('B') && [item.sideA,item.sideB].includes('D'))!
    const changed=updateTiqTournamentMatchResult({tournamentId:division.id,matchId:match.id,winner:'D',score:match.sideA==='D' ? '6-4':'4-6'})!
    expect(changed.results[final.id]).toBeUndefined(); expect(summarizeTournamentResults(changed).champion).toBe('')
    expect(buildTournamentGroupChampionship(changed).playoffs.at(-1)).toMatchObject({sideA:'A',sideB:'D'})
    expect(readTiqTournamentRegistry()[0].results[match.id]).toMatchObject({sideA:match.sideA,sideB:match.sideB})
  })
  it('locks and clears the final if an earlier group result is cleared',()=>{
    const division=finishedGroups(), final=buildTournamentGroupChampionship(division).playoffs.at(-1)!
    division.results[final.id]=result(final,'A'); writeTiqTournamentRegistry([division])
    const cleared=clearTiqTournamentMatchResult(division.id,buildTournamentGroupChampionship(division).groups[0].matches[0].id)!
    expect(cleared.results[final.id]).toBeUndefined(); expect(buildTournamentGroupChampionship(cleared).playoffs.at(-1)?.ready).toBe(false)
  })
  it('excludes set and match tiebreak points from game totals',()=>{
    const match:TiqTournamentMatchPreview={id:'score',round:1,court:1,label:'Group',sideA:'A',sideB:'B'}
    match.result=result(match,'A','6-7(5-7) 7-6(7-2) [10-8]')
    expect(buildGroupStandings(['A','B'],[match])[0]).toMatchObject({gamesWon:13,gamesLost:13,gameDiff:0})
  })
  it('keeps the group field and format fixed once scores are recorded',()=>{
    const division=finishedGroups();writeTiqTournamentRegistry([division])
    expect(()=>upsertTiqTournamentRecord({...division,eventId:'',entrants:[...division.entrants,'New team']},division.id)).toThrow('Clear recorded results')
    expect(()=>upsertTiqTournamentRecord({...division,eventId:'',format:'single_elimination'},division.id)).toThrow('Clear recorded results')
    expect(readTiqTournamentRegistry()[0].entrants).toEqual(division.entrants)
  })
})
