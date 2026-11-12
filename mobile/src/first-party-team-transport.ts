import {firstPartyBuild} from './build-scope'
import {supabaseUrl} from '../../lib/supabase-public-config'

export const firstPartyTeamRooms='https://www.tenaceiq.com/api/mobile/first-party/team-rooms'
export const firstPartyTeamInvites='https://www.tenaceiq.com/api/mobile/first-party/team-invites'

export function readTeamLogoUrl(value:unknown){
 if(typeof value!=='string'||value.length>2000)return undefined
 try{
  const url=new URL(value)
  if(url.origin===supabaseUrl&&!url.username&&!url.password&&
    /^\/storage\/v1\/object\/sign\/team-room-files\/team-logos\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(url.pathname)&&url.searchParams.has('token'))return url.href
 }catch{return undefined}
}

export function matchesTeamReleaseScope(data:unknown,owner:string){
 if(!firstPartyBuild)return true
 const row=data as {releaseScope?:unknown;owner?:unknown}|null
 return row?.releaseScope==='first-party'&&row.owner===owner
}
