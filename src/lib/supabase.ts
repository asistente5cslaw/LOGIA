import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://sqtltrxwbwugnksnvgyh.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_zC1SMVHCXnPC_LBB8gFb-Q_hW7M9QPd';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    !supabaseUrl.includes('placeholder')
  );
};

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      lock: async (_name, _acquireTimeout, fn) => await fn(),
    },
  }
);
