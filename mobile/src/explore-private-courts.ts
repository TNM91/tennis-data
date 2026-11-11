import {getNativeAuthStorage} from '../../lib/native-auth-storage'
import {validateVenueAddress,venueText} from '../../lib/venue-directory'
import type {ExploreCourt} from './explore-court-catalog'

const maxPrivateCourts=30
type PrivateAddress={id:string;facilityName:string;streetAddress:string;city:string;state:string;zip:string}

function privateAddress(id:string,input:Record<string,unknown>):PrivateAddress|null{
 const venue=validateVenueAddress(input),zip=venueText(input.zip)
 if(!venue||zip&&!/^\d{5}$/.test(zip))return null
 return {id,facilityName:venue.facility_name,streetAddress:venue.street_address,city:venue.city,state:venue.state_code,zip}
}

function courtOf(row:PrivateAddress):ExploreCourt{
 const area=`${row.city}, ${row.state}`
 return {id:row.id,name:row.facilityName,area,access:'private',destination:`${row.streetAddress}, ${area}${row.zip?' '+row.zip:''}`}
}

export function createPrivateCourtStore(owner?:string){
 const key=`explore-private-courts:v1:${owner??''}`
 const storage=owner?getNativeAuthStorage():undefined
 let reading:Promise<PrivateAddress[]>|undefined

 async function load(){
  if(!owner)return []
  reading??=Promise.resolve().then(async()=>{
   const text=storage?await storage.getItem(key):localStorage.getItem(key)
   if(text==null)return []
   const rows:unknown=JSON.parse(text)
   if(!Array.isArray(rows)||rows.length>maxPrivateCourts)throw Error('invalid_private_courts')
   const ids=new Set<string>()
   return rows.map(row=>{
    const id=row?.id
    if(typeof id!=='string'||!/^private-[0-9a-f-]{36}$/.test(id)||ids.has(id))throw Error('invalid_private_court')
    const parsed=privateAddress(id,row)
    if(!parsed)throw Error('invalid_private_court')
    ids.add(id)
    return parsed
   })
  }).catch(error=>{reading=undefined;throw error})
  return reading
 }

 async function write(rows:PrivateAddress[]){
  if(!owner)throw Error('sign_in')
  const value=JSON.stringify(rows)
  if(storage)await storage.setItem(key,value)
  else localStorage.setItem(key,value)
  reading=Promise.resolve(rows)
  return rows.map(courtOf)
 }

 return {
  list:async()=> (await load()).map(courtOf),
  async add(input:Record<string,unknown>){
   const entry=privateAddress(`private-${crypto.randomUUID()}`,input)
   if(!entry)throw Error('invalid_address')
   const rows=await load()
   if(rows.some(row=>courtOf(row).destination.toLowerCase()===courtOf(entry).destination.toLowerCase()&&row.facilityName.toLowerCase()===entry.facilityName.toLowerCase()))throw Error('duplicate_court')
   if(rows.length>=maxPrivateCourts)throw Error('private_limit')
   return {id:entry.id,courts:await write([...rows,entry])}
  },
  async remove(id:string){return write((await load()).filter(row=>row.id!==id))},
 }
}
