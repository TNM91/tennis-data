/** Preserve Postgres microseconds when comparing read checkpoints. */
export function chatTimestamp(value:string):bigint|null {
 const milliseconds=Date.parse(value)
 if(!Number.isFinite(milliseconds))return null
 const fraction=value.match(/\.(\d+)(?:Z|[+-]\d\d:\d\d)$/)?.[1] || ''
 return BigInt(milliseconds)*BigInt(1000)+BigInt((fraction+'000000').slice(3,6))
}
export function newerChatTime(left:string,right:string) {
 const l=chatTimestamp(left),r=chatTimestamp(right)
 return l!==null && (r===null || l>r)
}
