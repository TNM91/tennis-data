const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function nativeInviteToken(value:unknown):string{
 if(typeof value!=='string' || value.length>600)return ''
 const text=value.trim();if(uuid.test(text))return text.toLowerCase()
 try{const url=new URL(text);if(url.protocol!=='https:' || !['tenaceiq.com','www.tenaceiq.com'].includes(url.hostname) || url.port || url.username || url.password || url.hash || url.pathname!=='/team-room/join' || url.searchParams.getAll('token').length!==1)return '';const token=url.searchParams.get('token')||'';return uuid.test(token)?token.toLowerCase():''}catch{return ''}
}
export type InviteExpected={invite:Record<string,unknown>;linkVersion:string}
export type NativeInviteReview={teamName:string;leagueName:string;flight:string;roomId:string;expiresAt:string;alreadyJoined:boolean;expected:InviteExpected}
export function nativeInviteReview(value:unknown):NativeInviteReview{
 if(!value || typeof value!=='object')throw Error('Invite unavailable')
 const row=value as Record<string,unknown>,expected=row.expected as Record<string,unknown>
 for(const [key,max] of [['teamName',160],['leagueName',160],['flight',80],['roomId',36],['expiresAt',80],['linkVersion',80]] as const)if(typeof row[key]!=='string' || row[key].length>max)throw Error('Invite unavailable')
 if(!row.teamName || !row.leagueName || !uuid.test(String(row.roomId)) || !Number.isFinite(Date.parse(String(row.expiresAt))) || !expected || typeof expected!=='object' || Array.isArray(expected) || JSON.stringify(expected).length>1800 || typeof row.alreadyJoined!=='boolean')throw Error('Invite unavailable')
 for(const key of ['teamName','leagueName','flight','roomId','expiresAt'])if(expected[key]!==row[key])throw Error('Invite scope mismatch')
 if(!uuid.test(String(expected.inviteId)) || !uuid.test(String(expected.creatorId)))throw Error('Invite unavailable')
 return {teamName:String(row.teamName),leagueName:String(row.leagueName),flight:String(row.flight),roomId:String(row.roomId),expiresAt:String(row.expiresAt),alreadyJoined:row.alreadyJoined,expected:{invite:expected,linkVersion:String(row.linkVersion)}}
}
