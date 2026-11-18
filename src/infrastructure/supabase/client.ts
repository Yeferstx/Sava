import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import storage from 'expo-sqlite/kv-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;

export function getSupabaseClient() {
  if (client !== undefined) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey || url.includes('your-project')) {
    client = null;
    return client;
  }
  client = createClient(url, publishableKey, {
    auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  // al volver del segundo plano la sesion se revisa sola (si vencio sin senal, se renueva)
  const conCliente = client;
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') conCliente.auth.startAutoRefresh();
    else conCliente.auth.stopAutoRefresh();
  });
  return client;
}
