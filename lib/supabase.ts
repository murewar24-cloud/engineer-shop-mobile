import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uhuoctilqiynctamtqtv.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_C1W3pOpUFlJs_xhHTsewrw_eMIap66Y'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})