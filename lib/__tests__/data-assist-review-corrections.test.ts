import {describe,it,expect} from 'vitest'
import {type ImportReviewEdits,importReviewSource,importReviewProblem,applyImportReviewCorrection} from '../data-assist-review-corrections'
import {buildDataAssistScorecardImportRow,buildScorecardImportFingerprint} from '../data-assist-import'
import {importCorrectionsHtml} from '../../mobile/src/data-import-corrections-view'
import {reviewScorecard,reviewRoster} from '../../tests/fixtures/import-review-data'
const score=()=>structuredClone(reviewScorecard),roster=()=>structuredClone(reviewRoster)
describe('owner-reviewed import corrections',()=>{
 it('projects only bounded editable facts, never contacts, OCR or provenance',()=>{const projected=importReviewSource(roster())!;expect(projected.rows[1].ntrp).toBe('');expect(JSON.stringify(projected)).not.toMatch(/private|555|provider|rawText|contact/);expect(importReviewSource({...roster(),players:Array(101).fill(reviewRoster.players[0])})).toBeUndefined();expect(importReviewSource({...score(),lineCount:9})).toBeUndefined()})
 it('applies match/player/score changes immutably while preserving parser evidence',()=>{const source=score(),original=structuredClone(source),base=importReviewSource(source)!;const result=applyImportReviewCorrection(source,{base,edits:{'rows.0.homePlayers':'Alexandra Lee','rows.1.winner':'away','rows.1.score':'2-6 4-6',matchDate:'2026-10-29'}}) as typeof source;expect(source).toEqual(original);expect(result).toMatchObject({matchDate:'10/29/2026',provider:source.provider,confidenceScore:source.confidenceScore,parserWarnings:source.parserWarnings});expect(result.lines[0].homePlayers).toEqual(['Alexandra Lee']);expect(result.lines[1]).toMatchObject({winner:'away',sets:[{homeGames:2,awayGames:6},{homeGames:4,awayGames:6}],scoreEventType:'standard'});expect(result.lines[1].parseNotes).toContain('Score and winner confirmed by uploader.')})
 it('refuses unknown fields, unregistered row edits, changed source, altered confidence and wrong kinds',()=>{const source=score(),base=importReviewSource(source)!;for(const edits of [{'rows.2.score':'6-0'},{'rows.0.lineLabel':'3 Singles'},{provider:'mock_review'},{'rows.0.confidenceScore':'1'},{'__proto__.polluted':'x'}])expect(()=>applyImportReviewCorrection(source,{base,edits})).toThrow();expect(()=>applyImportReviewCorrection({...source,homeTeam:'Different'},{base,edits:{}})).toThrow('changed');expect(()=>applyImportReviewCorrection(source,{base:{...base,kind:'team_summary'},edits:{}})).toThrow();expect(()=>applyImportReviewCorrection(source,{base,edits:{},provider:'x'})).toThrow()})
 it('blocks invalid dates, incomplete sides, duplicate players, unknown winners and junk scores',()=>{const base=importReviewSource(score())!,fixed={'rows.1.winner':'away'};for(const edits of [{matchDate:'2026-02-30'},{externalMatchId:'123'},{homeTeam:'City Rallies'},{'rows.1.homePlayers':'One player'},{'rows.0.homePlayers':'Drew Park'},{'rows.1.winner':'unknown'},{'rows.1.score':'anything goes'},{'rows.0.homePlayers':'Name\u0000'}] as ImportReviewEdits[])expect(importReviewProblem(base,{...fixed,...edits})).not.toBe('');expect(importReviewProblem(base,fixed)).toBe('')})
 it('keeps each court once and produces the same duplicate fingerprint on a repeated confirmation',()=>{const source=score(),base=importReviewSource(source)!,correction={base,edits:{'rows.1.winner':'away'}};const a=buildDataAssistScorecardImportRow(applyImportReviewCorrection(source,correction) as typeof source).row,b=buildDataAssistScorecardImportRow(applyImportReviewCorrection(source,correction) as typeof source).row;expect(a.lines).toHaveLength(2);expect(a.totalTeamScore).toEqual({home:1,away:1});expect(buildScorecardImportFingerprint(a)).toBe(buildScorecardImportFingerprint(b));expect(a.lines.map(row=>row.matchType)).toEqual(['singles','doubles'])})
 it('preserves private contacts and provenance, and labels changed roster ratings self-rated',()=>{const source=roster(),base=importReviewSource(source)!;const result=applyImportReviewCorrection(source,{base,edits:{'rows.0.name':'Alexandra Lee','rows.1.ntrp':'4.5'}}) as typeof source;expect(result.players[0]).toMatchObject({name:'Alexandra Lee',email:'private@example.invalid',ratingSource:'verified'});expect(result.players[1]).toMatchObject({ntrp:4.5,ratingSource:'self'});expect(result.contacts[0]).toMatchObject({...source.contacts[0],name:'Alexandra Lee'});expect(source.contacts[0].name).toBe('Alex Lee');expect(result.rawTextPreview).toBe(source.rawTextPreview)})
 it('rejects duplicate roster names and non-NTRP numeric input',()=>{const base=importReviewSource(roster())!;for(const edits of [{'rows.1.name':'Alex Lee','rows.1.ntrp':'4'},{'rows.1.ntrp':'4.42'},{'rows.1.ntrp':'7.5'},{'rows.1.ntrp':'NaN'}] as ImportReviewEdits[])expect(importReviewProblem(base,edits)).not.toBe('')})
 it('escapes file values in controls and change review while retaining accessible labels',()=>{const base=importReviewSource(score())!;base.fields.homeTeam='<script>team</script>';const page=importCorrectionsHtml(base,{'rows.0.homePlayers':'<Alex>'});expect(page).not.toContain('<script>');expect(page).toContain('&lt;script&gt;');expect(page).toContain('&lt;Alex&gt;');expect(page).toContain('Changes to confirm');expect(page).toContain('data-review-status');expect(page).toContain('Winning team')})
})

