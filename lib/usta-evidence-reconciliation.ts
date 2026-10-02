export type OfficialCourtRow = { championshipYear: number; cells: string[] }
export type CanonicalCourt = { id: string; match_date: string; match_type: string | null; score: string | null; winner_side: string | null; rating_eligible: boolean | null; match_players: { player_id: string; side: string }[] }
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const score = (s: string | null) => (s || '').match(/\d+\s*-\s*\d+/g)?.map(s => s.replace(/\s/g, '')).join(' ') || ''
const flipped = (s: string) => s.replace(/(\d+)-(\d+)/g, '$2-$1')
const date = (s: string) => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); return m ? `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}` : null }
function sameTeam(names: string[], official: string) {
 if(names.length===1) return normalized(names[0])===normalized(official)
 if(names.length!==2) return false
 return normalized(names.join(' '))===normalized(official) || normalized([...names].reverse().join(' '))===normalized(official)
}
/** Read-only evidence comparison. Never infers annual labels or mutates dates/results. */
export function reconcileOfficialCourts(rows: OfficialCourtRow[], canonical: CanonicalCourt[], names: Map<string,string>, season: number) {
 return rows.filter(r=>date(r.cells[1] || '')?.startsWith(`${season}-`)).map(r=>{
  if(r.cells.length!==7 || !/^\d+$/.test(r.cells[0]) || !/Singles|Doubles/.test(r.cells[5])) throw new Error('Invalid official court row')
  const playedOn=date(r.cells[1])!, format=r.cells[5].includes('Doubles')?'doubles':'singles'
  const candidates=canonical.filter(m=>m.match_type===format).flatMap(m=>{
   const a=m.match_players.filter(p=>p.side==='A').map(p=>names.get(p.player_id) || ''), b=m.match_players.filter(p=>p.side==='B').map(p=>names.get(p.player_id) || '')
   const required=format==='doubles'?2:1
   if(a.length!==required || b.length!==required || [...a,...b].some(n=>!n))return []
   const winningSide=sameTeam(a,r.cells[2]) && sameTeam(b,r.cells[3])?'A':sameTeam(b,r.cells[2]) && sameTeam(a,r.cells[3])?'B':null
   if(!winningSide)return []
   const officialScore=score(r.cells[4]), canonicalScore=score(m.score)
   if(!officialScore || (canonicalScore!==officialScore && canonicalScore!==flipped(officialScore))) return []
   return [{id:m.id,ratingEligible:m.rating_eligible===true,dateMatches:m.match_date===playedOn,canonicalDate:m.match_date,winnerMatches:m.winner_side===winningSide,officialWinnerSide:winningSide,scoreMatchesCourtSides:canonicalScore===(winningSide==='A'?officialScore:flipped(officialScore)),originalScore:m.score}]
  })
  // Prefer exact dates; a repeated matchup in another season/date is not the same court.
  const exact=candidates.filter(c=>c.dateMatches), matches=exact.length?exact:candidates
  const eligible=matches.filter(m=>m.ratingEligible)
  return {officialTeamMatchId:r.cells[0],championshipYear:r.championshipYear,playedOn,format,court:r.cells[5],winningPlayers:r.cells[2],opponents:r.cells[3],score:r.cells[4],matches,status:!matches.length?'missing':!exact.length && matches.length>1?'ambiguous_date':!exact.length?'date_difference':eligible.length>1?'duplicate_eligible':eligible.length===0?'excluded':matches.some(m=>!m.winnerMatches)?'winner_difference':'matched'}
 })
}
