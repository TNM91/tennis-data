import {describe,it,expect} from 'vitest'
import {RestCountdown,REST_DURATIONS,restCountdownHtml} from '../../mobile/src/drill-rest'

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
  expect(view).toContain('data-rest-state role="status" aria-live="polite"')
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
})
