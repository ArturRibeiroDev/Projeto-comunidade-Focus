import {
  DiscordApiError,
  channelName,
  channelOverwrites,
  channelTopic,
  type ChannelOverwrite,
  type DiscordChannel,
} from './discord.ts';

export type DiscordEvent = {
  id: string;
  event_type:
    | 'PROJECT_STARTED'
    | 'PROJECT_COMPLETED'
    | 'PROJECT_CANCELLED'
    | 'PROJECT_ARCHIVED'
    | 'DISCORD_RESYNC_REQUESTED';
  external_message_id: string | null;
};

export type ProjectData = {
  id: string;
  name: string;
  status: string;
  started_at: string | null;
  repository_url: string | null;
  demo_url: string | null;
  completion_summary: string | null;
  cancellation_reason: string | null;
};

export type SquadMember = {
  name: string;
  role: string;
  discordId: string | null;
};

export type IntegrationData = {
  external_id: string | null;
  external_name: string | null;
};

export type ProcessContext = {
  guildId: string;
  activeCategoryId: string;
  archiveCategoryId: string;
  appUrl?: string;
  botId: string;
  project: ProjectData;
  members: SquadMember[];
  integration: IntegrationData;
  event: DiscordEvent;
  api: {
    guildChannels: (guildId: string) => Promise<DiscordChannel[]>;
    guildMember: (guildId: string, userId: string) => Promise<boolean>;
    createChannel: (
      guildId: string,
      name: string,
      topic: string,
      parentId: string,
      overwrites: ReturnType<typeof channelOverwrites>,
    ) => Promise<DiscordChannel>;
    updateChannel: (channelId: string, parentId: string, topic: string) => Promise<void>;
    putChannelPermission: (channelId: string, overwrite: ChannelOverwrite) => Promise<void>;
    sendMessage: (channelId: string, content: string, eventId: string) => Promise<string>;
  };
  saveIntegration: (data: {
    external_id: string | null;
    external_name: string | null;
    status: string;
    member_count: number;
    synced_count: number;
    last_error: string | null;
  }) => Promise<void>;
  saveMessageId: (id: string) => Promise<void>;
};

type SyncIssueReason =
  'no_discord_integration' | 'not_in_guild' | 'guild_check_failed' | 'overwrite_failed';

type SyncIssue = {
  reason: SyncIssueReason;
  status?: number;
  retryAfterMs?: number;
  retryable?: boolean;
};

type SyncReport = {
  projectMembers: number;
  discordIntegrations: number;
  guildMembers: number;
  overwritesApplied: number;
  issues: SyncIssue[];
};

export class DiscordSyncError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs = 0,
    public readonly retryable = true,
  ) {
    super(message);
  }
}

