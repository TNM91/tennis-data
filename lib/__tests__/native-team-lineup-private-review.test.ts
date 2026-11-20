import {describe,expect,it} from 'vitest'
import type {MatchLineupCourt} from '../team-match-lineup-contract'
import type {TeamMatchReplies} from '../team-match-replies-contract'
import {privateCourtReviewNavigationHtml,privateLineupReview,privateLineupReviewHtml} from '../../mobile/src/team-lineup-private-review'

const courts=():MatchLineupCourt[]=>[{format:'doubles',players:['alex','casey']},{format:'singles',players:['riley']}]
const replies=():TeamMatchReplies=>({own:null,rosterComplete:true,
 lineupRoster:[{id:'alex',name:'Alex',choice:'in'},{id:'casey',name:'Casey',choice:'in'},
  {id:'riley',name:'Riley',choice:'in'},{id:'morgan',name:'Morgan',choice:'in'}],
 sharedLineup:{version:'published',courts:courts(),names:{alex:'Alex',casey:'Casey',riley:'Riley'}}})

describe('private lineup review',()=>{
 it('keeps unchanged, available courts compact without implying a new publication',()=>{
  const data=replies(),before=structuredClone(data)
  expect(privateLineupReview(courts(),data)).toMatchObject({rows:[],needsReview:0,removed:[],counts:{unchanged:2,changed:0,new:0,removed:0}})
  const markup=privateLineupReviewHtml(courts(),data,false,false)
  expect(markup).toContain('No court changes · 0 courts need review')
  expect(markup).toContain('Edits stay private until you publish.')
  expect(markup).toContain('Court assignments match the published lineup.')
  expect(data).toEqual(before)
 })
 it('shows private replacements against published players, preserving mixed court indices',()=>{
  const plan:MatchLineupCourt[]=[{format:'singles',players:['riley']},{format:'doubles',players:['alex','morgan']},{format:'singles',players:['']}]
  const review=privateLineupReview(plan,replies())
  expect(review.counts).toEqual({new:1,changed:1,removed:0,unchanged:1})
  expect(review.rows).toMatchObject([{label:'Doubles 1',court:1,before:'Alex & Casey',players:'Alex & Morgan',issues:[]},
   {label:'Singles 2',court:2,players:'Open spot',issues:[{slot:0,detail:'Open spot · Choose a teammate'}]}])
  expect(review.needsReview).toBe(1)
 })
 it('identifies empty and duplicate slots by ID on every affected court',()=>{
  const plan:MatchLineupCourt[]=[{format:'doubles',players:['','alex']},{format:'singles',players:['alex']}]
  const review=privateLineupReview(plan,replies())
  expect(review.needsReview).toBe(2)
  expect(review.rows[0].issues).toEqual([{slot:0,detail:'Open spot · Choose a teammate'},{slot:1,detail:'Alex · Assigned more than once'}])
  expect(review.rows[1].issues).toEqual([{slot:0,detail:'Alex · Assigned more than once'}])
  expect(review.rows[0].players).toBe('Open spot & Alex')
 })
 it.each(['out','maybe',null] as const)('targets a player marked %s even when the court is unchanged',choice=>{
  const data=replies();data.lineupRoster![1].choice=choice
  const review=privateLineupReview(courts(),data)
  expect(review.rows).toHaveLength(1)
  expect(review.rows[0]).toMatchObject({court:0,status:'unchanged',issues:[{slot:1,detail:`Casey · ${choice==='out'?'Can’t play':choice==='maybe'?'Maybe':'Awaiting reply'}`} ]})
 })
 it('distinguishes unknown availability from a player removed from a complete roster',()=>{
  const data=replies();data.lineupRoster=data.lineupRoster!.filter(player=>player.id!=='casey')
  expect(privateLineupReview(courts(),data).rows[0].issues[0].detail).toBe('Casey · No longer on roster')
  data.rosterComplete=false
  expect(privateLineupReview(courts(),data).rows[0].issues[0].detail).toBe('Casey · Not in loaded roster')
  delete data.lineupRoster
  expect(privateLineupReview(courts(),data).rows[0].issues.map(issue=>issue.detail)).toEqual(['Alex · Availability not checked','Casey · Availability not checked'])
  expect(privateLineupReviewHtml(courts(),null,true,false)).toContain('Only loaded teammates have been checked.')
 })
 it('compares same-name profiles by identity and ignores doubles partner order',()=>{
  const data=replies();data.lineupRoster![0]={id:'new-2222',name:'Alex',choice:'in'}
  const plan=courts();plan[0].players[0]='new-2222'
  const review=privateLineupReview(plan,data)
  expect(review.rows[0]).toMatchObject({before:'Alex (ALEX) & Casey',players:'Alex (2222) & Casey',issues:[]})
  data.lineupRoster!.push({id:'alex',name:'Alex',choice:'in'})
  expect(privateLineupReview(plan,data).needsReview).toBe(0)
  const reversed=courts();reversed[0].players.reverse()
  expect(privateLineupReview(reversed,replies()).rows).toEqual([])
 })
 it('shows removed courts without a broken jump, including an empty working plan',()=>{
  const markup=privateLineupReviewHtml([],replies(),true,false)
  expect(markup).toContain('2 removed');expect(markup).toContain('Published · Alex &amp; Casey')
  expect(markup).toContain('Add a court below');expect(markup).not.toContain('data-review-private-court=')
  expect(markup).not.toContain('Court assignments match')
  const empty=privateLineupReviewHtml([],null,false,false)
  expect(empty).toContain('No lineup has been published yet');expect(empty).not.toContain('Court assignments match')
 })
 it('shows new private courts without using a saved private plan as the comparison',()=>{
  const data=replies();data.savedLineup=data.sharedLineup;delete data.sharedLineup
  expect(privateLineupReview(courts(),data)).toMatchObject({counts:{new:2,changed:0,unchanged:0,removed:0},needsReview:0})
  expect(privateLineupReviewHtml(courts(),data,true,false)).toContain('No lineup has been published yet')
 })
 it('escapes names and disables court shortcuts while changes are blocked',()=>{
  const data=replies();data.lineupRoster![1].name='<Casey "Ace">';data.lineupRoster![1].choice='out'
  const markup=privateLineupReviewHtml(courts(),data,true,true)
  expect(markup).toContain('&lt;Casey &quot;Ace&quot;&gt;');expect(markup).not.toContain('<Casey')
  expect(markup).toContain('data-review-private-court="0" aria-label="Review Doubles 1" disabled')
 })
 it('prioritizes other flagged courts before changes with no player flags, and wraps in court order',()=>{
  const data=replies(),plan=courts()
  plan[0].players[1]='morgan';plan.push({format:'singles',players:['']})
  const fromDoubles=privateCourtReviewNavigationHtml(plan,data,0,false)
  expect(fromDoubles).toContain('data-next-private-court="2" aria-label="Review Singles 2 next"')
  expect(fromDoubles).not.toContain('Review Singles 1 next')
  data.lineupRoster![2].choice='maybe'
  expect(privateCourtReviewNavigationHtml(plan,data,2,false)).toContain('data-next-private-court="1" aria-label="Review Singles 1 next"')
 })
 it('keeps a return path after a court is resolved, with no invalid next destination',()=>{
  const markup=privateCourtReviewNavigationHtml(courts(),replies(),0,false)
  expect(markup).toContain('Back to private changes')
  expect(markup).not.toContain('data-next-private-court')
  expect(markup).toContain('last match check')
  expect(privateCourtReviewNavigationHtml([],replies(),0,false)).toBe('')
  expect(privateCourtReviewNavigationHtml(courts(),replies(),-1,false)).toBe('')
  expect(privateCourtReviewNavigationHtml(courts(),replies(),0,true)).toContain('data-return-private-review disabled')
 })
})
