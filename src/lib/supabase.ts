import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://papmvkkydeuzoslnymmg.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_X3yhSz2K5NAfJf_xBiEqFA_PTC36bjJ'

export const supabase = createClient(supabaseUrl, supabaseKey)
