import {nativeInviteToken} from './native-team-invite-contract'
export type CaptainInvite={id:string;token:string;expiresAt:string;revokedAt:string|null;acceptedCount:number;active:boolean}
export function captainInvite(value:unknown):CaptainInvite{
 const r=value as CaptainInvite|null
 if(!r || nativeInviteToken(r.id)!==r.id || nativeInviteToken(r.token)!==r.token || typeof r.expiresAt!=='string' || !Number.isFinite(Date.parse(r.expiresAt)) || !(r.revokedAt===null || typeof r.revokedAt==='string' && Number.isFinite(Date.parse(r.revokedAt))) || !Number.isSafeInteger(r.acceptedCount) || r.acceptedCount<0 || typeof r.active!=='boolean' || r.active && r.revokedAt!==null)throw Error('Invite receipt unavailable.')
 return {id:r.id,token:r.token,expiresAt:r.expiresAt,revokedAt:r.revokedAt,acceptedCount:r.acceptedCount,active:r.active}
}
export const captainInviteUrl=(invite:CaptainInvite)=>'https://www.tenaceiq.com/team-room/join?token='+encodeURIComponent(invite.token)
