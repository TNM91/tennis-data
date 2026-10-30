import {lineupRecord} from './native-captain-lineup-contract'
export type TournamentEntryDraft={one:string;two:string;rating:number|null;partnerRating:number|null;attested:boolean;partnerAttested:boolean}
export type TournamentEntryReceipt={id:string;name:string;status:'pending'|'approved'|'declined';updatedAt:string;one:string;two:string;rating:number|null;partnerRating:number|null;note:string;legacy:boolean;inDraw:boolean}
export type TournamentEntryContext={owner:string;parent:string;division:string;name:string;eventName:string;paired:boolean;playerName:string;playerLocked:boolean;canManage:boolean;mode:'native'|'director'|'unsupported'|'closed';director:string;locked:boolean;canApprove:boolean;date:string;deadline:string;zone:string;revision:string}
export type TournamentEntrySnapshot={context:TournamentEntryContext;receipt:TournamentEntryReceipt|null;queue:TournamentEntryReceipt[];more:boolean;alreadySubmitted?:boolean}
const text=(v:unknown,max=240)=>{if(typeof v!=='string'||v.length>max)throw Error('Registration details changed. Refresh to try again.');return v}
const bool=(v:unknown)=>{if(typeof v!=='boolean')throw Error('Registration details changed.');return v}
const rating=(v:unknown)=>{if(v===null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<1||v>7||v*2%1)throw Error('Choose a self-rated level from 1.0 to 7.0 in half steps.');return v}
export function tournamentEntryId(v:unknown,empty=false){const s=text(v,80);if((!empty||s)&&!/^[a-zA-Z0-9_-]{1,80}$/.test(s))throw Error('Choose a tournament division.');return s}
export function tournamentEntryDraft(v:unknown):TournamentEntryDraft{
 const r=lineupRecord(v);if(Object.keys(r).some(k=>!['one','two','rating','partnerRating','attested','partnerAttested'].includes(k)))throw Error('Check your entry details.')
 const one=text(r.one,90).replace(/\s+/g,' ').trim(),two=text(r.two,90).replace(/\s+/g,' ').trim()
 if(!one||/[\u0000-\u001f\u007f/]/.test(one+two)||two&&one.toLowerCase()===two.toLowerCase())throw Error('Use two different player names.')
 return {one,two,rating:rating(r.rating),partnerRating:rating(r.partnerRating),attested:bool(r.attested),partnerAttested:bool(r.partnerAttested)}
}
export function tournamentEntryCanSend(c:TournamentEntryContext,d:TournamentEntryDraft){
 try{const p=tournamentEntryDraft(d);return c.mode==='native'&&p.rating!==null&&p.attested&&(!c.playerLocked||p.one===c.playerName)&&(c.paired?!!p.two&&p.partnerRating!==null&&p.partnerAttested:!p.two&&p.partnerRating===null&&!p.partnerAttested)}catch{return false}
}
export function readTournamentEntryReceipt(v:unknown):TournamentEntryReceipt{
 const r=lineupRecord(v),id=text(r.id,80),updatedAt=text(r.updatedAt,80)
 if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isFinite(Date.parse(updatedAt))||!['pending','approved','declined'].includes(String(r.status)))throw Error('Entry receipt unavailable.')
 return {id,name:text(r.name,200),status:r.status as TournamentEntryReceipt['status'],updatedAt,one:text(r.one,200),two:text(r.two,90),rating:rating(r.rating),partnerRating:rating(r.partnerRating),note:text(r.note,600),legacy:bool(r.legacy),inDraw:bool(r.inDraw)}
}
export function readTournamentEntrySnapshot(v:unknown,owner:string,parent:string,division:string,organizer=false):TournamentEntrySnapshot{
 const r=lineupRecord(v),c=lineupRecord(r.context)
 if(r.ok!==true||!owner||c.owner!==owner||c.parent!==parent||c.division!==division||!/^[a-f0-9]{32}$/.test(text(c.revision,32))||!['native','director','unsupported','closed'].includes(String(c.mode)))throw Error('Registration account or division changed.')
 const context:TournamentEntryContext={owner,parent,division,name:text(c.name),eventName:text(c.eventName),paired:bool(c.paired),playerName:text(c.playerName,90),playerLocked:bool(c.playerLocked),canManage:bool(c.canManage),mode:c.mode as TournamentEntryContext['mode'],director:text(c.director,254),locked:bool(c.locked),canApprove:bool(c.canApprove),date:text(c.date,40),deadline:text(c.deadline,40),zone:text(c.zone,100),revision:c.revision as string}
 if(!Array.isArray(r.queue)||r.queue.length>50||typeof r.more!=='boolean'||(!organizer&&(r.queue.length||r.more))||organizer&&!context.canManage)throw Error('Entry queue unavailable.')
 const queue=r.queue.map(readTournamentEntryReceipt)
 if(queue.some(x=>x.status!=='pending'||x.legacy)||new Set(queue.map(x=>x.id)).size!==queue.length)throw Error('Entry queue changed.')
 if(r.alreadySubmitted!==undefined&&typeof r.alreadySubmitted!=='boolean')throw Error('Entry confirmation unavailable.')
 return {context,receipt:r.receipt===null?null:readTournamentEntryReceipt(r.receipt),queue,more:r.more,...(r.alreadySubmitted!==undefined?{alreadySubmitted:r.alreadySubmitted}:{})}
}
export function tournamentEntryAction(v:unknown){const r=lineupRecord(v)
 if(Object.keys(r).some(k=>!['parent','division','action','data'].includes(k)))throw Error('Check the registration selection.')
 const parent=tournamentEntryId(r.parent,true),division=tournamentEntryId(r.division),data=lineupRecord(r.data)
 if(r.action!=='submit'&&r.action!=='decide')throw Error('Choose an entry action.')
 if(!/^[a-f0-9]{32}$/.test(text(data.revision,32)))throw Error('Refresh registration before continuing.')
 if(r.action==='submit'){
  const draft={...data};delete draft.revision
  return {parent,division,action:'submit' as const,data:{revision:data.revision,...tournamentEntryDraft(draft)}}
 }
 if(Object.keys(data).some(k=>!['revision','entryId','updatedAt','decision','note','confirmed'].includes(k))||!['approve','decline'].includes(String(data.decision))||!/^[a-f0-9-]{36}$/i.test(text(data.entryId,80))||!Number.isFinite(Date.parse(text(data.updatedAt,80))))throw Error('Refresh the saved request.')
 const note=text(data.note,600).trim();if(!note||/[\u0000-\u001f\u007f]/.test(note))throw Error('Add a short note to the player.')
 return {parent,division,action:'decide' as const,data:{revision:data.revision,entryId:data.entryId as string,updatedAt:data.updatedAt as string,decision:data.decision as 'approve'|'decline',note,confirmed:bool(data.confirmed)}}
}
