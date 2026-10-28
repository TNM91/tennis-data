/** Shared poll limits and receipt validation. Poll choices never change after publication. */
export type TeamPoll={id:string;roomId:string;question:string;options:{label:string;count:number}[];total:number;mine:number|null;revision:number;closed:boolean;canClose:boolean}
export type PollCreate={action:'create'|'lookup';id:string;question:string;options:string[]}
export type PollAction=PollCreate|{action:'get';id:string}|{action:'vote';id:string;choice:number|null;expected:number}|{action:'close';id:string}
export const pollId=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v)
const line=(v:unknown,n:number):v is string=>typeof v==='string'&&v===v.trim()&&v.length>0&&v.length<=n&&!/[\u0000-\u001f\u007f]/.test(v)
export function pollFields(question:unknown,options:unknown):options is string[]{return line(question,180)&&Array.isArray(options)&&options.length>=2&&options.length<=6&&options.every(v=>line(v,80))&&new Set(options.map(v=>v.toLowerCase().replace(/\s+/g,' '))).size===options.length}
export function validPollAction(v:unknown):v is PollAction{
 if(!v||typeof v!=='object'||Array.isArray(v))return false
 const a=v as Record<string,unknown>;if(!pollId(a.id))return false
 if(a.action==='create'||a.action==='lookup')return pollFields(a.question,a.options)
 if(a.action==='get'||a.action==='close')return true
 return a.action==='vote'&&(a.choice===null||Number.isInteger(a.choice)&&Number(a.choice)>=0&&Number(a.choice)<6)&&Number.isInteger(a.expected)&&Number(a.expected)>=0&&Number(a.expected)<=1000000
}
export function parseTeamPoll(v:unknown,id:string,roomId:string):TeamPoll{
 const p=v as TeamPoll
 if(!p||p.id!==id||!pollId(p.id)||p.roomId!==roomId||!pollId(roomId)||!Array.isArray(p.options)||!pollFields(p.question,p.options.map(o=>o?.label))||p.options.some(o=>!o||!Number.isInteger(o.count)||o.count<0||o.count>250)||!Number.isInteger(p.total)||p.total<0||p.total>250||p.options.reduce((n,o)=>n+o.count,0)!==p.total||p.mine!==null&&(!Number.isInteger(p.mine)||p.mine<0||p.mine>=p.options.length)||!Number.isInteger(p.revision)||p.revision<0||p.revision>1000000||p.mine!==null&&(p.revision===0||p.options[p.mine].count<1)||typeof p.closed!=='boolean'||typeof p.canClose!=='boolean')throw Error('Poll unavailable. Refresh to check your team access.')
 return {id:p.id,roomId:p.roomId,question:p.question,options:p.options.map(o=>({label:o.label,count:o.count})),total:p.total,mine:p.mine,revision:p.revision,closed:p.closed,canClose:p.canClose}
}
