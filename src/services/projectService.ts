import { getSupabase } from '../lib/supabase';

export async function removeProjectMember(projectId: string, userId: string) {
  const { error } = await getSupabase().rpc('remove_project_member', {
    p_project_id: projectId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function updateMyProjectRole(projectId: string, role: string) {
  const { error } = await getSupabase().rpc('update_my_project_role', {
    p_project_id: projectId,
    p_main_role: role,
  });
  if (error) throw error;
}
import { throwReadError } from './readError';
import type { GamificationProgress, Project, SquadRecommendation } from '../types';
import type { ProjectFormState } from '../viewTypes';
import { toList } from '../utils/format';
import { safeExternalUrl } from '../utils/profileFields';

export async function getProjects(): Promise<Project[]> {
  const client = getSupabase();
  const [projects, members, technologies, areas, skills, joinRequests, integrations] =
    await Promise.all([
      client.from('projects').select('*').order('created_at', { ascending: false }),
      client
        .from('project_members')
        .select('project_id,user_id,main_role,contribution_intent,joined_at'),
      client.from('project_technologies').select('project_id,skill_id'),
      client.from('project_areas').select('project_id,skill_id'),
      client.from('skills').select('id,name,kind'),
      client
        .from('project_join_requests')
        .select(
          'id,project_id,user_id,main_role,contribution_intent,status,requested_at,decided_at,decided_by',
        )
        .order('requested_at', { ascending: false }),
      client.from('user_integrations').select('user_id,provider').eq('provider', 'discord'),
    ]);
  const personIds = [
    ...new Set([
      ...(projects.data ?? []).map((row) => row.owner_id as string),
      ...(members.data ?? []).map((row) => row.user_id as string),
      ...(joinRequests.data ?? []).map((row) => row.user_id as string),
    ]),
  ];
  const peopleBatches = [];
  for (let offset = 0; offset < personIds.length; offset += 100) {
    const ids = personIds.slice(offset, offset + 100);
    peopleBatches.push(
      await Promise.all([
        client
          .from('profiles')
          .select('id,community_id,name,avatar_url,bio,interests')
          .in('id', ids),
        client.from('profile_skills').select('profile_id,skill_id').in('profile_id', ids),
      ]),
    );
  }
  const profiles = {
    data: peopleBatches.flatMap(([people]) => people.data ?? []),
    error: peopleBatches.find(([people]) => people.error)?.[0].error,
  };
  const profileSkills = {
    data: peopleBatches.flatMap(([, links]) => links.data ?? []),
    error: peopleBatches.find(([, links]) => links.error)?.[1].error,
  };
  for (const [source, result] of [
    ['projects', projects],
    ['project_members', members],
    ['project_technologies', technologies],
    ['project_areas', areas],
    ['skills', skills],
    ['profiles', profiles],
    ['project_join_requests', joinRequests],
    ['user_integrations', integrations],
    ['profile_skills', profileSkills],
  ] as const)
    if (result.error) throwReadError('os projetos', source, result.error);
  const names = new Map((skills.data ?? []).map((skill) => [skill.id, skill.name]));
  const people = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));
  const discordUsers = new Set((integrations.data ?? []).map((item) => item.user_id));
  const skillRows = skills.data ?? [];
  const skillNameById = new Map(skillRows.map((skill) => [skill.id, skill.name]));
  const profileSkillMap = new Map<string, { areas: string[]; technologies: string[] }>();
  for (const link of profileSkills.data ?? []) {
    const current = profileSkillMap.get(link.profile_id) ?? { areas: [], technologies: [] };
    const skill = skillRows.find((item) => item.id === link.skill_id);
    const name = skillNameById.get(link.skill_id);
    if (skill?.kind === 'area' && name) current.areas.push(name);
    if (skill?.kind === 'technology' && name) current.technologies.push(name);
    profileSkillMap.set(link.profile_id, current);
  }
  return (projects.data ?? []).map((row) => ({
    id: row.id,
    templateId: row.template_id ?? undefined,
    sourceProjectId: row.source_project_id ?? undefined,
    ownerId: row.owner_id,
    ownerName: people.get(row.owner_id)?.name ?? 'Responsável Focus',
    name: row.name,
    description: row.description,
    category: row.category,
    problem: row.problem,
    objective: row.objective,
    status: row.status,
    moderationStatus: row.moderation_status,
    moderationReason: row.moderation_reason ?? undefined,
    origin: row.origin,
    maxMembers: row.max_members,
    duration: row.duration,
    plannedStartDate: row.planned_start_date ?? undefined,
    plannedEndDate: row.planned_end_date ?? undefined,
    difficulty: row.difficulty,
    technologies: (technologies.data ?? [])
      .filter((link) => link.project_id === row.id)
      .map((link) => names.get(link.skill_id))
      .filter((name): name is string => Boolean(name)),
    relatedAreas: (areas.data ?? [])
      .filter((link) => link.project_id === row.id)
      .map((link) => names.get(link.skill_id))
      .filter((name): name is string => Boolean(name)),
    suggestedComposition: row.suggested_composition as SquadRecommendation[],
    possibleStacks: row.possible_stacks ?? [],
    outcomes: row.outcomes ?? [],
    members: (members.data ?? [])
      .filter((member) => member.project_id === row.id)
      .map((member) => {
        const person = people.get(member.user_id);
        const name = person?.name ?? 'Membro Focus';
        return {
          memberId: member.user_id,
          communityId: person?.community_id,
          name,
          avatarUrl: safeExternalUrl(person?.avatar_url) || '',
          role: member.main_role,
          contributionIntent: member.contribution_intent,
          joinedAt: member.joined_at,
        };
      }),
    joinRequests: (joinRequests.data ?? [])
      .filter((request) => request.project_id === row.id)
      .map((request) => {
        const person = people.get(request.user_id);
        const name = person?.name ?? 'Membro Focus';
        const skills = profileSkillMap.get(request.user_id) ?? { areas: [], technologies: [] };
        return {
          id: request.id,
          projectId: request.project_id,
          userId: request.user_id,
          communityId: person?.community_id,
          bio: person?.bio ?? '',
          interests: person?.interests ?? [],
          name,
          avatarUrl: safeExternalUrl(person?.avatar_url) || '',
          role: request.main_role,
          contributionIntent: request.contribution_intent,
          status: request.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED',
          requestedAt: request.requested_at,
          decidedAt: request.decided_at ?? undefined,
          decidedBy: request.decided_by ?? undefined,
          discordConnected: discordUsers.has(request.user_id),
          areas: skills.areas,
          technologies: skills.technologies,
        };
      }),
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    cancellationReason: row.cancellation_reason ?? undefined,
    repositoryUrl: safeExternalUrl(row.repository_url) ?? undefined,
    demoUrl: safeExternalUrl(row.demo_url) ?? undefined,
    completionSummary: row.completion_summary ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createCommunityProject(form: ProjectFormState): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_planned_community_project', {
    p_name: form.name.trim(),
    p_description: form.shortDescription.trim(),
    p_category: form.category.trim(),
    p_max_members: form.memberLimit,
    p_difficulty: form.difficulty,
    p_duration: '',
    p_composition: toList(form.recommendedAreas).map((role) => ({
      role,
      amount: 1,
    })),
    p_technologies: toList(form.suggestedTechnologies),
    p_areas: toList(form.recommendedAreas),
    p_stacks: toList(form.possibleStacks),
    p_outcomes: toList(form.outcomes),
    p_start: form.plannedStartDate || null,
    p_end: form.plannedEndDate || null,
    p_owner_role: form.ownerParticipationRole,
  });
  if (error) throw error;
  return data as string;
}

export async function createProjectFromTemplate(
  templateId: string,
  ownerRole: string,
  plannedStartDate?: string,
  plannedEndDate?: string,
): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_planned_project_from_template', {
    p_template_id: templateId,
    p_start: plannedStartDate || null,
    p_end: plannedEndDate || null,
    p_owner_role: ownerRole,
  });
  if (error) throw error;
  return data as string;
}

