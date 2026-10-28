import type {ErasureJob} from './account-erasure'
const version='2026-04-22.dahlia'
type Subscription={id:string;customer:string|{id?:string};status:string;metadata?:Record<string,string>}
export async function eraseAccountBilling(job:Pick<ErasureJob,'id'|'account_id'|'stripe_customer_id'|'stripe_subscription_id'>,key:string,send:typeof fetch=fetch,deadline=Date.now()+30000){
 const customer=job.stripe_customer_id,subscription=job.stripe_subscription_id
 if(!customer&&!subscription)return true
 if(!key||!customer||!/^cus_[A-Za-z0-9]+$/.test(customer))throw Error('billing')
 const request=async(path:string,method='GET')=>{
  const remaining=deadline-Date.now();if(remaining<250)throw Error('billing')
  const response=await send('https://api.stripe.com/v1/'+path,{method,headers:{Authorization:'Bearer '+key,'Stripe-Version':version,...(method==='DELETE'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(method==='DELETE'?{body:new URLSearchParams(path.startsWith('subscriptions/')?{invoice_now:'false',prorate:'false'}:{})}:{}),redirect:'error',signal:AbortSignal.timeout(Math.min(8000,remaining))})
  const data=await response.json().catch(()=>null)
  if(!response.ok)throw Error('billing')
  return data
 }
 const identity=await request('customers/'+customer)
 if(identity?.id!==customer||identity.metadata?.user_id&&identity.metadata.user_id!==job.account_id)throw Error('billing')
 if(identity.deleted===true)return true
 const subscriptions:Subscription[]=[]
 let after=''
 for(let page=0;page<5;page++){
  const data=await request('subscriptions?customer='+customer+'&status=all&limit=100'+(after?'&starting_after='+after:''))
  if(!Array.isArray(data?.data)||data.data.length>100)throw Error('billing')
  subscriptions.push(...data.data)
  if(data.has_more!==true)break
  if(page===4||!/^sub_[A-Za-z0-9]+$/.test(data.data.at(-1)?.id||''))throw Error('billing')
  after=data.data.at(-1).id
 }
 // Inspect every subscription before canceling any. Never match a customer by email.
 for(const row of subscriptions)if(!/^sub_[A-Za-z0-9]+$/.test(row.id)||(typeof row.customer==='string'?row.customer:row.customer?.id)!==customer||row.metadata?.user_id!==job.account_id)throw Error('billing')
 if(!subscriptions.length&&identity.metadata?.user_id!==job.account_id)throw Error('billing')
 if(subscription&&!subscriptions.some(row=>row.id===subscription))throw Error('billing')
 const active=subscriptions.filter(row=>!['canceled','incomplete_expired'].includes(row.status))
 // Bounded and resumable: subsequent runs see these subscriptions already canceled.
 for(const row of active.slice(0,3)){
  const canceled=await request('subscriptions/'+row.id,'DELETE')
  if(canceled?.id!==row.id||canceled.status!=='canceled')throw Error('billing')
 }
 if(active.length>3)return false
 const removed=await request('customers/'+customer,'DELETE')
 if(removed?.id!==customer||removed.deleted!==true)throw Error('billing')
 return true
}