it('accepts equivalent native JSON key ordering while retaining row order and value checks',()=>{
 const source=structuredClone(reviewScorecard),base=importReviewSource(source)!
 const reordered=JSON.parse(JSON.stringify(base,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).reverse()):value))
 expect(applyImportReviewCorrection(source,{edits:{'rows.1.winner':'away'},base:reordered})).toMatchObject({externalMatchId:source.externalMatchId})
 expect(()=>applyImportReviewCorrection(source,{base:{...base,rows:[...base.rows].reverse()},edits:{'rows.1.winner':'away'}})).toThrow('changed')
})

it('recomputes only derived division details when the roster league or flight is corrected',()=>{
 const source=structuredClone(reviewRoster);source.players[0].mixedPairRole='man';source.players[0].ageDivision='40 & Over';const base=importReviewSource(source)!
 const corrected=applyImportReviewCorrection(source,{base,edits:{leagueName:'2026 Adult 18 & Over',flight:'Women 4.0','rows.1.ntrp':'4'}}) as typeof source
 expect(corrected.players[0]).toMatchObject({mixedPairRole:'woman',ageDivision:'18 & Over',ratingSource:'verified',email:source.players[0].email})
 expect(source.players[0].mixedPairRole).toBe('man')
 const unchanged=applyImportReviewCorrection(source,{base,edits:{'rows.1.ntrp':'4'}}) as typeof source
 expect(unchanged.players[0]).toMatchObject({mixedPairRole:'man',ageDivision:'40 & Over'})
})

it('adds a missed court with explicit source provenance and rejects duplicate court identities',()=>{
 const source=score(),base=importReviewSource(source)!,edits={'rows.1.winner':'away'},addedRows=[{lineLabel:'3 Singles',homePlayers:'New Home',awayPlayers:'New Away',score:'6-2 6-3',winner:'home'}]
 const result=applyImportReviewCorrection(source,{base,edits,addedRows}) as typeof source
 expect(result.lineCount).toBe(3);expect(result.lines).toHaveLength(3);expect(result.lines[2]).toMatchObject({lineLabel:'3 Singles',confidenceScore:0,ntrp:null,homePlayers:['New Home'],winnerSource:'winner_column'});expect(result.lines[2].parseNotes).toContain('Court added from source file by uploader.');expect(source.lines).toHaveLength(2)
 expect(()=>applyImportReviewCorrection(source,{base,edits,addedRows:[{...addedRows[0],lineLabel:'1 Singles'}]})).toThrow('once')
 expect(()=>applyImportReviewCorrection(source,{base,edits,addedRows:[{...addedRows[0],provider:'trusted'}]})).toThrow()
 expect(()=>applyImportReviewCorrection(source,{base,edits,addedRows:Array(9).fill(addedRows[0])})).toThrow()
})
it('adds a source roster player without inventing contact data, rating authority, or parser confidence',()=>{
 const source=roster(),base=importReviewSource(source)!,addedRows=[{name:'New Player',teamName:source.rosterTeamName,ntrp:'4.5'}]
 const result=applyImportReviewCorrection(source,{base,edits:{'rows.1.ntrp':'4'},addedRows}) as typeof source
 expect(result.playerCount).toBe(3);expect(result.players[2]).toMatchObject({name:'New Player',ntrp:4.5,ratingSource:'self'});expect(result.players[2]).not.toHaveProperty('email');expect(result.contacts).toEqual(source.contacts);expect(result.confidenceScore).toBe(source.confidenceScore)
 expect(()=>applyImportReviewCorrection(source,{base,edits:{'rows.1.ntrp':'4'},addedRows:[{...addedRows[0],name:source.players[0].name}]})).toThrow('once')
})

it('refuses different court types that collide on the importer persisted court number',()=>{
 const source=score();source.lines[1].lineLabel='1 Doubles';const base=importReviewSource(source)!
 expect(importReviewProblem(base,{'rows.1.winner':'away'})).toContain('position must appear once')
})
