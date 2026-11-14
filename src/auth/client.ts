import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public project configuration only. Never put a service-role or secret key in Vite env.
const url = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();

export function hasAuthConfiguration(): boolean {
  if (!publishableKey || !url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !!parsed.hostname && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

let instance: SupabaseClient | null = null;

export function getAuthClient(): SupabaseClient | null {
  if (!hasAuthConfiguration()) return null;
  if (!instance) {
    instance = createClient(url, publishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    });
  }
  return instance;
}
