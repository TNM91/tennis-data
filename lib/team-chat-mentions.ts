/** Explicit person tags. Plain @text is never treated as a trusted mention. */
export type ChatMention={profileId:string;label:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export function hasMentionText(body:string,label:string){
 const token='@'+label
 let at=body.indexOf(token)
 while(at>=0){const before=body[at-1],after=body[at+token.length];if((!before||/[\s([{]/u.test(before))&&(!after||/[\s.,!?;:)\]}]/u.test(after)))return true;at=body.indexOf(token,at+1)}
 return false
}
export function readChatMentions(value:unknown,body:string):ChatMention[]{
 if(!Array.isArray(value)||value.length>5)return []
 const seen=new Set<string>(),result:ChatMention[]=[]
 for(const item of value){
  if(!item||typeof item!=='object')return []
  const {profileId,label}=item as ChatMention
  if(typeof profileId!=='string'||!uuid.test(profileId)||seen.has(profileId)||typeof label!=='string'||!label.trim()||label!==label.trim()||label.length>120||/[\u0000-\u001f\u007f]/u.test(label))return []
  seen.add(profileId);if(hasMentionText(body,label))result.push({profileId,label})
 }
 return result.sort((a,b)=>a.profileId.localeCompare(b.profileId))
}
/** Members must come from the server's accepted exact-team participant sync. */
export function validateChatMentions(value:unknown,body:string,owner:string,members:{id:string;name:string}[]){
 if(value===undefined)return []
 if(!Array.isArray(value)||value.length>5)return null
 const parsed=readChatMentions(value,body)
 if(parsed.length!==value.length||parsed.some(tag=>tag.profileId===owner||!members.some(member=>member.id===tag.profileId&&member.name===tag.label)))return null
 return parsed
}

/** Do not ask a player to distinguish two identical visible names using private IDs. */
export function distinctMentionMembers<T extends {id?:string;name:string}>(members:T[]){
 const key=(name:string)=>name.normalize('NFKC').trim().toLocaleLowerCase(),counts=new Map<string,number>()
 for(const member of members)counts.set(key(member.name),(counts.get(key(member.name))||0)+1)
 return members.filter(member=>counts.get(key(member.name))===1&&readChatMentions([{profileId:member.id,label:member.name}],`@${member.name}`).length===1)
}
