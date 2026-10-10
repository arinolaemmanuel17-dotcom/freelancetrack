import { createClient } from '@supabase/supabase-js'

// The project URL and publishable key are meant to be public: they ship to every
// browser. What protects the data is row-level security in the database.
// Never put the secret or service_role key here.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ysugwqqjhtppxtehuhew.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_o-HIGfiYKCbfaZViUZRU1g_aQF6NTU-'

export const supabase = createClient(url, key)
