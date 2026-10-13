import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mgnlxkzmiqfxssbwuzpu.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbmx4a3ptaXFmeHNzYnd1enB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4Njc5OTcsImV4cCI6MjEwNzQ0Mzk5N30.3NzrOTTn_2iFT3EwNc_K-3zn2prrnBctIqUsFY2zF64';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
