import { getSupabase } from '../lib/supabase';
import { throwReadError } from './readError';
import type { MemberEvidence, MemberProfile } from '../types';
import {
  availabilityHours,
  bioLength,
  BIO_MAX_LENGTH,
  safeExternalUrl,
} from '../utils/profileFields';

export async function getSkillSuggestions(): Promise<{
  technologies: string[];
  areas: string[];
}> {
  const { data, error } = await getSupabase().from('skills').select('kind,name').order('name');
  if (error) throwReadError('as sugestões de competências', 'skills', error);
  return {
    technologies: (data ?? [])
      .filter((item) => item.kind === 'technology')
      .map((item) => item.name),
    areas: (data ?? []).filter((item) => item.kind === 'area').map((item) => item.name),
  };
}

export async function getProfile(
  userId: string,
  evidence: MemberEvidence[],
): Promise<MemberProfile> {
  const client = getSupabase();
  const [profileResult, skillsResult, skillLinksResult, membershipResult, completedResult] =
    await Promise.all([
      client
        .from('profiles')
        .select(
          'id,name,avatar_url,bio,main_role,secondary_roles,interests,availability,github_url,linkedin_url',
        )
        .eq('id', userId)
        .single(),
      client.from('skills').select('id,name,kind'),
      client.from('profile_skills').select('skill_id').eq('profile_id', userId),
      client.from('project_members').select('project_id').eq('user_id', userId),
      client.from('projects').select('id,status,completed_at'),
    ]);
  for (const [source, result] of [
    ['profiles', profileResult],
    ['skills', skillsResult],
    ['profile_skills', skillLinksResult],
    ['project_members', membershipResult],
    ['projects', completedResult],
  ] as const)
    if (result.error) throwReadError('o perfil', source, result.error);
  const row = profileResult.data!;
  const selected = new Set((skillLinksResult.data ?? []).map((link) => link.skill_id));
  const mySkills = (skillsResult.data ?? []).filter((skill) => selected.has(skill.id));
  const memberships = (membershipResult.data ?? []).map((item) => item.project_id);
  const completed = new Set(
    (completedResult.data ?? [])
      .filter(
        (item) => item.status === 'COMPLETED' || (item.status === 'ARCHIVED' && item.completed_at),
      )
      .map((item) => item.id),
  );
  const active = new Set(
    (completedResult.data ?? [])
      .filter((item) => item.status === 'FORMING' || item.status === 'ACTIVE')
      .map((item) => item.id),
  );

  return {
    id: row.id,
    name: row.name,
    avatarUrl: safeExternalUrl(row.avatar_url) || '',
    bio: row.bio,
    primaryRole: row.main_role,
    secondaryRoles: row.secondary_roles ?? [],
    areas: mySkills.filter((skill) => skill.kind === 'area').map((skill) => skill.name),
    technologies: mySkills
      .filter((skill) => skill.kind === 'technology')
      .map((skill) => skill.name),
    interests: row.interests ?? [],
    availability: row.availability,
    links: {
      github: row.github_url ?? '',
      linkedin: row.linkedin_url ?? '',
    },
    currentProjectIds: memberships.filter((id) => active.has(id)),
    completedProjectIds: memberships.filter((id) => completed.has(id)),
    evidence,
  };
}

export async function updateProfile(profile: MemberProfile): Promise<void> {
  if (bioLength(profile.bio) > BIO_MAX_LENGTH)
    throw new Error(`A bio deve ter no máximo ${BIO_MAX_LENGTH} caracteres.`);
  const hours = availabilityHours(profile.availability);
  const { error } = await getSupabase().rpc('update_my_profile', {
    p_name: profile.name.trim(),
    p_avatar_url: profile.avatarUrl.includes('api.dicebear.com/') ? '' : profile.avatarUrl.trim(),
    p_bio: profile.bio,
    p_main_role: profile.primaryRole,
    p_secondary_roles: profile.secondaryRoles,
    p_availability: hours ? `${Math.min(80, Number(hours))} horas/semana` : '',
    p_interests: profile.interests,
    p_github_url: safeExternalUrl(profile.links.github) ?? '',
    p_linkedin_url: safeExternalUrl(profile.links.linkedin) ?? '',
    p_technologies: profile.technologies,
    p_areas: profile.areas,
  });
  if (error) throw error;
}
