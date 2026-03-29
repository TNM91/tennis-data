import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pwxppfazbyourjrsutgx.supabase.co'
const supabaseKey = 'sb_publishable_FQBYCnXJy2vjIYlri8TG7g_2XZ9IqqZ'

export const supabase = createClient(supabaseUrl, supabaseKey)