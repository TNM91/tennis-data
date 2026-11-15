import { expect, it } from 'vitest'
import { nativeTournamentPlan } from '../native-tournament-draw-plan'
import { readTournamentPlanWrite, readTournamentScore, type TournamentPlanWrite } from '../native-tournament-plan-contract'
import { nativeTournamentDraw } from '../native-tournaments'

const id = '10000000-0000-4000-8000-00000000000'
const event = 'tiq-native-event-' + id + '1'
const division = 'tiq-native-division-' + id + '2'
const other = 'tiq-native-division-' + id + '3'
const revision = '1'.repeat(32)
const date = '2099-06-06'
const slot = (time: string, court = 'Court 2') => ({ date, time, court })
const edit = (time: string, court?: string, match = 'r1-m1'): TournamentPlanWrite =>
  ({ action: 'slot', division, revision, match, slot: slot(time, court) })

function eventWithDraws(): Parameters<typeof nativeTournamentPlan>[0] {
  return {
    id: event, name: 'Northside Open', date, zone: 'America/Chicago', revision,
    divisions: [
      { id: division, name: 'Singles', format: 'single_elimination', status: 'scheduled',
        entrants: ['Alex Ace', 'Morgan Serve', 'Casey Court', 'Riley Return'], pending: 0, results: {}, schedule: {} },
      { id: other, name: 'Doubles', format: 'round_robin', status: 'scheduled',
        entrants: ['Alex Ace / Sam Spin', 'Charlie Clay / Drew Drop'], pending: 0, results: {}, schedule: { 'r1-m1': slot('12:00') } },
    ],
  }
}

const score = (match: string, sides: [string,string], value: unknown): TournamentPlanWrite =>
  ({action:'result',division,revision,match,sides,result:readTournamentScore(value)})

it('binds scores to both opponents and advances a winner before making the next match scoreable', () => {
  const data = eventWithDraws()
  const { divisions: [singles] } = data
  const final = score('r2-m1', ['Winner R1.1','Winner R1.2'], { outcome:'played', score:'6-4, 6-4' })
  expect(nativeTournamentPlan(data, division, final)).toEqual({code:'not_ready'})
  const first = score('r1-m1', ['Alex Ace','Riley Return'], { outcome:'played', score:'4-6, 4-6' })
  const advanced = nativeTournamentPlan(data, division, first).change
  expect(advanced).toEqual({result:{winner:'Riley Return',score:'4-6, 4-6',outcome:'played',sideA:'Alex Ace',sideB:'Riley Return'},complete:false})
  const second = score('r1-m2', ['Morgan Serve','Casey Court'], { outcome:'walkover', score:'', side:'A' })
  const next = nativeTournamentPlan(data, division, second).change!
  singles.results = {'r1-m1': advanced!.result, 'r1-m2': next.result}
  const draw = nativeTournamentPlan(data, division).plan!
  expect(draw.matches.find(match=>match.id==='r2-m1')).toMatchObject({a:'Riley Return',b:'Morgan Serve',winner:''})
  expect(nativeTournamentPlan(data, division, final)).toEqual({code:'stale'})
  const finish = score('r2-m1', ['Riley Return','Morgan Serve'], { outcome:'retirement', score:'6-4, 2-1', side:'B' })
  const champion = nativeTournamentPlan(data, division, finish).change!
  expect(champion).toMatchObject({result:{winner:'Morgan Serve',outcome:'retirement'},complete:true})
  singles.results = {...singles.results as object, 'r2-m1':champion.result}
  expect(nativeTournamentPlan(data, division, {...first,revision:'2'.repeat(32)})).toMatchObject({unchanged:true})
  expect(nativeTournamentPlan(data, division, score('r1-m1',['Alex Ace','Riley Return'],{outcome:'played',score:'6-4, 6-4'})))
    .toEqual({code:'downstream'})
  expect(nativeTournamentPlan(data, division, score('r1-m1',['Alex Ace','Riley Return'],{outcome:'played',score:'3-6, 4-6'})).change)
    .toMatchObject({complete:true,result:{winner:'Riley Return'}})
})

