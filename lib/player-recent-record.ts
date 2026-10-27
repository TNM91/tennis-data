export type RecentRecordEntry={date:string|null;result:string}
// Input is newest first, matching My Lab's connected result feed. Pending results
// are excluded from both the denominator and decided-result win streaks.
export function playerRecentRecord(entries:RecentRecordEntry[]){
 const decided=entries.filter(entry=>entry.result==='W'||entry.result==='L')
 const wins=decided.filter(entry=>entry.result==='W').length,losses=decided.length-wins
 // Reverse first so equal-date results keep the opposite of newest-first order.
 const chronological=[...decided].reverse().sort((a,b)=>(a.date?new Date(a.date).getTime():0)-(b.date?new Date(b.date).getTime():0))
 let bestWinStreak=0,rolling=0,currentWinStreak=0
 for(const entry of chronological){rolling=entry.result==='W'?rolling+1:0;bestWinStreak=Math.max(bestWinStreak,rolling)}
 for(const entry of decided){if(entry.result!=='W')break;currentWinStreak++}
 return {wins,losses,pending:entries.length-decided.length,winRate:decided.length?Math.round(wins/decided.length*100):null,bestWinStreak,currentWinStreak}
}
