import {firstPartyBuild} from './build-scope'
export {readChatIconUrl as readTeamLogoUrl} from '../../lib/chat-icon-url'

export const firstPartyTeamRooms='https://www.tenaceiq.com/api/mobile/first-party/team-rooms'
export const firstPartyTeamInvites='https://www.tenaceiq.com/api/mobile/first-party/team-invites'

export function matchesTeamReleaseScope(data:unknown,owner:string){
 if(!firstPartyBuild)return true
 const row=data as {releaseScope?:unknown;owner?:unknown}|null
 return row?.releaseScope==='first-party'&&row.owner===owner
}
