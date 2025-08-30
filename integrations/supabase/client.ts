import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { config } from '@/lib/config';

// Lazy loading function for Supabase client
let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;

export const getSupabaseClient = () => {
  // Check if client already exists
  if (supabaseClient) {
    return supabaseClient;
  }

  // Validate environment variables before creating client
  if (!config.supabase.url) {
    console.error('NEXT_PUBLIC_SUPABASE_URL is required. Please check your .env.local file.');
    return null;
  }

  if (!config.supabase.anonKey) {
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required. Please check your .env.local file.');
    return null;
  }

  try {
    console.log('Creating Supabase client with URL:', config.supabase.url);
    console.log('Anon key available:', !!config.supabase.anonKey);
    
    supabaseClient = createClient<Database>(config.supabase.url, config.supabase.anonKey);
    return supabaseClient;
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    return null;
  }
};

// Export a safe client that can be null
export const supabase = getSupabaseClient();

// Helper function to check if Supabase is ready
export const isSupabaseReady = () => {
  return supabase !== null;
};
