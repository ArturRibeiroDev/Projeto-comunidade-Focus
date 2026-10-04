import { getSupabase } from '../lib/supabase';

export type ProjectDiscordIntegration = {
  external_id: string | null;
  external_name: string | null;
  status: 'PENDING' | 'ACTIVE' | 'READ_ONLY' | 'ARCHIVED' | 'FAILED';
  member_count: number;
  synced_count: number;
  last_error: string | null;
  last_synced_at: string | null;
};

export type DiscordEventStatus = {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  event_type: string;
  attempts: number;
  last_error: string | null;
  retry_after: string | null;
  failure_kind: 'RETRYABLE' | 'FINAL' | null;
  last_attempted_at: string | null;
};

export async function getOwnDiscordIntegration(userId: string) {
  const { data, error } = await getSupabase()
    .from('user_integrations')
    .select('provider_user_id,provider_username,provider_avatar')
    .eq('user_id', userId)
    .eq('provider', 'discord')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDiscordMembership(): Promise<{
  connected: boolean;
  inGuild: boolean | null;
}> {
  const { data, error } = await getSupabase().functions.invoke('discord-events', {
    body: { action: 'membership' },
  });
  if (error) throw error;
  return data as { connected: boolean; inGuild: boolean | null };
}

export async function getProjectDiscordIntegration(projectId: string) {
  const client = getSupabase();
  const [integration, events] = await Promise.all([
    client
      .from('project_integrations')
      .select(
        'external_id,external_name,status,member_count,synced_count,last_error,last_synced_at',
      )
      .eq('project_id', projectId)
      .eq('provider', 'discord')
      .maybeSingle(),
    client
      .from('integration_events')
      .select('id,status,event_type,attempts,last_error,retry_after,failure_kind,last_attempted_at')
      .eq('project_id', projectId)
      .eq('provider', 'discord')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);
  if (integration.error) throw integration.error;
  if (events.error) throw events.error;
  return {
    integration: integration.data as ProjectDiscordIntegration | null,
    pendingEvent:
      (events.data as DiscordEventStatus[]).find(
        (event) => event.status === 'PENDING' || event.status === 'PROCESSING',
      ) ?? null,
    failedEvent:
      (events.data as DiscordEventStatus[])[0]?.status === 'FAILED'
        ? (events.data as DiscordEventStatus[])[0]
        : null,
  };
}

export async function processDiscordEvents(projectId: string): Promise<void> {
  const { error } = await getSupabase().functions.invoke('discord-events', {
    body: { projectId },
  });
  if (error) throw error;
}

export async function getProjectDiscordLink(projectId: string): Promise<string | null> {
  const { data, error } = await getSupabase().functions.invoke('discord-events', {
    body: { action: 'project-link', projectId },
  });
  if (error) throw error;
  return (data as { url: string | null }).url;
}

export async function requestDiscordResync(projectId: string): Promise<void> {
  const { error } = await getSupabase().rpc('discord_request_resync', { p_project_id: projectId });
  if (error) throw error;
  await processDiscordEvents(projectId);
}

export async function retryDiscordEvent(eventId: string, projectId: string): Promise<void> {
  const { error } = await getSupabase().rpc('discord_retry_event', { p_event_id: eventId });
  if (error) throw error;
  await processDiscordEvents(projectId);
}
