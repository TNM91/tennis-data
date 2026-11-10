export class TrainingClock {
 private total = 0
 private started: number | null = null

 constructor(private now: () => number = () => Date.now()) {}

 reset() {
  this.total = 0
  this.started = null
 }

 start() {
  if(this.started === null)this.started = this.now()
 }

 pause() {
  if(this.started === null)return
  this.total = this.seconds()
  this.started = null
 }

 seconds() {
  const elapsed = this.started === null ? 0 : Math.max(0,this.now()-this.started)/1000
  return Math.min(7200,Math.floor(this.total+elapsed))
 }

 running() {
  return this.started !== null
 }
}

export function trainingTime(seconds: number) {
 return `${Math.floor(seconds/60)}m ${seconds%60}s`
}
