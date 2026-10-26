export type RepeatMatch={date:string;result:'W'|'L';opponent:string;opponentIds:string[]}
export type RepeatOpponent={key:string;name:string;id:string|null;wins:number;losses:number;lastDate:string;total:number}
/** Keep doubles pairs together; distinct linked players with the same name stay distinct. */
export function playerRepeatOpponents(matches:RepeatMatch[]):RepeatOpponent[] {
  const records=new Map<string,RepeatOpponent>()
  for(const match of matches){
    if(!match.opponent||match.opponent.includes('Player not linked')||!match.opponentIds.length)continue
    const key=[...match.opponentIds].sort().join('|')
    const row=records.get(key)??{key,name:match.opponent,id:match.opponentIds[0]??null,wins:0,losses:0,lastDate:match.date,total:0}
    if(match.result==='W')row.wins++;else row.losses++
    row.total++;if(match.date>row.lastDate)row.lastDate=match.date
    records.set(key,row)
  }
  return [...records.values()].filter(row=>row.total>=2).sort((a,b)=>b.total-a.total||b.lastDate.localeCompare(a.lastDate)||a.key.localeCompare(b.key)).slice(0,8)
}
