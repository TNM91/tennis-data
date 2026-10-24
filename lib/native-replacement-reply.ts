import type {SupabaseClient} from '@supabase/supabase-js'
import {createHash} from 'node:crypto'
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
const key=(value:unknown)=>typeof value==='string'?value.trim().replace(/\s+/g,' ').toLowerCase():''
/** Bind a reply to the exact shared court plan and replacement request the player saw. */
export function replacementReplyToken(messageId:string,metadata:unknown){return createHash('sha256').update(JSON.stringify([messageId,metadata])).digest('hex')}
export function replacementReplyIsCurrent(input:{messageId:string;metadata:unknown;token:unknown;linkedPlayerName:unknown}){
 const card=record(input.metadata),notice=record(card.lineupChangeNotice)
 const court=Array.isArray(card.lineup)?card.lineup.map(record).find(c=>key(c.label)===key(notice.courtLabel)):undefined
 const players=court&&Array.isArray(court.players)?court.players.map(key):[]
 const after=Array.isArray(notice.afterPlayers)?notice.afterPlayers.map(key):[]
 const currentCourt=!!court&&!court.defaulted&&players.length>0&&players.length<=2
  &&players.every(Boolean)&&new Set(players).size===players.length
  &&players.includes(key(notice.replacementPlayerName))&&JSON.stringify(players)===JSON.stringify(after)
 return currentCourt&& card.cardType==='projected_lineup'&&!card.matchCompletedAt&&notice.pending===false&&!notice.response
  &&!!key(input.linkedPlayerName)&&key(input.linkedPlayerName)===key(notice.replacementPlayerName)
  &&typeof input.token==='string'&&input.token===replacementReplyToken(input.messageId,input.metadata)
}

/** Claim the exact card before availability, acknowledgment, reminders or alerts are changed. */
export async function saveReplacementCard(service:SupabaseClient,roomId:string,messageId:string,previous:Record<string,unknown>,metadata:Record<string,unknown>,at:string){
 const result=await service.from('internal_messages').update({metadata,edited_at:at})
  .eq('id',messageId).eq('conversation_id',roomId).is('deleted_at',null)
  .filter('metadata','eq',JSON.stringify(previous)).select('id').maybeSingle()
 return result.error?'unconfirmed':result.data?'saved':'changed'
}

export function replacementReplyReplayed(metadata:Record<string,unknown>,actor:string,response:string,token:unknown){
 const receipt=record(metadata.nativeReplacementReply),notice=record(metadata.lineupChangeNotice)
 return typeof token==='string'&&receipt.token===token&&receipt.actor===actor&&receipt.response===response
  &&notice.responderProfileId===actor&&notice.response===response&&notice.pending===false
  &&receipt.lineupVersion===metadata.lineupVersion&&JSON.stringify(receipt.lineup)===JSON.stringify(metadata.lineup)
}
