export type CoachConnectionIntent={action:'preview';token:string}|{action:'accept';token:string;revision:string}
export type CoachConnection={owner:string;name:string;level:string;message:string;expiresAt:string|null;state:'ready'|'reserved'|'connected';revision:string}
const tokenPattern=/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/
export function coachInvitationToken(value:string){
 const input=value.trim();if(input.length>1024)throw Error('Invalid invitation link')
 if(tokenPattern.test(input))return input
 const url=new URL(input)
 if(!['https://www.tenaceiq.com','https://tenaceiq.com'].includes(url.origin)||url.username||url.password||url.search||url.hash)throw Error('Use your TenAceIQ invitation link')
 const match=url.pathname.match(/^\/coach\/invite\/([^/]+)\/?$/),token=match?decodeURIComponent(match[1]):''
 if(!tokenPattern.test(token))throw Error('Invalid invitation link')
 return token
}
export function readCoachConnectionIntent(value:unknown):CoachConnectionIntent{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid invitation')
 const r=value as Record<string,unknown>
 if(typeof r.token!=='string'||!tokenPattern.test(r.token)||!['preview','accept'].includes(String(r.action))||Object.keys(r).some(k=>!['action','token',...(r.action==='accept'?['revision']:[])].includes(k)))throw Error('Invalid invitation')
 if(r.action==='preview')return {action:'preview',token:r.token}
 if(typeof r.revision!=='string'||!/^([a-f0-9]{64})$/.test(r.revision))throw Error('Review this invitation again')
 return {action:'accept',token:r.token,revision:r.revision}
}
export function readCoachConnection(value:unknown,owner:string):CoachConnection{
 if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>12000)throw Error('Invalid connection response')
 const r=value as Record<string,unknown>
 const text=(value:unknown,max:number)=>{if(typeof value!=='string'||value.length>max)throw Error('Invalid invitation details');return value}
 if(r.ok!==true||r.owner!==owner||!owner||!['ready','reserved','connected'].includes(String(r.state)))throw Error('Invitation account changed')
 const revision=text(r.revision,64);if(!/^[a-f0-9]{64}$/.test(revision))throw Error('Invalid invitation revision')
 const expiresAt=r.expiresAt===null?null:text(r.expiresAt,80);if(expiresAt!==null&&!Number.isFinite(Date.parse(expiresAt)))throw Error('Invalid invitation expiry')
 const name=text(r.name,300);if(!name.trim())throw Error('Missing invited player')
 return {owner,name,level:text(r.level,160),message:text(r.message,2000),expiresAt,state:r.state as CoachConnection['state'],revision}
}
