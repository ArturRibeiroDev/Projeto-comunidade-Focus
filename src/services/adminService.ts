import { getSupabase } from '../lib/supabase';
import { processDiscordEvents } from './discordService';
import type { PlatformAccount, ProjectStatus, ModerationStatus } from '../types';

export type AdminOverview = {
  users: number;
  forming: number;
  active: number;
  completed: number;
  pending: number;
  cancelled: number;
  suspended: number;
};
export type AdminDiscordOverview = {
  connectedUsers: number;
  connectedProjects: number;
  pendingEvents: number;
  processingEvents: number;
  completedEvents: number;
  retryableFailedEvents: number;
  finalFailedEvents: number;
  failedEvents: number;
  latestEvents: Array<{
    id: string;
    projectId: string;
    eventType: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    attempts: number;
    failureKind: 'RETRYABLE' | 'FINAL' | null;
    lastError: string | null;
    lastAttemptedAt: string | null;
    nextAttemptAt: string | null;
    createdAt: string;
  }>;
};
export type AdminUser = {
  user_id: string;
  name: string;
  avatar_url: string;
  email: string;
  platform_role: PlatformAccount['platform_role'];
  account_status: PlatformAccount['account_status'];
  created_at: string;
  active_projects: number;
  suspension_reason: string | null;
};
export type AdminProject = {
  id: string;
  name: string;
  owner_id: string;
  owner_name: string;
  origin: string;
  status: ProjectStatus;
  moderation_status: ModerationStatus;
  moderation_reason: string | null;
  members: number;
  created_at: string;
};
export type AdminSettings = {
  max_owned_open_projects_per_user: number;
  max_project_creations_per_day: number;
  max_projects_joined_simultaneously: number;
  updated_at: string;
};
export type AdminAudit = {
  id: string;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};
export type AdminTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  problem: string;
  objective: string;
  suggested_features: string[];
  acceptance_criteria: string[];
  difficulty: string;
  recommended_max_members: number;
  suggested_composition: Array<{ role: string; amount: number }>;
  possible_stacks: string[];
  outcomes: string[];
  audience: string;
  archived: boolean;
  official: boolean;
};

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) throw error;
  return data as T;
}

export async function getPlatformAccount(userId: string): Promise<PlatformAccount> {
  const { data, error } = await getSupabase()
    .from('platform_accounts')
    .select('user_id,platform_role,account_status,suspension_reason')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data as PlatformAccount;
}

export const getAdminOverview = () => rpc<AdminOverview>('admin_overview');
export const getAdminDiscordOverview = () => rpc<AdminDiscordOverview>('admin_discord_overview');
export const getAdminUsers = () => rpc<AdminUser[]>('admin_users');
export const getAdminProjects = () => rpc<AdminProject[]>('admin_projects');
export const getAdminTemplates = () => rpc<AdminTemplate[]>('admin_templates');
export const getAdminTemplateSkills = (id: string) =>
  rpc<{ technologies: string[]; areas: string[] }>('admin_template_skills', {
    p_template_id: id,
  });
export const getAdminSettings = () => rpc<AdminSettings>('admin_settings');
export const getAdminAudit = () => rpc<AdminAudit[]>('admin_audit_recent');
export const setAdminUser = (
  userId: string,
  role?: 'MEMBER' | 'MODERATOR',
  status?: 'ACTIVE' | 'SUSPENDED',
  reason?: string,
) =>
  rpc<void>('admin_set_user', {
    p_user_id: userId,
    p_role: role ?? null,
    p_status: status ?? null,
    p_reason: reason ?? null,
  });
export const moderateProject = async (
  projectId: string,
  decision: 'APPROVED' | 'REJECTED' | 'CANCELLED',
  reason?: string,
) => {
  await rpc<void>('moderate_project', {
    p_project_id: projectId,
    p_decision: decision,
    p_reason: reason ?? null,
  });
  if (decision === 'CANCELLED') void processDiscordEvents(projectId).catch(() => {});
};
export const updateAdminSettings = (
  settings: Pick<
    AdminSettings,
    | 'max_owned_open_projects_per_user'
    | 'max_project_creations_per_day'
    | 'max_projects_joined_simultaneously'
  >,
) =>
  rpc<void>('admin_update_settings', {
    p_owned: settings.max_owned_open_projects_per_user,
    p_daily: settings.max_project_creations_per_day,
    p_joined: settings.max_projects_joined_simultaneously,
  });
export const saveAdminTemplate = (id: string | null, data: Record<string, unknown>) =>
  rpc<string>('admin_save_template', { p_template_id: id, p_data: data });
export const setAdminTemplateArchived = (id: string, archived: boolean) =>
  rpc<void>('admin_set_template_archived', {
    p_template_id: id,
    p_archived: archived,
  });