it('counts walkovers and retirement wins in round robin without inventing games', () => {
  const data = eventWithDraws()
  const doubles = data.divisions[1]
  const [a,b] = doubles.entrants
  const write: TournamentPlanWrite = {action:'result',division:other,revision,match:'r1-m1',sides:[a,b],
    result:readTournamentScore({outcome:'walkover',score:'',side:'B'})}
  const result = nativeTournamentPlan(data, other, write).change!
  expect(result).toMatchObject({complete:true,result:{winner:b,outcome:'walkover',score:''}})
  doubles.results = {'r1-m1':result.result}
  expect(nativeTournamentDraw(doubles).standings[0]).toMatchObject({name:b,wins:1,gamesWon:0,gamesLost:0})
  doubles.results = {'r1-m1':{...result.result,outcome:'retirement',score:'6-4, 2-1'}}
  expect(nativeTournamentDraw(doubles).standings[0]).toMatchObject({name:b,wins:1,gamesWon:5,gamesLost:8})
  doubles.results = {'r1-m1':{...result.result,winner:a,outcome:'played',score:'6-4, 4-6, 1-0'}}
  expect(nativeTournamentDraw(doubles).standings[0]).toMatchObject({name:a,wins:1,gamesWon:10,gamesLost:10})
  expect(()=>readTournamentScore({outcome:'walkover',score:'6-0',side:'B'})).toThrow(/walkover/)
  expect(()=>readTournamentScore({outcome:'played',score:'6-4, 6-4, 8-10'})).toThrow(/deciding set/)
  expect(()=>readTournamentScore({outcome:'played',score:'6-4, 6-4',side:'B'})).toThrow(/different winners/)
  expect(()=>readTournamentScore({outcome:'retirement',score:'6-4, 6-4',side:'A'})).toThrow(/complete/)
})

it('flags the scheduling conflict revealed by an advancing player while retaining the match time', () => {
  const data = eventWithDraws()
  const [singles] = data.divisions
  singles.schedule = {'r2-m1':slot('12:30','Court 3')}
  expect(nativeTournamentPlan(data, division).plan?.matches.find(match=>match.id==='r2-m1')?.playerOverlap).toBeUndefined()
  const write = score('r1-m1',['Alex Ace','Riley Return'],{outcome:'played',score:'6-4, 6-4'})
  const change = nativeTournamentPlan(data, division, write).change!
  singles.results = {'r1-m1':change.result}
  expect(nativeTournamentPlan(data, division).plan?.matches.find(match=>match.id==='r2-m1'))
    .toMatchObject({a:'Alex Ace',b:'Winner R1.2',playerOverlap:true,time:'12:30',court:'Court 3'})
  expect(nativeTournamentPlan(data, other).plan?.matches[0].playerOverlap).toBe(true)
})

it('builds the same pairings from the approved field and rejects cross-division conflicts', () => {
  const data = eventWithDraws()
  expect(nativeTournamentPlan(data, division).plan?.matches[0]).toMatchObject({ a: 'Alex Ace', b: 'Riley Return' })
  expect(nativeTournamentPlan(data, division, edit('12:30', ' 02 '))).toEqual({ code: 'court' })
  expect(nativeTournamentPlan(data, division, edit('12:30', 'Court 4'))).toEqual({ code: 'player' })
  expect(nativeTournamentPlan(data, division, edit('13:00')).plan).toBeDefined()
})

it('requires qualifying knockout matches to finish before their later round', () => {
  const data = eventWithDraws()
  data.divisions[0].schedule = { 'r1-m2': slot('13:00', 'Court 4') }
  expect(nativeTournamentPlan(data, division, edit('13:59', 'Court 5', 'r2-m1'))).toEqual({ code: 'round' })
  expect(nativeTournamentPlan(data, division, edit('14:00', 'Court 5', 'r2-m1')).plan).toBeDefined()
  expect(nativeTournamentPlan(data, division, edit('14:00', 'Court 5', 'r9-m9'))).toEqual({ code: 'closed' })
})

it('treats an already applied slot as a safe retry and rejects conflicting stale writes', () => {
  const data = eventWithDraws()
  data.divisions[0].schedule = { 'r1-m1': slot('13:00') }
  const old = '2'.repeat(32)
  expect(nativeTournamentPlan(data, division, { ...edit('13:00'), revision: old })).toMatchObject({ unchanged: true })
  expect(nativeTournamentPlan(data, division, { ...edit('14:00'), revision: old })).toEqual({ code: 'stale' })
  expect(() => readTournamentPlanWrite({ ...edit('25:00') })).toThrow()
  expect(() => readTournamentPlanWrite({ ...edit('15:00'), arbitrary: true })).toThrow()
})
