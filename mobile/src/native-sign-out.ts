import type {SupabaseClient} from '@supabase/supabase-js'

/** Shared by Account and My Lab. Revoke this phone's alerts before clearing its login. */
export function createNativeSignOut(client:SupabaseClient,beforeSignOut:(owner:string)=>Promise<void>,owner:()=>string|null){
 let pending:{owner:string;task:Promise<void>}|null=null
 return (expected:string):Promise<void>=>{
  if(!expected||owner()!==expected)return Promise.reject(Error('Account changed'))
  if(pending)return pending.owner===expected?pending.task:Promise.reject(Error('Logout already in progress'))
  const check=async()=>{if(owner()!==expected)throw Error('Account changed');const result=await client.auth.getSession();if(result.error||owner()!==expected||result.data.session?.user.id!==expected)throw Error('Account changed')}
  const run=async()=>{await check();await beforeSignOut(expected);await check();const result=await client.auth.signOut({scope:'local'});if(result.error)throw result.error}
  const task=run().finally(()=>{if(pending?.task===task)pending=null})
  pending={owner:expected,task};return task
 }
}
