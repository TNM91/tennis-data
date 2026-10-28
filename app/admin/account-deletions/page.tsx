'use client'
import {useEffect,useRef,useState} from 'react'
import Link from 'next/link'
import SiteShell from '@/app/components/site-shell'
import AdminGate from '@/app/components/admin-gate'
import {useAuth} from '@/app/components/auth-provider'
import {supabase} from '@/lib/supabase'
import styles from './requests.module.css'
type RequestRow={id:string;status:string;phase:string;requested_at:string;due_at:string;attempts:number;next_attempt_at:string;last_error:string|null}
const phases:Record<string,string>={queued:'Queued',waiting:'Signing out devices',billing:'Ending web renewals',files:'Removing uploads',data:'Removing private data',auth:'Removing login',confirmation:'Sending completion email'}
function Queue({owner}:{owner:string}){
 const [rows,setRows]=useState<RequestRow[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),active=useRef(true),pending=useRef<AbortController|null>(null)
 useEffect(()=>{active.current=true;return()=>{active.current=false;pending.current?.abort()}},[])
 async function load(){
  if(busy)return;setBusy(true);setError('')
  try{
   const session=await supabase.auth.getSession();if(!active.current||session.error||session.data.session?.user.id!==owner)throw Error('Account visit closed.')
   const controller=new AbortController();pending.current=controller;const timeout=setTimeout(()=>controller.abort(),12000)
   try{
    const response=await fetch('/api/admin/account-deletions',{headers:{Authorization:'Bearer '+session.data.session.access_token},cache:'no-store',signal:controller.signal})
    const value=await response.json(),next=await supabase.auth.getSession()
    if(!active.current||next.data.session?.user.id!==owner)throw Error('Account visit closed.')
    if(!response.ok||value?.ok!==true||!Array.isArray(value.rows)||value.rows.length>25)throw Error('Deletion progress could not be loaded.')
    setRows(value.rows);setLoaded(true)
   }finally{clearTimeout(timeout)}
  }catch(e){if(active.current)setError(e instanceof Error?e.message:'Deletion progress could not be loaded.')}
  finally{if(active.current)setBusy(false)}
 }
 const date=(value:string)=>new Date(value).toLocaleString()
 return <><button type="button" onClick={()=>{void load()}} disabled={busy}>{busy?'Loading…':loaded?'Refresh requests':'Load deletion requests'}</button><p role="alert">{error}</p>{loaded&&!rows.length?<p>No pending deletion requests.</p>:null}{rows.map(row=><article className={styles.request} key={row.id}><h2>{phases[row.phase]||'Processing deletion'}</h2><dl><dt>Requested</dt><dd>{date(row.requested_at)}</dd><dt>Completion due</dt><dd>{date(row.due_at)}</dd><dt>Reference</dt><dd>{row.id}</dd></dl>{row.last_error?<p role="status">{row.attempts>=10?'Automatic retries paused. Investigate the failed service before resuming.':'The service will retry automatically.'} Step: {row.last_error}.</p>:null}</article>)}<p>Showing the first 25 pending requests, oldest deadline first. Deletion runs automatically; this page does not approve or certify erasure.</p></>
}
function AccountDeletionContent(){const {userId}=useAuth();return <div className={styles.page}><Link href="/admin">Back to Admin</Link><small>Account privacy</small><h1>Account deletion requests</h1><p>Follow automatic deletion progress and investigate service failures. Completion is recorded only after removal has been verified and the completion email accepted.</p>{userId?<Queue key={userId} owner={userId}/>:null}</div>}
export default function AccountDeletionRequests(){return <SiteShell><AdminGate><AccountDeletionContent/></AdminGate></SiteShell>}
