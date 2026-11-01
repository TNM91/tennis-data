// Match the original string so Unicode case folding cannot move highlight offsets.
export function messageSearchRanges(body:string,query:string):{start:number;end:number}[]{
 const term=query.trim().slice(0,120)
 if(!term)return []
 const literal=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
 return Array.from(body.matchAll(new RegExp(literal,'giu')),hit=>({start:hit.index!,end:hit.index!+hit[0].length}))
}
