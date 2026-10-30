import type {TournamentEntrySnapshot,TournamentEntryDraft} from '../../lib/native-tournament-entry-contract'
import {tournamentOwner} from './native-tournaments'
export const tournamentDraft:TournamentEntryDraft={one:'Alex Serve',two:'Sam Return',rating:4,partnerRating:3.5,attested:true,partnerAttested:true}
export function tournamentEntrySnapshot():TournamentEntrySnapshot{
 return {context:{owner:tournamentOwner,parent:'event-one',division:'division-one',name:'4.0 Doubles',eventName:'Northside Open',paired:true,playerName:'Alex Serve',playerLocked:true,canManage:false,mode:'native',director:'',locked:false,canApprove:true,date:'2026-11-14',deadline:'2026-11-13',zone:'America/Chicago',revision:'a'.repeat(32)},receipt:null,queue:[],more:false}
}
export function tournamentReceipt(){return {id:'20000000-0000-4000-8000-000000000002',name:'Alex Serve / Sam Return',status:'pending' as const,updatedAt:'2026-10-30T18:00:00Z',one:'Alex Serve',two:'Sam Return',rating:4,partnerRating:3.5,note:'',legacy:false,inDraw:false}}
