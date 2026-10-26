export type PerformanceMatch={id:string;date:string;matchType:'singles'|'doubles';result:'W'|'L'}
export type SeasonPerformance={year:string;wins:number;losses:number;total:number;singles:number;doubles:number;netDelta:number|null;winRate:number;movementCount:number}
export function playerSeasonPerformance(matches:PerformanceMatch[],snapshots:ReadonlyMap<string,{delta?:number|null}>) {
  const map=new Map<string,{wins:number;losses:number;singles:number;doubles:number;deltaSum:number;deltaCount:number}>()
  for(const match of matches){
    const year=match.date.slice(0,4),rec=map.get(year)??{wins:0,losses:0,singles:0,doubles:0,deltaSum:0,deltaCount:0}
    if(match.result==='W')rec.wins++;else rec.losses++
    if(match.matchType==='singles')rec.singles++;else rec.doubles++
    const snap=snapshots.get(`${match.id}:${match.matchType}`)??snapshots.get(`${match.id}:overall`)
    if(snap?.delta!=null){rec.deltaSum+=snap.delta;rec.deltaCount++}
    map.set(year,rec)
  }
  return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([year,rec])=>({year,wins:rec.wins,losses:rec.losses,total:rec.wins+rec.losses,singles:rec.singles,doubles:rec.doubles,netDelta:rec.deltaCount>0?rec.deltaSum:null,movementCount:rec.deltaCount,winRate:rec.wins+rec.losses>0?Math.round(rec.wins/(rec.wins+rec.losses)*100):0}))
}
/** Input follows the player profile's newest-to-oldest match order. */
export function longestPlayerWinStreak(matches:PerformanceMatch[]) {
  let best=0,current=0
  for(const match of [...matches].reverse()){if(match.result==='W'){current++;if(current>best)best=current}else current=0}
  return best
}
export function playerCareerHighs(points:{rating:number}[],seasons:SeasonPerformance[],longestStreak:number) {
  const peakRating=points.length?Math.max(...points.map(p=>p.rating)):null
  const bestSeason=seasons.length?seasons.reduce((best,s)=>s.wins>best.wins?s:best,seasons[0]):null
  const mostMatchesSeason=seasons.length?seasons.reduce((best,s)=>s.total>best.total?s:best,seasons[0]):null
  return {peakRating,bestSeason,longestStreak,mostMatchesSeason}
}
export type PlayerCareerHighs=ReturnType<typeof playerCareerHighs>
