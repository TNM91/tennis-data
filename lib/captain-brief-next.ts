/** Shared website/native sequence before an unshared match plan is sent. */
export function captainBriefNext(input:{hasScope:boolean;hasLineup:boolean;responseRisks:number;hasLogistics:boolean}){
 if(!input.hasScope)return {kind:'scope' as const,title:'Choose the team week',detail:'Set the team, league, and flight before building a match-day plan.'}
 if(!input.hasLineup)return {kind:'lineup' as const,title:'Build the current courts',detail:'Set the lineup first so the team receives a clear, usable plan.'}
 if(input.responseRisks)return {kind:'availability' as const,title:'Resolve availability',detail:`${input.responseRisks} response risk${input.responseRisks===1?'':'s'} still need attention before sending.`}
 if(!input.hasLogistics)return {kind:'logistics' as const,title:'Add match logistics',detail:'Confirm the opponent, arrival time, and location before sharing the plan.'}
 return {kind:'share' as const,title:'Share the match plan',detail:'Your lineup, logistics, and readiness are in place. Send the team update now.'}
}
