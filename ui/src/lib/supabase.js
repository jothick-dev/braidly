import { createClient } from '@supabase/supabase-js'

let supabase = null

export async function initSupabase() {
  try {
    const res = await fetch('/api/config')
    const config = await res.json()
    if (config.supabase?.url && config.supabase?.anonKey) {
      supabase = createClient(config.supabase.url, config.supabase.anonKey)
      return supabase
    }
    return null
  } catch {
    return null
  }
}

export function getSupabase() {
  return supabase
}

export function onAuthChange(callback) {
  if (!supabase) return () => {}
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  return () => subscription.unsubscribe()
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut()
}
