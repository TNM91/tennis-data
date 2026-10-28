import type {TeamFixture} from './team-fixtures-contract'
import type {TeamRoomScope} from './team-room'
export type AvailabilityReview={ok:true;owner:string;scope:TeamRoomScope;fixture:TeamFixture;roster:string[];token:string;existingCardId:string;canPost:boolean;reason:string}
export type AvailabilityRequest={fixtureId:string;publicationId:string;expectedCardToken:string}
