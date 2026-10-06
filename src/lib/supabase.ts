import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://afxxuoohhxbalzbwmqmv.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmeHh1b29oaHhiYWx6YndtcW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4ODMyMTQsImV4cCI6MjA5NjQ1OTIxNH0.esOufOCToHrVeuw9UI1aEnY6W3FmKyQEP05O72Fhne0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
