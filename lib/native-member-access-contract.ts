import {nativeInviteToken} from './native-team-invite-contract'
export type ChatMemberReview={id:string;name:string;publicId:string;role:string;state:'connected'|'removed'|'not_joined';canRemove:boolean;canRestore:boolean;reason:string;expected:Record<string,unknown>}
export type MemberAccessIntent={action:'remove'|'restore';targetId:string;operationId:string;expected:Record<string,unknown>}
export const memberUuid=(value:unknown)=>typeof value==='string'&&nativeInviteToken(value)===value&&value.length===36
export function memberReview(value:unknown):ChatMemberReview{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Member review unavailable.')
 const r=value as Record<string,unknown>
 for(const [key,max] of [['name',120],['publicId',40],['role',20],['reason',240]] as const)if(typeof r[key]!=='string'||r[key].length>max)throw Error('Member review unavailable.')
 if(!memberUuid(r.id)||!['connected','removed','not_joined'].includes(String(r.state))||!['Player','Captain','Co-captain','Administrator'].includes(String(r.role))||typeof r.canRemove!=='boolean'||typeof r.canRestore!=='boolean'||!r.expected||typeof r.expected!=='object'||Array.isArray(r.expected)||JSON.stringify(r.expected).length>1800)throw Error('Member review unavailable.')
 if(r.canRemove&&(r.state!=='connected'||r.role!=='Player')||r.canRestore&&(r.state!=='removed'||r.role!=='Player')||r.canRemove&&r.canRestore)throw Error('Member access mismatch.')
 const expected=r.expected as Record<string,unknown>;if(expected.name!==r.name||expected.publicId!==r.publicId)throw Error('Member identity changed.')
 return {id:String(r.id),name:String(r.name),publicId:String(r.publicId),role:String(r.role),state:r.state as ChatMemberReview['state'],canRemove:r.canRemove,canRestore:r.canRestore,reason:String(r.reason),expected}
}
