import {competitionOwner} from './competitions-data'
export const navigationOwner=competitionOwner
let user={id:navigationOwner,email:'preview@example.test'},signedIn=true
let listener:((event:string,session:unknown)=>void)|null=null
const session=()=>signedIn?{user,access_token:'synthetic-local-token'}:null
const player={overall_rating:4,overall_dynamic_rating:4.42,singles_dynamic_rating:4.37,doubles_dynamic_rating:4.49,rating_source:'verified'}
function data(table:string){
 if(table==='profiles')return {linked_player_id:navigationOwner,linked_player_name:'Jordan Lee',linked_team_name:'Baseline Aces',linked_league_name:'City Tennis League'}
 if(table==='players')return player
 if(table==='matches')return Array.from({length:10},(_,i)=>({id:'court-'+i,match_date:'2026-10-'+(28-i),match_type:i%3===0?'singles':'doubles',league_name:'City Tennis League',score:i%3===2?'4-6, 3-6':'6-4, 6-3',winner_side:i%3===2?'A':'B',match_players:[{player_id:navigationOwner,side:'B'}]}))
 return []
}
export function createClient(){return {
 auth:{getSession:async()=>({data:{session:session()},error:null}),onAuthStateChange:(fn:typeof listener)=>{listener=fn;queueMicrotask(()=>listener?.('INITIAL_SESSION',session()));return {data:{subscription:{unsubscribe(){}}}}},startAutoRefresh(){},stopAutoRefresh(){},signOut:async()=>{signedIn=false;listener?.('SIGNED_OUT',null);return {error:null}}},
 from:(table:string)=>{const result={data:data(table),error:null};const chain:Record<string,unknown>={then:(resolve:(value:unknown)=>void)=>Promise.resolve(result).then(resolve)};for(const method of ['select','eq','in','order','limit','abortSignal','maybeSingle','single','ilike','or','is','not','range','gte','lt','neq'])chain[method]=()=>chain;return chain},
 rpc:async()=>({data:[],error:null}),
 }}
export function refreshNavigationSession(){listener?.('TOKEN_REFRESHED',session())}
export function switchNavigationOwner(){user={id:'22222222-2222-4222-8222-222222222222',email:'another-preview@example.test'};listener?.('SIGNED_IN',session())}
