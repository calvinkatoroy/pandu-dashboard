import { supabase } from './supabase';

/**
 * Catat aksi pengguna ke audit_log (PLAN §5, §6.4).
 * RLS mensyaratkan user_id = auth.uid(), jadi user_id selalu diisi.
 */
export async function logAudit(action: string, target?: string) {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return;
  await supabase.from('audit_log').insert({ user_id: uid, action, target: target ?? null });
}
