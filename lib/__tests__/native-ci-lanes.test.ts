import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'

type Step={name?:string;run?:string;uses?:string;if?:string;env?:Record<string,string>;with?:Record<string,string|number>;'continue-on-error'?:boolean}
type Job={name:string;steps:Step[];'runs-on':string;'timeout-minutes':number;if?:string;needs?:unknown;'continue-on-error'?:boolean}
const {load}=createRequire(import.meta.url)('js-yaml') as {load:(text:string)=>{jobs:Record<string,Job>}}
const jobs=load(readFileSync('.github/workflows/ci.yml','utf8')).jobs
const lanes=['captain-weekly-continuity','native-league-browser','native-tournament-browser'] as const
const steps=lanes.flatMap(key=>jobs[key].steps)
const suites=[
 ['mobile-apple-memberships.e2e.ts','captain-weekly-continuity','4259'],
 ['mobile-google-memberships.e2e.ts','captain-weekly-continuity','4259'],
 ['mobile-chat-poll-sheets.e2e.ts','captain-weekly-continuity','4260'],
 ['mobile-chat-experience.e2e.ts','captain-weekly-continuity','4261'],
 ['mobile-lab-scoreboard.e2e.ts','captain-weekly-continuity','4262'],
 ['mobile-captain-workspace.e2e.ts','captain-weekly-continuity','4266'],
 ['mobile-insights.e2e.ts','captain-weekly-continuity','4263'],
 ['mobile-import-corrections.e2e.ts','captain-weekly-continuity','4264'],
 ['mobile-competitions.e2e.ts','native-league-browser','4265'],
 ['mobile-tournaments.e2e.ts','native-tournament-browser','4266'],
] as const

describe('independent native browser CI lanes',()=>{
 it('keeps every existing phone suite exactly once with both engines and its original isolated origin',()=>{
  for(const [file,lane,port]of suites){
   const matching=steps.filter(step=>step.run?.includes('tests/e2e/'+file))
   expect(matching,file).toHaveLength(1)
   expect(jobs[lane].steps).toContain(matching[0])
   expect(matching[0].run).toContain('--project=mobile-chrome')
   expect(matching[0].run).toContain('--project=mobile-webkit')
   expect(matching[0].run).not.toMatch(/--(?:grep|grep-invert|shard|workers)\b/)
   expect(matching[0].env?.PLAYWRIGHT_BASE_URL).toBe('http://127.0.0.1:'+port)
  }
  expect(steps.filter(step=>step.run==='npm run test:e2e:captain-week')).toHaveLength(1)
  expect(steps.filter(step=>step.run?.includes('node mobile/scripts/app-lock-ui-smoke.mjs'))).toHaveLength(1)
 })

 it('prepares each fresh runner and bundles styles before its isolated league or tournament checks',()=>{
  for(const lane of lanes){
   const job=jobs[lane]
   expect(job['runs-on']).toBe('ubuntu-24.04')
   expect(job.needs).toBeUndefined();expect(job.if).toBeUndefined()
   expect(job['continue-on-error']).toBeUndefined()
   expect(job['timeout-minutes']).toBeLessThanOrEqual(30)
   expect(job.steps.some(step=>step.run==='npm ci')).toBe(true)
   expect(job.steps.some(step=>step.run==='npx playwright install --with-deps chromium webkit')).toBe(true)
   expect(job.steps.find(step=>step.uses==='actions/setup-node@v6')?.with).toMatchObject({'node-version':22,cache:'npm'})
   expect(JSON.stringify(job)).not.toContain('secrets.')
   for(const step of job.steps)expect(step['continue-on-error']).toBeUndefined()
  }
  for(const lane of ['native-league-browser','native-tournament-browser']){
   const job=jobs[lane],build=job.steps.findIndex(step=>step.run==='npm run build:bundled --prefix mobile'),test=job.steps.findIndex(step=>step.run?.includes('npx playwright test '))
   expect(build).toBeGreaterThan(-1);expect(test).toBeGreaterThan(build)
   expect(job['timeout-minutes']).toBe(20)
  }
 })

 it('retains the existing diagnostic images and bounded retention on failure',()=>{
  const paths=['tournaments-results/**/tournaments-*.png','competitions-results/**/competitions-*.png','import-corrections-results/**/import-corrections-*.png','native-insights-results/**/native-insights-*.png','lab-scoreboard-results/**/lab-scoreboard-*.png','chat-experience-results/**/chat-experience-*.png','chat-poll-results/**/chat-poll-*.png','playwright-results/**/apple-membership-*.png','playwright-results/**/google-membership-*.png','captain-workspace-results/**/*.png']
  for(const path of paths){
   const matching=steps.filter(step=>step.uses==='actions/upload-artifact@v6'&&step.with?.path==='.next/'+path)
   expect(matching,path).toHaveLength(1)
   expect(matching[0].if).toBe('always()')
   expect(matching[0].with).toMatchObject({'retention-days':3,'if-no-files-found':'ignore'})
  }
 })

 it('keeps Verify and Schema Audit as real checks with their established entry points',()=>{
  for(const key of ['verify','tiq-schema-audit']){
   expect(jobs[key].if).toBeUndefined();expect(jobs[key]['continue-on-error']).toBeUndefined()
   for(const step of jobs[key].steps)expect(step['continue-on-error']).toBeUndefined()
  }
  expect(jobs.verify.steps.some(step=>step.run==='npm run verify')).toBe(true)
  expect(jobs['tiq-schema-audit'].steps.some(step=>step.run==='npm run db:audit:tiq')).toBe(true)
 })
})
