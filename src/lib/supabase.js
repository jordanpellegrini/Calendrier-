import { createClient } from '@supabase/supabase-js'

// REMPLACE ces valeurs par celles de TON projet Supabase
// (Settings > API dans le dashboard Supabase)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://VOTRE_PROJET.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'VOTRE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  }
})
