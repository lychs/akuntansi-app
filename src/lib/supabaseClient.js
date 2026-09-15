import { createClient } from '@supabase/supabase-js'

// Diisi dari Environment Variables di Netlify (lihat PANDUAN.md).
// Vite HANYA meng-expose env var yang diawali "VITE_" ke browser.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY belum diset. ' +
    'Cek file .env (lokal) atau Environment Variables di Netlify (production).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
