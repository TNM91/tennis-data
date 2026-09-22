'use client'
import { useEffect, useRef, useState } from 'react'
import type { MatchCalendarShare } from '@/lib/match-calendar-shares'
import styles from './team-season-calendar.module.css'

type Props={team:string;seasonKey:string;timeZone:string;itemIds:string[];token:string;disabled:boolean;saveMatches:()=>Promise<void>}
export default function MatchCalendarSharing({team,seasonKey,timeZone,itemIds,token,disabled,saveMatches}:Props) {
  const [shares,setShares]=useState<MatchCalendarShare[]>([])
  const [label,setLabel]=useState('Family')
  const [url,setUrl]=useState('')
  const [createdId,setCreatedId]=useState('')
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [confirmId,setConfirmId]=useState('')
  const [refresh,setRefresh]=useState(0)
  const lock=useRef(false)
  useEffect(()=>{
    const controller=new AbortController()
    fetch('/api/player/match-calendar-shares',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])})
      .then(async r=>{const data=await r.json();if(!r.ok || !data.ok)throw Error(data.message || 'Could not load shared calendars.');return data})
      .then(data=>{if(!controller.signal.aborted){setShares(data.shares);setError('')}})
      .catch(()=>{if(!controller.signal.aborted)setError('Shared calendars could not be loaded. Retry before creating another link.')})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[token,refresh])
  const current=shares.filter(share=>share.team_name===team && share.season_key===seasonKey)
  async function change(method:'POST'|'PATCH'|'DELETE',id?:string) {
    if(lock.current || (method!=='DELETE' && disabled) || loading)return
    lock.current=true;setBusy(true);setError('');setMessage('')
    try{
      if(method!=='DELETE')await saveMatches()
      const r=await fetch(`/api/player/match-calendar-shares${method==='DELETE'?`?id=${id}`:''}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:method==='DELETE'?undefined:JSON.stringify({id,label:label.trim(),teamName:team,seasonKey,timeZone,itemIds}),signal:AbortSignal.timeout(30000)})
      const data=await r.json();if(!r.ok || !data.ok)throw Error(data.message || 'Sharing could not be changed. Retry.')
      if(method==='DELETE'){setShares(previous=>previous.filter(share=>share.id!==id));if(id===createdId){setUrl('');setCreatedId('')}setConfirmId('');setMessage('Sharing stopped. Previously downloaded copies may remain on other devices.')}
      else if(method==='PATCH'){setShares(previous=>previous.map(share=>share.id===id?data.share:share));setMessage('Shared selection updated. Existing subscribers keep the same link.')}
      else{setShares(previous=>[data.share,...previous]);setUrl(data.shareUrl);setCreatedId(data.share.id);setMessage(`${itemIds.length} ${itemIds.length===1?'match':'matches'} saved and ready to share. Nothing has been sent.`)}
    }catch(cause){setError(cause instanceof Error && !['AbortError','TimeoutError'].includes(cause.name)?cause.message:'This took too long. Refresh shared links to check whether it finished before retrying.')}
    finally{lock.current=false;setBusy(false)}
  }
  async function copy(){try{await navigator.clipboard.writeText(url);setMessage('Sharing link copied. Paste it into a text to your family or friends.')}catch{setMessage('Select and copy the sharing link below.')}}
  return <details><summary>Share match calendar with family</summary><div className={styles.download}>
    <p>Share this team’s {itemIds.length} selected {itemIds.length===1?'match':'matches'}. Practices, reminders and other teams stay private. Choose a different team from Teams to share its season separately.</p>
    <p>Anyone with the link can view these match names, dates and locations—no TiQ account needed. You can stop sharing anytime.</p>
    <label>Link label<input className={styles.shareInput} value={label} maxLength={80} disabled={busy || disabled} onChange={e=>setLabel(e.target.value)} placeholder="Family" /></label>
    <button type="button" className={styles.secondary} disabled={disabled || busy || loading || !!error || !itemIds.length || !label.trim()} onClick={()=>void change('POST')}>{busy?'Saving…':'Create sharing link'}</button>
    {loading?<p role="status">Checking existing sharing links…</p>:null}
    {message?<p role="status">{message}</p>:null}
    {error?<><p role="alert">{error}</p><button className={styles.secondary} type="button" disabled={busy} onClick={()=>{setLoading(true);setRefresh(x=>x+1)}}>Refresh shared links</button></>:null}
    {url?<div className={styles.result}><button type="button" className={styles.primary} onClick={()=>void copy()}>Copy link to send</button><a className={styles.secondary} href={url} target="_blank" rel="noopener noreferrer">Preview recipient calendar</a><label>Family sharing link<input value={url} readOnly onFocus={e=>e.target.select()} /></label></div>:null}
    {current.length?<details><summary>Manage sharing links · {current.length}</summary><div className={styles.download}>
      <p>Existing links stay active. After reloading this page, create another link only for a new recipient; your previous links still work.</p>
      {current.map(share=><div className={styles.venue} key={share.id}><strong>{share.label} · {share.item_ids.length} {share.item_ids.length===1?'match':'matches'}</strong><p>Created {share.created_at.slice(0,10)}</p><button className={styles.secondary} type="button" disabled={disabled || busy || !itemIds.length} onClick={()=>void change('PATCH',share.id)}>Use current match selection</button>{confirmId===share.id?<><p>Stop future access for everyone using this link? Your own calendar is unaffected.</p><button className={styles.secondary} type="button" disabled={busy} onClick={()=>void change('DELETE',share.id)}>Yes, stop sharing</button><button className={styles.secondary} type="button" onClick={()=>setConfirmId('')}>Keep sharing</button></>:<button className={styles.secondary} type="button" disabled={busy} onClick={()=>setConfirmId(share.id)}>Stop sharing</button>}</div>)}
    </div></details>:null}
    <p>Saved date/time changes and verified address corrections appear when the recipient’s calendar refreshes. New matches are not shared automatically: choose Use current match selection to include them.</p>
  </div></details>
}
