import type {TeamRoomScope} from './team-room'
export type AvailabilityReminderReview={ok:true;owner:string;scope:TeamRoomScope;messageId:string;matchDate:string;opponent:string;token:string;names:string[];waitingCount:number;excludedCount:number;canSend:boolean;reason:string;nextAt:string}
export type AvailabilityReminderAction={messageId:string;operationId:string;expectedToken:string}
export type AvailabilityReminderReceipt={ok:true;owner:string;scope:TeamRoomScope;messageId:string;operationId:string;state:'recorded'|'notifications_saved';count:number;at:string}
