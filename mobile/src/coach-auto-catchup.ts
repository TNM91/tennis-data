/** Coalesce known activity; never poll, overlap loads or retry the same activity. */
export function createCoachAutoCatchup(eligible:()=>boolean,refresh:()=>Promise<void>){
 let disposed=false,running=false,pending:string|null=null,attempted:string|null=null,lastStart=-Infinity
 let timer:ReturnType<typeof setTimeout>|null=null
 const cancel=()=>{if(timer!==null)clearTimeout(timer);timer=null}
 const pump=()=>{
  if(disposed||running||pending===null||!eligible()){cancel();return}
  if(timer!==null)return
  timer=setTimeout(()=>{
   timer=null
   if(disposed||running||pending===null||!eligible())return
   attempted=pending;pending=null;running=true;lastStart=Date.now()
   // The view owns error/recovery copy. A failed activity is not retried here.
   void Promise.resolve().then(refresh).catch(()=>{}).finally(()=>{running=false;pump()})
  },Math.max(250,2000-(Date.now()-lastStart)))
 }
 return {
  signal(key:string|null){
   if(disposed)return
   if(key===null){pending=null;cancel();return}
   if(key!==attempted)pending=key
   pump()
  },
  started(key:string){attempted=key;if(pending===key)pending=null;lastStart=Date.now();cancel()},
  dispose(){disposed=true;pending=null;cancel()},
 }
}
