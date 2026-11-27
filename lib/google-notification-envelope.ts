import 'server-only'
import {createHash} from 'node:crypto'
import {GOOGLE_PLAY_PACKAGE,googlePurchaseToken} from './google-play-products'

export type GoogleNotification={kind:'pro';purchaseToken:string;tokenHash:string;messageHash:string;fingerprint:string}|{kind:'test'|'ignored'}
const record=(v:unknown):Record<string,unknown>|null=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null
export function googleNotificationEnvelope(value:unknown,subscription:string,now=Date.now()):GoogleNotification|null {
 const body=record(value),message=record(body?.message),data=message?.data,id=message?.messageId
 if(body?.subscription!==subscription||typeof id!=='string'||!id.length||Buffer.byteLength(id)>256||typeof data!=='string'||data.length>16000||!data.length||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))return null
 try{
  const decoded=Buffer.from(data,'base64');if(decoded.toString('base64')!==data)return null
  const event=record(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decoded)))
  if(!event||event.version!=='1.0'||event.packageName!==GOOGLE_PLAY_PACKAGE||typeof event.eventTimeMillis!=='string'||!/^\d{1,16}$/.test(event.eventTimeMillis))return null
  const eventTime=Number(event.eventTimeMillis)
  if(!Number.isSafeInteger(eventTime)||eventTime<=0||eventTime>now+300000)return null
  const variants=['subscriptionNotification','voidedPurchaseNotification','oneTimeProductNotification','pendingRefundReviewNotification','testNotification'].filter(key=>event[key]!==undefined)
  if(variants.length!==1)return null
  const kind=variants[0],details=record(event[kind]);if(!details)return null
  if(kind==='testNotification')return details.version==='1.0'?{kind:'test'}:null
  if(kind==='oneTimeProductNotification'||kind==='pendingRefundReviewNotification')return {kind:'ignored'}
  if(kind==='subscriptionNotification'&&(details.version!=='1.0'||!Number.isSafeInteger(details.notificationType)||Number(details.notificationType)<1))return null
  if(kind==='voidedPurchaseNotification'){
   if(![1,2].includes(Number(details.productType))||typeof details.productType!=='number'||![1,2].includes(Number(details.refundType))||typeof details.refundType!=='number')return null
   if(details.productType===2)return {kind:'ignored'}
  }
  if(!googlePurchaseToken(details.purchaseToken))return null
  const hash=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex')
  return {kind:'pro',purchaseToken:details.purchaseToken,tokenHash:hash(details.purchaseToken),messageHash:hash(JSON.stringify([subscription,id])),fingerprint:hash(decoded)}
 }catch{return null}
}
