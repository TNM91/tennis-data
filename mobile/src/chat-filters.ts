import type {TeamMessage} from './team-room-data'
export type ChatFilter='all'|'announcements'|'media'
export function chatMatches(message:TeamMessage,filter:ChatFilter,search:string){
 const query=search.trim().toLocaleLowerCase()
 if(message.deletedAt)return filter==='all'&&!query
 return (filter==='all'||filter==='announcements'&&message.kind==='announcement'||filter==='media'&&message.hasPhoto===true)&&(!query||(message.senderName+' '+message.body).toLocaleLowerCase().includes(query))
}
export function chatFilterStatus(filter:ChatFilter,count:number,total:number,search:string){
 if(filter==='all'&&!search.trim())return ''
 const label=filter==='announcements'?'announcements':filter==='media'?'photos or GIFs':'matches'
 return `${count} ${label} in these ${total} loaded messages. Earlier messages checks an older page.`
}
