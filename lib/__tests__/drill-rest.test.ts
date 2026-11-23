import {describe,it,expect} from 'vitest'
import {RestCountdown,REST_DURATIONS,restCountdownHtml,restTabHtml,type RestSnapshot} from '../../mobile/src/drill-rest'

describe('Optional on-court rest countdown',()=>{
 it('waits for an explicit start and uses a sixty-second default',()=>{
  let now=1000;const rest=new RestCountdown(()=>now);now+=90000
  expect(rest.snapshot()).toEqual({duration:60,remaining:60,phase:'idle'})
  rest.pause();expect(rest.snapshot().phase).toBe('idle')
 })
 it('keeps fractional time through pauses and resumes without counting time away',()=>{
  let now=0;const rest=new RestCountdown(()=>now);rest.start();now=12500;rest.pause()
  expect(rest.snapshot()).toEqual({duration:60,remaining:48,phase:'paused'})
  now=200000;expect(rest.snapshot().remaining).toBe(48);rest.start();now+=47500
  expect(rest.snapshot()).toEqual({duration:60,remaining:0,phase:'complete'})
 })
 it('does not restart an already running countdown on repeated start calls',()=>{
  let now=0;const rest=new RestCountdown(()=>now);rest.start();now=10000;rest.start();now=15000
  expect(rest.snapshot()).toEqual({duration:60,remaining:45,phase:'running'})
 })
 it('stops at zero and never starts another rest automatically',()=>{
  let now=0;const rest=new RestCountdown(()=>now);rest.start();now=90000
  expect(rest.snapshot()).toEqual({duration:60,remaining:0,phase:'complete'})
  rest.start();rest.pause();now+=100000;expect(rest.snapshot().phase).toBe('complete')
  rest.reset();expect(rest.snapshot()).toEqual({duration:60,remaining:60,phase:'idle'})
 })
 it('accepts the offered durations and rejects invalid values without losing progress',()=>{
  let now=0;const rest=new RestCountdown(()=>now)
  for(const seconds of REST_DURATIONS){expect(rest.setDuration(seconds)).toBe(true);expect(rest.snapshot()).toEqual({duration:seconds,remaining:seconds,phase:'idle'})}
  rest.start();now=5000;const before=rest.snapshot()
  for(const invalid of [0,-1,31,60.5,121,NaN,Infinity]){expect(rest.setDuration(invalid)).toBe(false);expect(rest.snapshot()).toEqual(before)}
 })
 it('resets to the selected duration without resuming',()=>{
  let now=0;const rest=new RestCountdown(()=>now);rest.setDuration(90);rest.start();now=12000;rest.pause();rest.reset()
  expect(rest.snapshot()).toEqual({duration:90,remaining:90,phase:'idle'})
 })
 it('does not add time when the device clock moves backwards',()=>{
  let now=10000;const rest=new RestCountdown(()=>now);rest.start();now=20000;expect(rest.snapshot().remaining).toBe(50)
  now=15000;expect(rest.snapshot().remaining).toBe(50);now=25000;expect(rest.snapshot().remaining).toBe(45)
 })
 it('offers read-only timer output and explicit button actions without a submit control',()=>{
  const view=restCountdownHtml(new RestCountdown().snapshot())
  expect(view).toContain('role="timer" aria-label="Rest remaining" aria-live="off"')
  expect(view).not.toContain('role="status"')
  expect(restTabHtml(new RestCountdown().snapshot())).toContain('data-rest-live-state role="status" aria-live="polite"')
  expect(view).toContain('Pauses when you leave the app.')
  expect(view.match(/<option /g)).toHaveLength(5)
  expect(view).not.toMatch(/type="submit"|autofocus|name="(?:rating|note|context|drill-round)/)
 })
 it('requires an explicit restart after completion and locks controls for a frozen session',()=>{
  const finished={duration:45,remaining:0,phase:'complete' as const},view=restCountdownHtml(finished,true)
  expect(view).toContain('Start rest again');expect(view).toContain('Rest finished')
  expect(view).toMatch(/data-rest-duration[^>]*disabled/)
  expect(view).toMatch(/data-rest-action="toggle"[^>]*disabled/)
  expect(view).toMatch(/data-rest-action="reset"[^>]*disabled/)
 })
 it('keeps the Rest tab name stable and exposes each state outside the hidden pane',()=>{
  const notices={idle:'Optional rest countdown.',running:'Rest countdown running.',paused:'Rest countdown paused.',complete:'Rest finished.'}
  for(const phase of ['idle','running','paused','complete'] as const){
   const state:RestSnapshot={duration:60,remaining:phase==='complete'?0:45,phase},view=restTabHtml(state)
   expect(view).toContain('aria-describedby="training-rest-status"');expect(view).toContain('aria-pressed="false">Rest<span')
   expect(view).toContain('data-rest-phase="'+phase+'" aria-hidden="true"');expect(view).toContain(notices[phase])
   expect(view).toContain('id="training-rest-status"');expect(view).toContain('aria-live="polite" aria-atomic="true"')
   expect(view.includes('<svg')).toBe(phase!=='idle');expect(view).not.toMatch(/type="submit"|autofocus/)
   expect(state).toEqual({duration:60,remaining:phase==='complete'?0:45,phase})
  }
 })
 it('offers the manual round shortcut only when rest has finished',()=>{
  const shortcut={index:1,label:'Open round 2'}
  for(const phase of ['idle','running','paused'] as const)expect(restCountdownHtml({duration:60,remaining:30,phase},false,shortcut)).toMatch(/data-rest-round[^>]*hidden/)
  const view=restCountdownHtml({duration:60,remaining:0,phase:'complete'},false,shortcut)
  expect(view).toContain('>Open round 2</button>');expect(view).not.toMatch(/data-rest-round[^>]*hidden/)
  expect(view).toMatch(/class="secondary" data-rest-action="toggle"/)
  expect(view).not.toContain('type="submit"')
  expect(restCountdownHtml({duration:60,remaining:0,phase:'complete'})).toMatch(/data-rest-round[^>]*hidden/)
 })
 it('escapes the shortcut label and locks it with an unconfirmed session',()=>{
  const view=restCountdownHtml({duration:60,remaining:0,phase:'complete'},true,{index:1,label:'<Round & 2>'})
  expect(view).toContain('&lt;Round &amp; 2&gt;');expect(view).not.toContain('<Round')
  expect(view).toMatch(/data-rest-round[^>]*disabled/)
 })
 it('marks the drill rest without replacing a manually selected longer duration',()=>{
  const view=restCountdownHtml({duration:90,remaining:90,phase:'idle'},false,null,{seconds:45,guidance:'30–45 seconds between rounds.'})
  expect(view).toContain('Drill rest: 30–45 seconds between rounds.')
  expect(view).toMatch(/value="45"[^>]*>45 sec · Drill rest<\/option>/)
  expect(view).toMatch(/value="90" selected>90 sec<\/option>/)
  expect(view).not.toMatch(/value="45" selected/)
 })
 it('only offers durations at or above the conditioning minimum and retains save locks',()=>{
  const view=restCountdownHtml({duration:60,remaining:60,phase:'idle'},true,null,{seconds:60,minimumSeconds:60,guidance:'At least 60 seconds between rounds.'})
  expect(view.match(/<option /g)).toHaveLength(3);expect(view).not.toMatch(/value="(?:30|45)"/)
  expect(view).toContain('value="60" selected>60 sec · Drill rest')
  expect(view).toMatch(/data-rest-duration[^>]*disabled/);expect(view).toContain('Take longer if needed.')
 })
 it('escapes rest guidance and does not invent a plan for a generic countdown',()=>{
  const view=restCountdownHtml({duration:30,remaining:30,phase:'idle'},false,null,{seconds:30,guidance:'<Rest & reset>'})
  expect(view).toContain('&lt;Rest &amp; reset&gt;');expect(view).not.toContain('<Rest')
  expect(restCountdownHtml(new RestCountdown().snapshot())).not.toContain('Drill rest:')
 })
})
