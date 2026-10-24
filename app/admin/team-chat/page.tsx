'use client'
import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import {useAuth} from '@/app/components/auth-provider'
import styles from '@/app/components/team-season-calendar.module.css'
type Report={id:string;message_id:string;conversation_id:string;reason:string;message_body:string;created_at:string}
export default function ChatModerationPage(){
 return <SiteShell active="/admin"><AdminGate><ChatReportsAccount /></AdminGate></SiteShell>
}
function ChatReportsAccount(){
 const {session}=useAuth()
 return <ChatReports key={session?.user.id || 'signed-out'} token={session?.access_token || ''}/>
}
function ChatReports({token}:{token:string}){
 const [reports,setReports]=useState<Report[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(true),[refresh,setRefresh]=useState(0)
 const generation=useRef(0)
 useEffect(()=>{
  const current=++generation.current,controller=new AbortController()
  if(!token)return()=>controller.abort()
  setBusy(true);setError('')
  void (async()=>{
   try{
    const response=await fetch('/api/admin/team-chat',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal})
    const result=await response.json()
    if(!response.ok || !result.ok)throw Error('Chat reports could not be loaded.')
    if(generation.current===current && !controller.signal.aborted)setReports(result.reports)
   }catch{if(!controller.signal.aborted && generation.current===current){setReports([]);setError('Chat reports could not be loaded.')}}
   finally{if(!controller.signal.aborted && generation.current===current)setBusy(false)}
  })()
  return()=>controller.abort()
 },[token,refresh])
 async function review(id:string,action:'resolve'|'remove'){
  if(busy)return
  const current=++generation.current
  setBusy(true);setError('')
  try{
   const response=await fetch('/api/admin/team-chat',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id,action}),signal:AbortSignal.timeout(20000)})
   if(!response.ok)throw Error('Review not confirmed.')
   if(generation.current===current)setReports(items=>items.filter(item=>item.id!==id))
  }catch{if(generation.current===current)setError('Couldn’t confirm the review. Refresh before trying again.')}
  finally{if(generation.current===current)setBusy(false)}
 }
 return <section className={styles.card} aria-label="Team chat moderation"><Link href="/admin">Back to Admin</Link><h1>Team chat reports</h1><p>Review private reports from connected team members. Removing a post hides its content from the team conversation.</p><button type="button" className={styles.secondary} disabled={busy} onClick={()=>setRefresh(value=>value+1)}>Refresh reports</button>{busy?<p role="status">Loading or saving reviews…</p>:null}{error?<p role="alert">{error}</p>:null}{!busy && !error && !reports.length?<p>No open chat reports.</p>:null}{reports.map(report=><article className={styles.venue} key={report.id}><h2>{report.reason}</h2><p>{new Date(report.created_at).toLocaleString()}</p><blockquote style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{report.message_body}</blockquote><p>Report ID: {report.id}</p><button type="button" className={styles.primary} disabled={busy} onClick={()=>void review(report.id,'remove')}>Remove post and resolve</button><button type="button" className={styles.secondary} disabled={busy} onClick={()=>void review(report.id,'resolve')}>Resolve without removing</button></article>)}{reports.length===50?<p>Showing the oldest 50 reports. Refresh after reviewing to load more.</p>:null}</section>
}

