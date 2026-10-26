import {useState,useSyncExternalStore} from 'react'
import type {RatingView} from '../../lib/player-rating-display'
export function createPlayerProfileFormat(){let view:RatingView='overall';const listeners=new Set<()=>void>();return {get:()=>view,set:(next:RatingView)=>{if(!['overall','singles','doubles'].includes(next)||next===view)return;view=next;listeners.forEach(fn=>fn())},subscribe:(fn:()=>void)=>{listeners.add(fn);return ()=>{listeners.delete(fn)}}}}
export type PlayerProfileFormat=ReturnType<typeof createPlayerProfileFormat>
const subscribe=()=>()=>{},snapshot=()=>'overall' as RatingView
export function usePlayerProfileFormat(store?:PlayerProfileFormat){const [local,setLocal]=useState<RatingView>('overall'),shared=useSyncExternalStore(store?.subscribe??subscribe,store?.get??snapshot,store?.get??snapshot);return [store?shared:local,store?store.set:setLocal] as const}
