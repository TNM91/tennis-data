import {expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
import {googleNotificationEnvelope} from '../google-notification-envelope'

const subscription='projects/tenaceiq-test/subscriptions/google-pro',token='synthetic-google-token-notification-1'
const event={version:'1.0',packageName:'com.tenaceiq.app',eventTimeMillis:String(Date.now()),subscriptionNotification:{version:'1.0',notificationType:2,purchaseToken:token}}
const envelope=(data:unknown=event)=>({subscription,message:{messageId:'123456789',data:Buffer.from(JSON.stringify(data)).toString('base64')}})
it('parses subscription changes, hashes private identifiers and accepts delayed events without trusting their order',()=>{
 const value=googleNotificationEnvelope(envelope(),subscription)
 expect(value).toMatchObject({kind:'pro',purchaseToken:token,tokenHash:expect.stringMatching(/^[a-f0-9]{64}$/),messageHash:expect.stringMatching(/^[a-f0-9]{64}$/)})
 expect(googleNotificationEnvelope({...envelope(),message:{...envelope().message,messageId:'opaque:message/id-1'}},subscription)?.kind).toBe('pro')
 expect(googleNotificationEnvelope(envelope({...event,eventTimeMillis:'1503349566168'}),subscription)?.kind).toBe('pro')
 expect(googleNotificationEnvelope(envelope({...event,subscriptionNotification:{...event.subscriptionNotification,notificationType:99}}),subscription)?.kind).toBe('pro')
})
it.each([
 {packageName:'com.tenaceiq.app.dev'},{version:'2.0'},{eventTimeMillis:String(Date.now()+600000)},{eventTimeMillis:'NaN'},{eventTimeMillis:'0'},
 {testNotification:{version:'1.0'}},{subscriptionNotification:{version:'1.0',notificationType:'2',purchaseToken:token}},
 {subscriptionNotification:{version:'1.0',notificationType:2,purchaseToken:'short'}},{subscriptionNotification:null},
])('rejects malformed or ambiguous event %j',patch=>expect(googleNotificationEnvelope(envelope({...event,...patch}),subscription)).toBeNull())
it('rejects foreign subscriptions, malformed UTF-8/base64, wrong message IDs and overlong data',()=>{
 for(const value of [{...envelope(),subscription:subscription+'-other'},{...envelope(),message:{...envelope().message,messageId:''}},{...envelope(),message:{messageId:'1',data:'@@=='}},{...envelope(),message:{messageId:'1',data:Buffer.from([255,255]).toString('base64')}},{...envelope(),message:{messageId:'1',data:'A'.repeat(16004)}},null])expect(googleNotificationEnvelope(value,subscription)).toBeNull()
})
it('handles test and subscription-void events, and excludes one-time and refund-review workflows',()=>{
 const base={version:'1.0',packageName:'com.tenaceiq.app',eventTimeMillis:String(Date.now())}
 expect(googleNotificationEnvelope(envelope({...base,testNotification:{version:'1.0'}}),subscription)).toEqual({kind:'test'})
 expect(googleNotificationEnvelope(envelope({...base,voidedPurchaseNotification:{purchaseToken:token,productType:1,refundType:1}}),subscription)?.kind).toBe('pro')
 expect(googleNotificationEnvelope(envelope({...base,voidedPurchaseNotification:{purchaseToken:token,productType:2,refundType:1}}),subscription)).toEqual({kind:'ignored'})
 for(const field of ['oneTimeProductNotification','pendingRefundReviewNotification'])expect(googleNotificationEnvelope(envelope({...base,[field]:{version:'1.0'}}),subscription)).toEqual({kind:'ignored'})
})
