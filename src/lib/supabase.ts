import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    !supabaseUrl.includes('placeholder')
  );
};

// Create a Supabase client. If keys are missing, we initialize with fallback url/key so the app doesn't crash on import,
// while `isSupabaseConfigured()` allows the UI and services to display genuine configuration guidance.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-logia.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      lock: async (_name, _acquireTimeout, fn) => await fn(),
    },
  }
);
