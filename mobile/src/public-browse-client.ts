import {createClient} from '@supabase/supabase-js'
import {supabaseUrl,supabaseKey} from '../../lib/supabase-public-config'
/** No saved session, native secure storage, account creation or authenticated JWT. */
export function createPublicBrowseClient() {
 return createClient(supabaseUrl,supabaseKey,{auth:{storageKey:'tenaceiq-public-explore',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
}
