export type ResultBreakdownEntry={date:string|null;result:string;leagueName:string|null}
export type ResultBreakdownRow={label:string;wins:number;losses:number;total:number;winRate:number}
// Same ranking as My Lab's best season/league: rate, wins, then decided count.
// Calendar-date years stay stable across devices and time zones.
export function playerResultBreakdown(entries:ResultBreakdownEntry[]){
 const seasons=new Map<string,{wins:number;losses:number}>(),leagues=new Map<string,{wins:number;losses:number}>()
 const add=(map:Map<string,{wins:number;losses:number}>,key:string,result:string)=>{const record=map.get(key)||{wins:0,losses:0};if(result==='W')record.wins++;else record.losses++;map.set(key,record)}
 for(const entry of entries){
  if(entry.result!=='W'&&entry.result!=='L')continue
  const date=entry.date?new Date(entry.date):null
  const year=date&&!Number.isNaN(date.getTime())?String(date.getUTCFullYear()):'Connected'
  add(seasons,year,entry.result);add(leagues,entry.leagueName||'Connected matches',entry.result)
 }
 const rank=(map:Map<string,{wins:number;losses:number}>):ResultBreakdownRow[]=>[...map.entries()].map(([label,record])=>({label,...record,total:record.wins+record.losses,winRate:Math.round(record.wins/(record.wins+record.losses)*100)})).sort((a,b)=>b.winRate-a.winRate||b.wins-a.wins||b.total-a.total)
 return {seasons:rank(seasons),leagues:rank(leagues)}
}
