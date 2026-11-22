import {it,expect} from 'vitest'
import {weekFixture} from './fixtures/captain-week-brief'
import {briefMatchHtml,briefMatchIssuesHtml,briefPracticesHtml} from '../../mobile/src/captain-week-brief-view'
import type {CaptainWeekBrief} from '../../mobile/src/captain-week-brief-data'
const f=weekFixture(),data:CaptainWeekBrief={scope:f.scope,today:'2026-10-25',through:'2026-10-31',checkedAt:f.center.checkedAt,matches:[f.fixture],moreMatches:false,excluded:0,practices:[f.practice],practiceState:'ready',morePractices:false}
it('keeps private notes and delivery tokens out of the brief and shows checked readiness',()=>{const h=briefMatchHtml(f.center);expect(h).toContain('Readiness checked');expect(h).toContain('Not shared');expect(h).not.toContain(f.center.lineup.plan.notes);expect(h).not.toContain(f.center.publication.expectedCardToken)})
it('does not turn a practice failure into an empty week and retains sample caveats',()=>{expect(briefPracticesHtml({...data,practiceState:'unavailable',practices:[]})).toContain('Practices could not load');expect(briefPracticesHtml({...data,morePractices:true})).toContain('latest 40');expect(briefPracticesHtml({...data,practices:[]})).toContain('loaded week sample')})
it('separates In/waitlist/confirmed counts, flags over-capacity confirmations and escapes titles',()=>{const person={id:'p',name:'Secret name',response:'in' as const,displayStatus:'waitlist' as const,respondedAt:f.practice.updatedAt,confirmedAt:f.practice.updatedAt,updatedAt:f.practice.updatedAt};const h=briefPracticesHtml({...data,practices:[{...f.practice,title:'<Practice>',capacity:1,roster:[person,{...person,id:'q'}]}]});expect(h).toContain('&lt;Practice&gt;');expect(h).toContain('0 In · 2 waitlisted · 2 captain-confirmed');expect(h).toContain('exceed capacity');expect(h).not.toContain('Secret name')})
it('offers distinct lineup, selected-reply and delivery actions from the same checked issue order',()=>{
 const c=structuredClone(f.center);c.lineup.plan.courts[0].players[0]='';c.replies.people.forEach(p=>{p.status='waiting'});c.publication.shared.pendingFinal=true
 const markup=briefMatchIssuesHtml(f.scope,f.fixture,c,true)
 expect(markup).toContain('data-brief-issue="0"');expect(markup).toContain('Review lineup')
 expect(markup).toContain('data-brief-issue="1"');expect(markup).toContain('Review selected replies')
 expect(markup).toContain('data-brief-issue="2"');expect(markup).toContain('Review delivery')
 expect(markup.match(/ disabled/g)).toHaveLength(3)
 expect(markup).not.toContain(c.publication.expectedCardToken);expect(markup).not.toContain(c.lineup.plan.notes)
})
it('does not invent issue shortcuts for a ready lineup and keeps an unmatched selected reply actionable',()=>{
 expect(briefMatchIssuesHtml(f.scope,f.fixture,f.center)).toBe('')
 const c=structuredClone(f.center);c.replies.people=[]
 const markup=briefMatchIssuesHtml(f.scope,f.fixture,c)
 expect(markup).toContain('Review selected replies');expect(markup).not.toContain('Review lineup');expect(markup).not.toContain('Review delivery')
})
it('escapes match context in issue action names and refuses a crossed match or scope',()=>{
 const c=structuredClone(f.center),fixture={...f.fixture,away:'<Rallies>'};c.fixture=fixture;c.lineup.match.opponent='<Rallies>';c.publication.opponent='<Rallies>';c.publication.shared.pendingFinal=true
 expect(briefMatchIssuesHtml(f.scope,fixture,c)).toContain('for &lt;Rallies&gt;,');expect(briefMatchIssuesHtml(f.scope,fixture,c)).not.toContain('<Rallies>')
 expect(()=>briefMatchIssuesHtml({...f.scope,flight:'Other'},fixture,c)).toThrow()
 expect(()=>briefMatchIssuesHtml(f.scope,{...fixture,id:'other'},c)).toThrow()
})
