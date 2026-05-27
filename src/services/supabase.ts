import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://ddsgkatwcwhxerfrgfyv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uI6MFk3ZyRcb4mHz2Xnjeg_6MswVAGA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
