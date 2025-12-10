import { createClient } from '@supabase/supabase-js';

// Access environment variables safely using optional chaining
// This prevents the "Cannot read properties of undefined" error if import.meta.env is missing
// Fix: Cast import.meta to any to avoid 'Property env does not exist on type ImportMeta' error
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase credentials missing! The app will not work correctly without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

// Initialize Supabase client
// We provide fallback strings to ensure createClient doesn't throw immediate errors if vars are missing,
// allowing the app to render (albeit with auth errors) instead of crashing.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder'
);