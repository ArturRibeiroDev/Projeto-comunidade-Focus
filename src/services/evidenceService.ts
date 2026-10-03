import { getSupabase } from '../lib/supabase';
import { throwReadError } from './readError';
import type { MemberEvidence } from '../types';

export async function getEvidence(userId: string): Promise<MemberEvidence[]> {
  const { data, error } = await getSupabase()
    .from('evidences')
    .select('id,label,technology,project_id,recorded_at,kind,role')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false });
  if (error) throwReadError('as evidências', 'evidences', error);
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    technology: row.technology ?? undefined,
    projectId: row.project_id ?? undefined,
    recordedAt: row.recorded_at,
    kind: row.kind,
    role: row.role ?? undefined,
  }));
}
