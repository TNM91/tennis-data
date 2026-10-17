import type { TiqTournamentMatchPreview, TiqTournamentMatchResult, TiqTournamentMatchSchedule, TiqTournamentRecord, TiqTournamentStanding } from './tiq-tournament-registry'

type Results = Record<string, TiqTournamentMatchResult>
type Schedule = Record<string, TiqTournamentMatchSchedule>
type DrawBuilder = (entrants: string[], results?: Results, schedule?: Schedule) => TiqTournamentMatchPreview[]
type Builders = { roundRobin: DrawBuilder; elimination: DrawBuilder }
export type TournamentGroup = { name: string; entrants: string[]; matches: TiqTournamentMatchPreview[]; standings: TiqTournamentStanding[];
  complete: boolean; qualifier: string; tied: string[]; tieMatches: TiqTournamentMatchPreview[] }

function scoreGames(score: string) {
  // Set tiebreak points and a deciding match tiebreak are not ordinary games.
  const text = score.replace(/\([^)]*\)|\[[^\]]*\]/g, '')
  const sets = [...text.matchAll(/\b(\d+)\s*[-–]\s*(\d+)\b/g)].map(match => [Number(match[1]), Number(match[2])])
    .filter(([a,b]) => Math.max(a,b) <= 7)
  return { known: sets.length > 0, a: sets.reduce((sum,set)=>sum+set[0],0), b: sets.reduce((sum,set)=>sum+set[1],0) }
}

export function buildGroupStandings(entrants: string[], matches: TiqTournamentMatchPreview[]) {
  const rows = new Map(entrants.map(entrant => [entrant, { entrant, played:0, wins:0, losses:0, gamesWon:0, gamesLost:0, gameDiff:0, winPct:0, gamesKnown:true }]))
  for (const match of matches) {
    if (!match.result || ![match.sideA,match.sideB].includes(match.result.winner)) continue
    const a = rows.get(match.sideA), b = rows.get(match.sideB)
    if (!a || !b) continue
    a.played++; b.played++
    const winner = match.result.winner === match.sideA ? a : b, loser = winner === a ? b : a
    winner.wins++; loser.losses++
    const games = scoreGames(match.result.score)
    if (!games.known) { a.gamesKnown=false; b.gamesKnown=false }
    a.gamesWon+=games.a; a.gamesLost+=games.b; b.gamesWon+=games.b; b.gamesLost+=games.a
  }
  return [...rows.values()].map(row=>({...row,gameDiff:row.gamesWon-row.gamesLost,winPct:row.played ? Math.round(row.wins/row.played*100):0}))
    .sort((a,b)=>b.wins-a.wins || b.gameDiff-a.gameDiff || b.gamesWon-a.gamesWon || a.entrant.localeCompare(b.entrant))
}

function resolvedDraw(entrants: string[], prefix: string, results: Results, schedule: Schedule, builder: DrawBuilder,
  known: Set<string>, stage: 'group'|'qualification'|'championship', roundOffset: number, labelPrefix = '') {
  const accepted: Results = {}
  // Resolve dependencies from their saved participants, not merely a matching winner name.
  for (let pass=0; pass<=entrants.length; pass++) {
    let changed=false
    for (const match of builder(entrants,accepted)) {
      const result = results[`${prefix}${match.id}`]
      if (accepted[match.id] || !result || !known.has(match.sideA) || !known.has(match.sideB)) continue
      if (result.sideA !== match.sideA || result.sideB !== match.sideB || ![match.sideA,match.sideB].includes(result.winner)) continue
      accepted[match.id]=result; changed=true
    }
    if (!changed) break
  }
  const draw=builder(entrants,accepted)
  const finalRound=Math.max(0,...draw.map(match=>match.round))
  return draw.map(match=>({ ...match, id:`${prefix}${match.id}`, round:match.round+roundOffset,
    label:`${labelPrefix}${stage !== 'group' && match.round === finalRound ? 'Final' : match.label}`, stage, ready:known.has(match.sideA) && known.has(match.sideB),
    result:match.result?.score==='Bye' && !known.has(match.result.winner) ? undefined:match.result,
    schedule:schedule[`${prefix}${match.id}`] }))
}

export const GROUP_PLAYOFF_RULES = 'Groups of 3–4 play a round robin. Each group winner advances. Rank by wins; a two-way tie uses head-to-head, then game difference and games won for remaining ties. If a tie remains, or required scores are missing, tied teams play a group tie-break. Fields below 6 use an elimination bracket.'

export function buildGroupPlayoffs(record: Pick<TiqTournamentRecord,'entrants'|'results'> & {schedule?: Schedule}, builders: Builders) {
  const entrants = [...new Set(record.entrants.map(name=>name.trim()).filter(Boolean))]
  const known = new Set(entrants), results=record.results || {}, schedule=record.schedule || {}
  if (entrants.length < 6) {
    const matches=resolvedDraw(entrants,'',results,schedule,builders.elimination,known,'championship',0)
    return { groups:[] as TournamentGroup[], matches, playoffs:matches, smallField:true,
      champion:matches.at(-1)?.result?.winner || '' }
  }
  const count=Math.ceil(entrants.length/4)
  const pools=Array.from({length:count},()=>[] as string[])
  entrants.forEach((name,index)=>pools[index%count].push(name))
  const groups=pools.map((pool,index):TournamentGroup=>{
    const name=`Group ${String.fromCharCode(65+index)}`
    const matches=resolvedDraw(pool,`g${index+1}-`,results,schedule,builders.roundRobin,known,'group',0,`${name} · `)
    let standings=buildGroupStandings(pool,matches)
    const complete=matches.length>0 && matches.every(match=>match.result?.winner)
    let tied=complete ? standings.filter(row=>row.wins===standings[0].wins).map(row=>row.entrant):[]
    if (tied.length===2) {
      const head=matches.find(match=>tied.includes(match.sideA) && tied.includes(match.sideB))
      if (head?.result?.winner) tied=[head.result.winner]
    }
    if (tied.length>1 && matches.every(match=>scoreGames(match.result?.score || '').known)) {
      const ranked=standings.filter(row=>tied.includes(row.entrant))
      const difference=Math.max(...ranked.map(row=>row.gameDiff))
      const byDifference=ranked.filter(row=>row.gameDiff===difference)
      const gamesWon=Math.max(...byDifference.map(row=>row.gamesWon))
      tied=byDifference.filter(row=>row.gamesWon===gamesWon).map(row=>row.entrant)
    }
    const tieMatches=tied.length>1 ? resolvedDraw(pool.filter(name=>tied.includes(name)),`t${index+1}-`,results,schedule,
      builders.elimination,known,'qualification',10,`${name} tie-break · `):[]
    const qualifier=tied.length===1 ? tied[0] : tieMatches.at(-1)?.result?.winner || ''
    if (qualifier) standings=[...standings.filter(row=>row.entrant===qualifier),...standings.filter(row=>row.entrant!==qualifier)]
    return { name,entrants:pool,matches,standings,complete,qualifier,tied:qualifier ? []:tied,tieMatches }
  })
  const qualifiers=groups.map(group=>{
    if (group.qualifier) return group.qualifier
    let placeholder=`Winner ${group.name}`
    while (known.has(placeholder)) placeholder+=' (pending)'
    return placeholder
  })
  const playoffs=resolvedDraw(qualifiers,'p-',results,schedule,builders.elimination,known,'championship',20)
  return {groups,playoffs,matches:[...groups.flatMap(group=>[...group.matches,...group.tieMatches]),...playoffs],smallField:false,
    champion:playoffs.at(-1)?.result?.winner || ''}
}