function clean(value: string | null | undefined, max = 160): string {
  return (value ?? '')
    .replace(/[\r\n\t@*_`~|>]/g, ' ')
    .trim()
    .slice(0, max);
}

function issueCounts(issues: SyncIssue[]): Record<string, number> {
  return issues.reduce<Record<string, number>>((counts, issue) => {
    const key = issue.status ? `${issue.reason}_${issue.status}` : issue.reason;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function diagnosticSummary(report: SyncReport): string | null {
  if (!report.issues.length) return null;
  const reasons = Object.entries(issueCounts(report.issues))
    .map(([reason, count]) => `${reason}:${count}`)
    .join(',');
  return [
    `Discord parcial: project_members=${report.projectMembers}`,
    `integrations=${report.discordIntegrations}`,
    `guild=${report.guildMembers}`,
    `overwrites=${report.overwritesApplied}`,
    `reasons=${reasons}`,
  ]
    .join('; ')
    .slice(0, 300);
}

function logDiagnostics(context: ProcessContext, report: SyncReport): string | null {
  const summary = diagnosticSummary(report);
  if (!summary) return null;
  console.warn('Discord sync diagnostic', {
    projectId: context.project.id,
    eventId: context.event.id,
    projectMembers: report.projectMembers,
    discordIntegrations: report.discordIntegrations,
    guildMembers: report.guildMembers,
    overwritesApplied: report.overwritesApplied,
    reasons: issueCounts(report.issues),
  });
  return summary;
}

function issueFromError(reason: SyncIssueReason, error: unknown): SyncIssue {
  if (error instanceof DiscordApiError) {
    return {
      reason,
      status: error.status,
      retryAfterMs: error.retryAfterMs,
      retryable: error.status === 429 || error.status === 408 || error.status >= 500,
    };
  }
  return { reason, retryable: true };
}

function retryAfter(issues: SyncIssue[]): number {
  return Math.max(0, ...issues.map((issue) => issue.retryAfterMs ?? 0));
}

function retryableFailure(issues: SyncIssue[]): boolean {
  return issues.every((issue) => issue.retryable !== false);
}

function projectLink(appUrl: string | undefined, projectId: string): string {
  if (!appUrl) return '';
  const url = new URL(appUrl);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') return '';
  url.searchParams.set('project', projectId);
  return url.toString();
}

function messageFor(context: ProcessContext): string | null {
  const { event, project, members } = context;
  const name = clean(project.name);
  if (event.event_type === 'PROJECT_STARTED') {
    const people = members.map((member) => `${clean(member.name)} - ${clean(member.role)}`);
    const link = projectLink(context.appUrl, project.id);
    return [
      `**Squad iniciada - ${name}**`,
      'Projeto iniciado pela FocusAcademy.',
      '',
      'Squad:',
      ...people,
      ...(link ? ['', `FocusAcademy: ${link}`] : []),
      '',
      'Usem este canal para a comunicação da squad.',
    ].join('\n');
  }
  if (event.event_type === 'PROJECT_COMPLETED') {
    return [
      `**Projeto concluído - ${name}**`,
      clean(project.completion_summary, 800),
      project.repository_url ? `Repositório: ${project.repository_url}` : '',
      project.demo_url ? `Demo: ${project.demo_url}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (event.event_type === 'PROJECT_CANCELLED') {
    return [
      `**Projeto cancelado - ${name}**`,
      clean(project.cancellation_reason, 800),
      'O canal agora é somente leitura.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  return null;
}

export async function processDiscordEvent(context: ProcessContext): Promise<void> {
  const { api, project, event, guildId, members } = context;
  const connectedIds = [
    ...new Set(members.map((member) => member.discordId).filter((id): id is string => Boolean(id))),
  ];
  const report: SyncReport = {
    projectMembers: members.length,
    discordIntegrations: members.filter((member) => Boolean(member.discordId)).length,
    guildMembers: 0,
    overwritesApplied: 0,
    issues: members
      .filter((member) => !member.discordId)
      .map(() => ({ reason: 'no_discord_integration' })),
  };
  const guildResults = await Promise.allSettled(
    connectedIds.map((id) => api.guildMember(guildId, id)),
  );
  const syncedIds = connectedIds.filter((_, index) => {
    const result = guildResults[index];
    if (result.status === 'fulfilled') {
      if (result.value) return true;
      report.issues.push({ reason: 'not_in_guild' });
      return false;
    }
    report.issues.push(issueFromError('guild_check_failed', result.reason));
    return false;
  });
  report.guildMembers = syncedIds.length;
  const readOnly = project.status === 'CANCELLED' || project.status === 'ARCHIVED';
  const archived = project.status === 'ARCHIVED';
  const categoryId = archived ? context.archiveCategoryId : context.activeCategoryId;
  const overwrites = channelOverwrites(guildId, context.botId, syncedIds, readOnly);
  const initialOverwrites = channelOverwrites(guildId, context.botId, [], readOnly);
  const baseOverwrites = overwrites.filter(
    (overwrite) => overwrite.id === guildId || overwrite.id === context.botId,
  );
  const memberOverwrites = overwrites.filter(
    (overwrite) => overwrite.type === 1 && overwrite.id !== context.botId,
  );
  let channelId = context.integration.external_id;
  let channelLabel = context.integration.external_name;

  if (report.issues.some((issue) => issue.reason === 'guild_check_failed')) {
    const summary = logDiagnostics(context, report) ?? 'Falha ao validar membros no Discord';
    await context.saveIntegration({
      external_id: channelId,
      external_name: channelLabel,
      status: 'FAILED',
      member_count: members.length,
      synced_count: 0,
      last_error: summary,
    });
    throw new DiscordSyncError(summary, retryAfter(report.issues), retryableFailure(report.issues));
  }

  if (!channelId) {
    const channels = await api.guildChannels(guildId);
    const recovered = channels.find(
      (channel) =>
        channel.type === 0 &&
        // Preserve recovery of channels created before the public brand changed.
        (channel.topic === channelTopic(project.id) ||
          channel.topic === `FocusEdu project:${project.id}`) &&
        [context.activeCategoryId, context.archiveCategoryId].includes(channel.parent_id ?? ''),
    );
    channelId = recovered?.id ?? null;
    channelLabel = recovered?.name ?? null;
  }

  const shouldCreate = Boolean(project.started_at) && event.event_type !== 'PROJECT_CANCELLED';
  if (!channelId && shouldCreate) {
    const created = await api.createChannel(
      guildId,
      channelName(project.name),
      channelTopic(project.id),
      categoryId,
      initialOverwrites,
    );
    channelId = created.id;
    channelLabel = created.name;
  }

  if (channelId) {
    await context.saveIntegration({
      external_id: channelId,
      external_name: channelLabel,
      status: 'PENDING',
      member_count: members.length,
      synced_count: 0,
      last_error: diagnosticSummary(report),
    });
    await api.updateChannel(channelId, categoryId, channelTopic(project.id));
    await Promise.all(
      baseOverwrites.map((overwrite) => api.putChannelPermission(channelId, overwrite)),
    );
    for (const overwrite of memberOverwrites) {
      try {
        await api.putChannelPermission(channelId, overwrite);
        report.overwritesApplied += 1;
      } catch (error) {
        report.issues.push(issueFromError('overwrite_failed', error));
      }
    }
    const diagnostic = logDiagnostics(context, report);
    if (report.issues.some((issue) => issue.reason === 'overwrite_failed')) {
      const summary = diagnostic ?? 'Falha ao aplicar permissões Discord';
      await context.saveIntegration({
        external_id: channelId,
        external_name: channelLabel,
        status: 'FAILED',
        member_count: members.length,
        synced_count: report.overwritesApplied,
        last_error: summary,
      });
      throw new DiscordSyncError(
        summary,
        retryAfter(report.issues),
        retryableFailure(report.issues),
      );
    }
    const content = messageFor(context);
    if (content && !event.external_message_id) {
      const messageId = await api.sendMessage(channelId, content, event.id);
      await context.saveMessageId(messageId);
    }
  } else {
    logDiagnostics(context, report);
  }

  await context.saveIntegration({
    external_id: channelId,
    external_name: channelLabel,
    status: archived ? 'ARCHIVED' : readOnly ? 'READ_ONLY' : channelId ? 'ACTIVE' : 'PENDING',
    member_count: members.length,
    synced_count: report.overwritesApplied,
    last_error: diagnosticSummary(report),
  });
}
