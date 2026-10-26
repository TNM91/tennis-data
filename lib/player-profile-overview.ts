import type {PerformanceMatch} from './player-performance'
export function recentProfileMove(points:Array<{rating:number}>):number|null {
 if(points.length<2)return null
 const recent=points.slice(-5);return Math.round((recent.at(-1)!.rating-recent[0].rating)*100)/100
}
export function playerMatchQuality(matches:Array<PerformanceMatch&{score?:string|null}>,opponentRatings:number[],label:string) {
 const total=matches.length,scored=matches.filter(m=>/\d+\s*[-:]\s*\d+/.test(m.score??'')),close=scored.filter(m=>[...(m.score??'').matchAll(/(\d+)\s*[-:]\s*(\d+)/g)].some(s=>Math.abs(Number(s[1])-Number(s[2]))<=2)).length
 const type=matches[0]?.result;let streak=0;for(const match of matches){if(match.result!==type)break;streak++}
 const ratings=opponentRatings.filter(r=>Number.isFinite(r)&&r>=1.5&&r<=7),average=ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:null
 return [{label:'Scores captured',value:total?`${scored.length}/${total}`:'—',note:total?'Results with a final score':'No results yet',percent:total?Math.round(scored.length/total*100):0},{label:'Current streak',value:streak?`${streak}${type}`:'—',note:streak?`${type==='W'?'Wins':'Losses'} in a row`:'Trend building',percent:total?Math.min(100,Math.round(streak/total*100)):0},{label:'Close scorecards',value:scored.length?`${close}/${scored.length}`:'—',note:scored.length?'At least one close set':'Scores still arriving',percent:scored.length?Math.round(close/scored.length*100):0},{label:'Avg opponent',value:average===null?'—':average.toFixed(2),note:average===null?'More context needed':`${label} TIQ rating · ${ratings.length} snapshots`,percent:average===null?0:Math.min(100,Math.round(average/7*100))}]
}
