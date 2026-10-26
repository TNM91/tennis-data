import type {PlayerRatingShape,RatingView} from './player-rating-display'
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

export function playerBenchmark(fieldAvgRating:number|null,tiq:number|null,wins:number,total:number,form:number|null) {
  return {fieldAvgRating,tiqDiff:fieldAvgRating!==null&&tiq!==null?tiq-fieldAvgRating:null,winRateDiff:total>0?wins/total*100-50:null,formVsNeutral:form}
}
export type PlayerBenchmark=ReturnType<typeof playerBenchmark>
export function playerOpponentBands(matches:PerformanceMatch[],snapshots:ReadonlyMap<string,{opponent_rating?:number|null}>,baseRating:number|null) {
  if(baseRating===null||!Number.isFinite(baseRating)||baseRating<1.5||baseRating>7)return null
  const bands={weaker:{w:0,l:0},similar:{w:0,l:0},stronger:{w:0,l:0}}
  for(const match of matches){const snap=snapshots.get(`${match.id}:${match.matchType}`)??snapshots.get(`${match.id}:overall`),rating=snap?.opponent_rating;if(rating==null||!Number.isFinite(rating)||rating<1.5||rating>7)continue
    const diff=Math.round((rating-baseRating)*1e9)/1e9,bucket=diff>.25?'stronger':diff<-.25?'weaker':'similar'
    if(match.result==='W')bands[bucket].w++;else bands[bucket].l++
  }
  return Object.values(bands).some(b=>b.w+b.l>0)?bands:null
}
export type PlayerOpponentBands=NonNullable<ReturnType<typeof playerOpponentBands>>

export function playerRecentForm(snapshots:ReadonlyArray<{delta?:number|null}>) {
  const deltas=snapshots.slice(-5).map(s=>s.delta).filter((d):d is number=>typeof d==='number'&&Number.isFinite(d))
  return deltas.length?deltas.reduce((sum,d)=>sum+d,0):null
}

export function playerPublishedBaseline(player:(PlayerRatingShape & {rating_source?:string|null})|null|undefined,view:RatingView):number|null {
  if(player?.rating_source!=='verified')return null
  const raw=player[`${view}_rating`]??player.overall_rating
  if(raw===null||raw===undefined)return null
  const value=Number(raw)
  return Number.isFinite(value)&&value>=1.5&&value<=7?value:null
}
