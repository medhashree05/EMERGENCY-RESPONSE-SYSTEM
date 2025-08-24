// supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qfnmcosnjcvfwcvghgsq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbm1jb3NuamN2ZndjdmdoZ3NxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwMjM5MjcsImV4cCI6MjA3MTU5OTkyN30.S-CbwKyEVgZSe5-DNm9V_9WUeIOOrOP6E6r1BRDOYC0';

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
});