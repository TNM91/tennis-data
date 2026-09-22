'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { safeVenueSource, venueLocation, type VenuePreference } from '@/lib/venue-directory'
import styles from '@/app/components/team-season-calendar.module.css'

export default function VenueReviewPage() {
  return <SiteShell active="/admin"><AdminGate><VenueReviews /></AdminGate></SiteShell>
}
function VenueReviews() {
  const {session} = useAuth()
  const token=session?.access_token || ''
  const [items,setItems]=useState<VenuePreference[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    if(!token)return
    setLoading(true);setError('')
    try{
      const response=await fetch('/api/admin/venue-locations',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(30000)})
      const result=await response.json()
      if(!response.ok)throw Error(result.message)
      setItems(result.items)
    }catch(cause){setError(cause instanceof Error?cause.message:'Venue reviews could not be loaded.')}
    finally{setLoading(false)}
  },[token])
  useEffect(()=>{void load()},[load])
  return <section className={styles.card} aria-label="Venue address reviews">
    <Link className={styles.textLink} href="/admin">Back to Admin</Link><h1>Venue addresses</h1>
    <p>Check submitted public playing locations against an official venue or TennisLink source. Approval makes the address reusable for other teams in the same city and state.</p>
    <div className={styles.options}>
      <button type="button" className={styles.secondary} onClick={()=>void load()} disabled={loading}>Refresh reviews</button>
      {loading?<p role="status">Loading venue reviews…</p>:null}
      {error?<p role="alert">{error}</p>:null}
      {!loading && !error && !items.length?<p>No venue addresses need review.</p>:null}
      {items.map(item=><VenueReview key={`${item.id}:${item.updated_at}`} item={item} token={token} onReviewed={()=>setItems(current=>current.filter(row=>row.id!==item.id))} />)}
      {items.length===100?<p>Showing the oldest 100. Refresh after reviewing to load more.</p>:null}
    </div>
  </section>
}
function VenueReview({item,token,onReviewed}:{item:VenuePreference;token:string;onReviewed:()=>void}) {
  const [source,setSource]=useState(item.source_url)
  const [verified,setVerified]=useState(false)
  const [working,setWorking]=useState(false)
  const [error,setError]=useState('')
  async function review(approve:boolean) {
    if(working)return
    setWorking(true);setError('')
    try{
      const response=await fetch('/api/admin/venue-locations',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify({id:item.id,updatedAt:item.updated_at,approve,verified,sourceUrl:source})})
      const result=await response.json()
      if(!response.ok)throw Error(result.message)
      onReviewed()
    }catch(cause){setError(cause instanceof Error?cause.message:'Review could not be saved.')}
    finally{setWorking(false)}
  }
  return <article className={styles.venue}>
    <h2>{item.facility_name}</h2><p>{venueLocation(item)}</p>
    <a className={styles.textLink} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueLocation(item))}`} target="_blank" rel="noopener noreferrer">Check playing location in Maps ↗</a>
    <div className={styles.venueForm}>
      <label>Official source URL<input type="url" value={source} onChange={event=>{setSource(event.target.value);setVerified(false)}} /></label>
      {safeVenueSource(source)?<a className={styles.textLink} href={safeVenueSource(source)} target="_blank" rel="noopener noreferrer">Open source ↗</a>:null}
      <label className={styles.matchChoice}><input type="checkbox" checked={verified} onChange={event=>setVerified(event.target.checked)} /><span>I verified the street, city, and state against the official source above.</span></label>
      {error?<p role="alert">{error}</p>:null}
      <button type="button" className={styles.primary} disabled={working || !verified || !safeVenueSource(source)} onClick={()=>void review(true)}>Approve shared address</button>
      <button type="button" className={styles.secondary} disabled={working} onClick={()=>void review(false)}>Do not share this address</button>
    </div>
  </article>
}