export async function replicateProject(
  projectId: string,
  ownerRole: string,
  plannedStartDate?: string,
  plannedEndDate?: string,
): Promise<string> {
  const { data, error } = await getSupabase().rpc('replicate_planned_project', {
    p_source_project_id: projectId,
    p_start: plannedStartDate || null,
    p_end: plannedEndDate || null,
    p_owner_role: ownerRole,
  });
  if (error) throw error;
  return data as string;
}

export async function requestProjectJoin(
  projectId: string,
  role: string,
  intent: string,
): Promise<void> {
  const { error } = await getSupabase().rpc('request_project_join', {
    p_project_id: projectId,
    p_main_role: role.trim(),
    p_contribution_intent: intent.trim(),
  });
  if (error) throw error;
}

export async function decideProjectJoinRequest(
  requestId: string,
  decision: 'APPROVED' | 'REJECTED',
): Promise<void> {
  const { error } = await getSupabase().rpc('decide_project_join_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_reason: null,
  });
  if (error) throw error;
}

export async function cancelProjectJoinRequest(requestId: string): Promise<void> {
  const { error } = await getSupabase().rpc('cancel_project_join_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function leaveProject(projectId: string): Promise<void> {
  const { error } = await getSupabase().rpc('leave_project', {
    p_project_id: projectId,
  });
  if (error) throw error;
}

export type ProjectEditInput = {
  name: string;
  description: string;
  objective: string;
  maxMembers: number;
  duration: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  composition: Array<{ role: string; amount: number }>;
  technologies: string[];
  areas: string[];
};

export async function updateProject(projectId: string, input: ProjectEditInput): Promise<void> {
  const { error } = await getSupabase().rpc('update_project_with_plan', {
    p_project_id: projectId,
    p_name: input.name.trim(),
    p_description: input.description.trim(),
    p_objective: input.objective.trim(),
    p_max_members: input.maxMembers,
    p_duration: input.duration.trim(),
    p_composition: input.composition,
    p_technologies: input.technologies,
    p_areas: input.areas,
    p_start: input.plannedStartDate || null,
    p_end: input.plannedEndDate || null,
  });
  if (error) throw error;
}

export async function resubmitProject(projectId: string): Promise<void> {
  const { error } = await getSupabase().rpc('resubmit_project', {
    p_project_id: projectId,
  });
  if (error) throw error;
}

export async function transitionProject(
  projectId: string,
  targetStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED',
  details: {
    repositoryUrl?: string;
    demoUrl?: string;
    completionSummary?: string;
    cancellationReason?: string;
  } = {},
): Promise<void> {
  const { error } = await getSupabase().rpc('transition_project', {
    p_project_id: projectId,
    p_target_status: targetStatus,
    p_repository_url: details.repositoryUrl?.trim() || null,
    p_demo_url: details.demoUrl?.trim() || null,
    p_completion_summary: details.completionSummary?.trim() || null,
    p_cancellation_reason: details.cancellationReason?.trim() || null,
  });
  if (error) throw error;
}

export type ProjectDiscordReadiness = {
  readyCount: number;
  memberCount: number;
  members: Array<{
    userId: string;
    name: string;
    avatarUrl: string;
    role: string;
    discordConnected: boolean;
  }>;
};

export async function getProjectDiscordReadiness(
  projectId: string,
): Promise<ProjectDiscordReadiness> {
  const { data, error } = await getSupabase().rpc('get_project_discord_readiness', {
    p_project_id: projectId,
  });
  if (error) throw error;
  return data as ProjectDiscordReadiness;
}

export async function getMyGamification(): Promise<GamificationProgress> {
  const { data, error } = await getSupabase().rpc('get_my_gamification');
  if (error) throw error;
  if (
    !data ||
    !Number.isFinite(data.points) ||
    !Number.isFinite(data.level) ||
    !Number.isFinite(data.currentLevelPoints) ||
    !(data.nextLevelPoints === null || Number.isFinite(data.nextLevelPoints)) ||
    !Array.isArray(data.achievements) ||
    data.achievements.some(
      (item: unknown) =>
        !item ||
        typeof item !== 'object' ||
        !('code' in item) ||
        typeof item.code !== 'string' ||
        !('name' in item) ||
        typeof item.name !== 'string' ||
        !('description' in item) ||
        typeof item.description !== 'string',
    )
  ) {
    throw new Error('Progresso indisponível.');
  }
  return data as GamificationProgress;
}
