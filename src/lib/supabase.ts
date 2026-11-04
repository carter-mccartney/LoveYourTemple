import { createClient } from "@supabase/supabase-js";

// Set these in .env.local (dev) and in your host's environment settings (prod).
// When they're missing the app runs in local, single-device mode.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
