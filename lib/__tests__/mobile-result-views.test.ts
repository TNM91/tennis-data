import {describe,it,expect} from 'vitest'
import {resultsHtml,resultViewControls,type ResultView} from '../../mobile/src/results-view'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
const row:RecentMatchRow={id:'synthetic',match_date:'2026-10-27',match_type:'Singles',league_name:'City League',score:'6-4',winner_side:'A',match_players:[{player_id:'me',side:'A'}]}
describe('My Lab result views',()=>{
 it('renders four named pressed controls linked to the insight region',()=>{
  for(const view of ['form','formats','leagues','years'] as ResultView[]){const output=resultViewControls(view);expect(output.match(/aria-pressed="true"/g)).toHaveLength(1);expect(output).toContain(`data-result-view="${view}" aria-pressed="true"`);expect(output.match(/aria-controls="lab-result-panel"/g)).toHaveLength(4)}
 })
 it('defaults to form and renders only the selected statistical view',()=>{
  const form=resultsHtml([row],'me','All','your',true)
  expect(form).toContain('Current win streak');expect(form).toContain('Decided win rate');expect(form).not.toContain('lab-format-grid');expect(form).not.toContain('lab-result-breakdown')
  const formats=resultsHtml([row],'me','All','your',true,'leagues','formats')
  expect(formats).toContain('lab-format-grid');expect(formats).not.toContain('Current win streak');expect(formats).not.toContain('match-pulse')
  for(const view of ['leagues','years'] as const){const output=resultsHtml([row],'me','All','your',true,'leagues',view);expect(output).toContain('lab-result-breakdown');expect(output).not.toContain('lab-format-grid');expect(output).not.toContain('Current win streak');expect(output).not.toContain('data-result-breakdown=')}
 })
 it('retains sample labels, empty format recovery and matching list actions in every view',()=>{
  for(const view of ['form','formats','leagues','years'] as ResultView[]){const output=resultsHtml([row],'me','Singles','your',true,'leagues',view);expect(output).toContain('latest 1 connected results');expect(output).toContain('data-index="0"');expect(resultsHtml([row],'me','Doubles','your',true,'leagues',view)).toContain('Try All.')}
 })
 it('keeps player profile result layouts unchanged',()=>{
  const output=resultsHtml([row],'me','All')
  expect(output).not.toContain('data-result-view');expect(output).toContain('match-pulse');expect(output).toContain('data-index="0"')
 })
})
