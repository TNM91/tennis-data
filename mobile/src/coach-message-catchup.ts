import type {ChatUnread} from './chat-unread'

// A single memory-only projection of the already loaded, owner-scoped count response.
let summary:ChatUnread|null=null
const listeners=new Set<(value:ChatUnread|null)=>void>()
export function publishCoachMessageCounts(value:ChatUnread|null){summary=value;for(const listener of listeners)listener(value)}
export function watchCoachMessageCounts(owner:string,changed:(value:ChatUnread|null)=>void){
 const listener=(value:ChatUnread|null)=>changed(value?.owner===owner?value:null)
 listeners.add(listener);listener(summary)
 return ()=>{listeners.delete(listener)}
}

/** A refresh consumes only the activity known when that request began. */
export function createCoachMessageChangeTracker(){
 let student='',count:number|null=null,latest:string|null|undefined,waiting=false,version=0
 return {
  update(next:string,value:{unread:number;latest?:string|null}|undefined){
   if(next!==student){student=next;count=value?.unread??null;latest=value?.latest;waiting=false;version++;return}
   if(!value)return
   const changed=value.latest!==undefined&&latest!==undefined&&value.latest!==latest||count!==null&&value.unread>count
   if(changed){waiting=true;version++}
   if(value.latest===undefined&&value.unread===0)waiting=false
   count=value.unread;latest=value.latest
  },
  ticket:()=>version,
  loaded(ticket:number){if(ticket===version)waiting=false},
  waiting:()=>waiting,
 }
}
