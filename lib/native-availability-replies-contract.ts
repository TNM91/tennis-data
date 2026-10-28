import type {TeamRoomScope} from './team-room'
export const availabilityReplyGroups=['yes','maybe','no','waiting'] as const
export type AvailabilityReplies={ok:true;owner:string;scope:TeamRoomScope;messageId:string;matchDate:string;opponent:string;checkedAt:string;groups:Record<typeof availabilityReplyGroups[number],string[]>}
