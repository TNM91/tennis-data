import {Capacitor,registerPlugin} from '@capacitor/core'
import type {CourtPoint} from './explore-court-catalog'

const location=registerPlugin<{current:()=>Promise<CourtPoint>}>('TiqCourtLocation')

export async function nearbyCourtPoint():Promise<CourtPoint>{
 const point=Capacitor.getPlatform()==='ios'?await location.current():await new Promise<CourtPoint>((resolve,reject)=>{
  if(!navigator.geolocation){reject(Error('location_unavailable'));return}
  navigator.geolocation.getCurrentPosition(
   result=>resolve({lat:result.coords.latitude,lon:result.coords.longitude}),
   failure=>reject(Error(failure.code===1?'location_denied':'location_unavailable')),
   {enableHighAccuracy:false,timeout:12000,maximumAge:0},
  )
 })
 if(!Number.isFinite(point?.lat)||!Number.isFinite(point?.lon)||Math.abs(point.lat)>90||Math.abs(point.lon)>180)throw Error('location_unavailable')
 return point
}
