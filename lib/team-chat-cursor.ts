/** A strict tuple cursor preserves PostgreSQL microseconds and deterministic UUID ties. */
export function readTeamChatCursor(value:unknown):{createdAt:string;id:string}|null {
 if(typeof value!=='string' || value.length>100)return null
 const parts=value.split('|');if(parts.length!==2)return null
 const [createdAt,id]=parts
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(createdAt) || !Number.isFinite(Date.parse(createdAt)) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return null
 return {createdAt,id}
}
export function teamChatCursor(createdAt:string,id:string){const value=`${createdAt}|${id}`;return readTeamChatCursor(value)?value:''}
