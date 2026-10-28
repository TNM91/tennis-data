import type {ProductEntitlementSnapshot} from './access-model-core'
import type {UserRole} from './roles'
export type AccountAccess = {role:UserRole; entitlements:ProductEntitlementSnapshot}
const booleanFields = ['playerPlusSubscriptionActive','coachSubscriptionActive','captainSubscriptionActive','tiqTeamLeagueEntryEnabled','tiqIndividualLeagueCreatorEnabled'] as const
const statusFields = ['playerPlusSubscriptionStatus','coachSubscriptionStatus','captainSubscriptionStatus'] as const
const expiryFields = ['playerPlusAccessExpiresAt','coachAccessExpiresAt','captainAccessExpiresAt','leagueAccessExpiresAt'] as const

export function parseAccountAccess(value:unknown):AccountAccess|null {
 if(!value || typeof value!=='object')return null
 const body=value as Record<string,unknown>,access=body.access as Record<string,unknown>|undefined
 if(body.ok!==true || !access || !['public','member','captain','admin'].includes(String(access.role)))return null
 const row=access.entitlements as Record<string,unknown>|undefined
 if(!row || typeof row!=='object' || Array.isArray(row))return null
 if(booleanFields.some(key=>typeof row[key]!=='boolean'))return null
 if(statusFields.some(key=>!['inactive','trial','active','past_due','canceled'].includes(String(row[key]))))return null
 if(expiryFields.some(key=>row[key]!==null && (typeof row[key]!=='string' || String(row[key]).length>40 || !/^\d{4}-\d{2}-\d{2}T/.test(String(row[key])) || !Number.isFinite(Date.parse(String(row[key]))))))return null
 const entitlements=Object.fromEntries([...booleanFields,...statusFields,...expiryFields].map(key=>[key,row[key]])) as ProductEntitlementSnapshot
 return {role:access.role as UserRole,entitlements}
}
