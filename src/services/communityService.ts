import { getSupabase } from '../lib/supabase';
import { safeExternalUrl } from '../utils/profileFields';

export type CommunityMember = {
  memberKey: string;
  name: string;
  avatarUrl: string;
  primaryRole: string;
  bio: string;
  areas: string[];
  technologies: string[];
  interests: string[];
};
export type CommunityProfile = CommunityMember & {
  discordConnected: boolean;
  links: { github?: string; linkedin?: string };
  projects: Array<{ name: string; status: string; role: string }>;
  evidence: Array<{ projectName: string; kind: string; role: string; recordedAt: string }>;
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Perfil indisponível.');
  return value as Record<string, unknown>;
};
const string = (value: unknown) => (typeof value === 'string' ? value : '');
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const rows = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(record) : [];
export function communityMember(value: unknown): CommunityMember {
  const row = record(value);
  if (!string(row.memberKey) || !string(row.name)) throw new Error('Perfil indisponível.');
  return {
    memberKey: string(row.memberKey),
    name: string(row.name),
    avatarUrl: safeExternalUrl(string(row.avatarUrl)) ?? '',
    primaryRole: string(row.primaryRole),
    bio: string(row.bio),
    areas: strings(row.areas),
    technologies: strings(row.technologies),
    interests: strings(row.interests),
  };
}
export async function listCommunityMembers(
  search: string,
  area: string,
  interest: string,
  page: number,
) {
  const { data, error } = await getSupabase().rpc('list_community_members', {
    p_search: search,
    p_area: area,
    p_interest: interest,
    p_page: page,
  });
  if (error) throw error;
  const result = record(data);
  return { members: rows(result.members).map(communityMember), hasMore: result.hasMore === true };
}
export async function getCommunityMember(memberKey: string): Promise<CommunityProfile | null> {
  const { data, error } = await getSupabase().rpc('get_community_member', {
    p_member_key: memberKey,
  });
  if (error) throw error;
  if (!data) return null;
  const row = record(data);
  const links = record(row.links ?? {});
  return {
    ...communityMember(row),
    discordConnected: row.discordConnected === true,
    links: {
      github: safeExternalUrl(string(links.github)),
      linkedin: safeExternalUrl(string(links.linkedin)),
    },
    projects: rows(row.projects).map((project) => ({
      name: string(project.name),
      status: string(project.status),
      role: string(project.role),
    })),
    evidence: rows(row.evidence).map((item) => ({
      projectName: string(item.projectName),
      kind: string(item.kind),
      role: string(item.role),
      recordedAt: string(item.recordedAt),
    })),
  };
}
