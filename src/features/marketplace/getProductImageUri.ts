import { getSupabaseClient } from '../../infrastructure/supabase/client';

export function getProductImageUri(path: string | null) {
  if (!path) return null;
  if (/^(https?:|file:)/i.test(path)) return path;
  const supabase = getSupabaseClient();
  return supabase?.storage.from('sava-media').getPublicUrl(path).data.publicUrl ?? null;
}
