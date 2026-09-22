'use client'
import { useEffect, useState } from 'react'
import { isStreetLocation, venueLocation, venueText, type VenuePreference, type VerifiedVenue } from '@/lib/venue-directory'
import type { TeamScheduleCalendarItem } from '@/lib/team-schedule-calendar'
import { resolveCalendarLocation } from '@/lib/calendar-location'
import styles from './team-season-calendar.module.css'

export type CalendarVenueChoice = { location: string; venueDirectoryId?: string; venuePreferenceId?: string }
type Props = {facility: string; context: string; token: string; disabled: boolean; onChoose: (facility: string, choice: CalendarVenueChoice)=>void; onLoaded: (facility:string,loaded:boolean)=>void}

export function withVenueChoice(item: TeamScheduleCalendarItem, choices: Record<string,CalendarVenueChoice>) {
  return choices[item.facilityName || ''] ? {...item,...choices[item.facilityName || '']} : item
}

export default function SeasonVenueLocation({facility,context,token,disabled,onChoose,onLoaded}: Props) {
  const [venues,setVenues] = useState<VerifiedVenue[]>([])
  const [preference,setPreference] = useState<VenuePreference | null>(null)
  const [open,setOpen] = useState(false)
  const [loading,setLoading] = useState(true)
  const [working,setWorking] = useState(false)
  const [error,setError] = useState('')
  const [city,setCity] = useState(''), [state,setState] = useState(''), [street,setStreet] = useState(''), [source,setSource] = useState('')
  const [share,setShare] = useState(false)
  const [reload,setReload] = useState(0)

  useEffect(()=>{
    const controller = new AbortController()
    let active = true
    setLoading(true)
    onLoaded(facility,false)
    const params = new URLSearchParams({name:facility,context})
    void fetch(`/api/player/venue-locations?${params}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)]),cache:'no-store'})
      .then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.message || 'Locations could not be loaded.');return result})
      .then(result=>{
        if(!active)return
        setVenues(result.venues || [])
        const saved=result.preference as VenuePreference | null
        setPreference(saved)
        if(saved){
          setCity(saved.city);setState(saved.state_code);setStreet(saved.street_address);setSource(saved.source_url)
          const venue=(result.venues as VerifiedVenue[]).find(v=>v.id===saved.directory_id)
          onChoose(facility,{location:venueLocation(venue || saved),venuePreferenceId:saved.id,...(venue?{venueDirectoryId:venue.id}:{})})
        }else if(result.venues.length===1 && resolveCalendarLocation(facility)!==facility){
          // The bundled, independently verified aliases are safe defaults. New
          // directory matches still require choosing their city/state.
          const venue=result.venues[0] as VerifiedVenue
          onChoose(facility,{location:venueLocation(venue),venueDirectoryId:venue.id})
        }
        onLoaded(facility,true)
        setError('')
      }).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Locations could not be loaded.')})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false;controller.abort()}
  },[facility,context,token,reload,onChoose,onLoaded])

  async function save(venue?: VerifiedVenue) {
    if(working || disabled)return
    setWorking(true);setError('')
    try {
      const response=await fetch('/api/player/venue-locations',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify({facilityName:facility,context,directoryId:venue?.id,city,state,streetAddress:street,sourceUrl:source,shareForReview:share})})
      const result=await response.json()
      if(!response.ok)throw Error(result.message || 'Address was not saved.')
      const saved=result.preference as VenuePreference
      setPreference(saved)
      onChoose(facility,{location:venueLocation(result.directory || saved),venuePreferenceId:saved.id,...(saved.directory_id?{venueDirectoryId:saved.directory_id}:{venueDirectoryId:undefined})})
      setOpen(false)
    }catch(cause){setError(cause instanceof Error?cause.message:'Address was not saved.')}
    finally{setWorking(false)}
  }
  const mapQuery = [facility,city,state].filter(Boolean).join(', ')
  return <div className={styles.venue}>
    <div className={styles.venueHeader}><strong>{facility || 'Match location'}</strong><button type="button" className={styles.secondary} disabled={disabled || working || loading} aria-expanded={open} onClick={()=>setOpen(!open)}>{preference?'Edit location':'Confirm location'}</button></div>
    {loading?<p role="status">Checking saved locations…</p>:null}
    {preference?<p>{venueLocation(preference)} · Saved for this season</p>:null}
    {error?<><p role="alert">{error}</p><button type="button" className={styles.secondary} onClick={()=>setReload(n=>n+1)}>Retry locations</button></>:null}
    {open?<div className={styles.venueForm}>
      {venues.length?<><p>Choose the correct city and state. Similar names may be different clubs.</p>{venues.map(venue=><button key={venue.id} type="button" className={styles.secondary} disabled={working || disabled} onClick={()=>void save(venue)}>{venueLocation(venue)}</button>)}</>:null}
      <p>Not listed? Find the venue, then confirm its playing address.</p>
      <div className={styles.venueFields}><label>City<input value={city} maxLength={100} onChange={event=>setCity(event.target.value)} /></label><label>State<input value={state} maxLength={2} placeholder="MO" onChange={event=>setState(event.target.value.toUpperCase())} /></label></div>
      <a className={styles.textLink} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noopener noreferrer">Find {facility} in Maps ↗</a>
      <label>Street address<input value={street} maxLength={160} placeholder="123 Main St" onChange={event=>setStreet(event.target.value)} /></label>
      <label>Official venue website (optional)<input value={source} type="url" placeholder="https://" maxLength={1000} onChange={event=>setSource(event.target.value)} /></label>
      <label className={styles.matchChoice}><input type="checkbox" checked={share} onChange={event=>setShare(event.target.checked)} /><span>Suggest this public venue for other teams. TiQ reviews it before sharing.</span></label>
      <button type="button" className={styles.primary} disabled={working || disabled || !isStreetLocation(street) || !venueText(city) || state.length!==2} onClick={()=>void save()}>{working?'Saving location…':'Confirm address for this season'}</button>
    </div>:null}
  </div>
}
