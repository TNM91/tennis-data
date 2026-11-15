import type { TournamentDetail, TournamentMatch, TournamentStanding } from './native-tournaments-contract'
import { buildTournamentPreview, buildTournamentGroupChampionship, buildRoundRobinStandings } from './tournament-draw'
import type { TiqTournamentMatchResult, TiqTournamentMatchSchedule, TiqTournamentMatchPreview, TiqTournamentStanding, TiqTournamentRecord } from './tiq-tournament-registry'

type Row = Record<string, unknown>
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''

function mapStanding(s:TiqTournamentStanding,group=''):TournamentStanding{return {name:s.entrant,group,played:s.played,wins:s.wins,losses:s.losses,gamesWon:s.gamesWon,gamesLost:s.gamesLost,gameDiff:s.gameDiff,winPct:s.winPct}}
export function nativeTournamentDraw(r:Row):Pick<TournamentDetail,'entrants'|'drawNotice'|'matches'|'standings'>{
 const unavailable=(drawNotice:string)=>({entrants:0,drawNotice,matches:[],standings:[]})
 if(!['single_elimination','round_robin','group_playoffs'].includes(text(r.format)))return unavailable('Draw details for this format are not available in the app yet.')
 if(!Array.isArray(r.entrants)||r.entrants.length>64||r.entrants.some(v=>typeof v!=='string'||!v.trim()||v.length>256))return unavailable('This draw exceeds the app’s current display limit. No partial standings are shown.')
 const entrants=r.entrants.map(v=>text(v));if(new Set(entrants).size!==entrants.length||entrants.includes('Bye'))throw Error('Ambiguous tournament entrants')
 const record=(v:unknown):Row=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length>500||JSON.stringify(v).length>250000)throw Error('Incomplete tournament draw');return v as Row}
 let raw:Row,saved:Row;try{raw=record(r.results);saved=record(r.schedule)}catch{return unavailable('This draw cannot be shown completely. Refresh for the latest published details.')}
 const schedule:Record<string,TiqTournamentMatchSchedule>={},results:Record<string,TiqTournamentMatchResult>={}
 for(const [id,v] of Object.entries(saved)){const s=v as Row;if(!s||typeof s!=='object'||Array.isArray(s))continue
  const date=text(s.date),time=text(s.time),court=text(s.court)
  if(id.length>120||court.length>160||date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)||time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))continue
  schedule[id]={date,time,court,updatedAt:''}
 }
 const format=r.format as TiqTournamentRecord['format']
 // Resolve only winners of the current known sides. Old side-bound results cannot advance a changed draw.
 for(let pass=0;pass<8;pass++){
  let added=0;const matches=buildTournamentPreview({format,entrants,results,schedule})
  for(const m of matches){const v=raw[m.id] as Row|undefined;if(results[m.id]||!v||typeof v!=='object'||m.ready===false||!entrants.includes(m.sideA)||!entrants.includes(m.sideB))continue
   const winner=text(v.winner),score=text(v.score)
   if(format==='group_playoffs'&&(v.sideA!==m.sideA||v.sideB!==m.sideB))continue
   if(![m.sideA,m.sideB].includes(winner)||score.length>500||(v.sideA!==undefined||v.sideB!==undefined)&&(v.sideA!==m.sideA||v.sideB!==m.sideB))continue
   const outcome=v.outcome==='walkover'||v.outcome==='retirement'?v.outcome:undefined
   results[m.id]={winner,score,updatedAt:'',sideA:m.sideA,sideB:m.sideB,...(outcome?{outcome}:{})};added++
  }
  if(!added)break
 }
 const source={format,entrants,results,schedule},matches=buildTournamentPreview(source).filter(m=>m.sideA!=='Bye'&&m.sideB!=='Bye')
 if(matches.length>500)return unavailable('This draw exceeds the app’s current display limit. No partial standings are shown.')
 const match=(m:TiqTournamentMatchPreview):TournamentMatch=>({id:m.id,label:m.label,round:m.round,a:m.sideA,b:m.sideB,winner:m.result?.winner||'',score:m.result?.score||'',date:m.schedule?.date||'',time:m.schedule?.time||'',court:m.schedule?.court||'',
  ...(m.ready===false?{ready:false as const}:{}),...(m.result?.outcome?{outcome:m.result.outcome}:{})})
 const standings=format==='round_robin'?buildRoundRobinStandings(source).map(s=>mapStanding(s)):format==='group_playoffs'?buildTournamentGroupChampionship(source).groups.flatMap(g=>g.standings.map(s=>mapStanding(s,g.name))):[]
 return {entrants:entrants.length,drawNotice:'',matches:matches.map(match),standings}
}
