import type {RatingView} from './player-rating-display'
type SeasonMatch={id:string;date:string;matchType:string;result:string}
type SeasonSnapshot={delta?:number|null}
/** Uses the same calendar-year and split-before-Overall evidence rules as the player profile. */
export function playerSeasonReview<M extends SeasonMatch,S extends SeasonSnapshot>(matches:readonly M[],snapshots:ReadonlyMap<string,S>,year?:string,view:RatingView='overall') {
 const selected=matches.filter(m=>view==='overall'||m.matchType===view)
 const season=year??selected.map(m=>m.date.slice(0,4)).filter(y=>/^\d{4}$/.test(y)).sort().at(-1)
 if(!season||!/^\d{4}$/.test(season))return null
 const decided=selected.filter(m=>m.date.slice(0,4)===season&&(m.result==='W'||m.result==='L'))
 if(!decided.length)return null
 const entries=decided.map(match=>({match,snap:snapshots.get(`${match.id}:${match.matchType}`)??snapshots.get(`${match.id}:overall`)??null}))
 const rated=entries.filter(e=>typeof e.snap?.delta==='number'&&Number.isFinite(e.snap.delta))
 const largestLift=[...rated].filter(e=>e.match.result==='W').sort((a,b)=>b.snap!.delta!-a.snap!.delta!)[0]??null
 const toughestLoss=[...rated].filter(e=>e.match.result==='L').sort((a,b)=>a.snap!.delta!-b.snap!.delta!)[0]??null
 const biggestSwing=[...rated].sort((a,b)=>Math.abs(b.snap!.delta!)-Math.abs(a.snap!.delta!))[0]??null
 const wins=decided.filter(m=>m.result==='W').length,singles=decided.filter(m=>m.matchType==='singles'),doubles=decided.filter(m=>m.matchType==='doubles')
 const nextFocus=view==='overall'&&singles.length===0?'Add a singles result to separate your all-court signal.':view==='overall'&&doubles.length===0?'Add a doubles result to build a truer all-court read.':wins/decided.length>=.6?'Protect the lift: test it against a similarly rated opponent.':'Use the next close set to test the adjustment under pressure.'
 return {season,decided,wins,singles,doubles,largestLift,toughestLoss,biggestSwing,nextFocus,movementCount:rated.length}
}
