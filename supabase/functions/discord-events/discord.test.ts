import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  channelName,
  channelTopic,
  channelOverwrites,
  DiscordApiError,
  DiscordClient,
  type DiscordChannel,
} from './discord.ts';
import { DiscordSyncError, processDiscordEvent, type ProcessContext } from './processor.ts';
import {
  classifyDiscordEventFailure,
  nextDiscordRetryAt,
  type ClassifiedDiscordFailure,
} from './retryPolicy.ts';

const projectId = 'a31f1234-1111-4111-8111-123456789abc';
const connectedDiscordId = '111111111111111111';
const missingDiscordId = '222222222222222222';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function context(overrides: Partial<ProcessContext> = {}) {
  const api = {
    guildChannels: vi.fn(async (_guild: string): Promise<DiscordChannel[]> => []),
    guildMember: vi.fn(async (_guild: string, id: string) => id !== missingDiscordId),
    createChannel: vi.fn(async (...args: Parameters<ProcessContext['api']['createChannel']>) => ({
      id: 'channel-1',
      name: args[1],
      type: 0,
    })),
    updateChannel: vi.fn(async () => {}),
    putChannelPermission: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => 'message-1'),
  };
  const saveIntegration = vi.fn(async () => {});
  const saveMessageId = vi.fn(async () => {});
  const value: ProcessContext = {
    guildId: 'guild',
    activeCategoryId: 'active',
    archiveCategoryId: 'archive',
    appUrl: 'https://focus.example',
    botId: 'bot',
    project: {
      id: projectId,
      name: 'Sistema de Autenticação',
      status: 'ACTIVE',
      started_at: '2026-09-28',
      repository_url: null,
      demo_url: null,
      completion_summary: null,
      cancellation_reason: null,
    },
    members: [
      { name: 'Artur', role: 'Backend', discordId: connectedDiscordId },
      { name: 'Maria', role: 'QA', discordId: missingDiscordId },
      { name: 'João', role: 'UX', discordId: null },
    ],
    integration: { external_id: null, external_name: null },
    event: { id: 'event-1', event_type: 'PROJECT_STARTED', external_message_id: null },
    api,
    saveIntegration,
    saveMessageId,
    ...overrides,
  };
  return { value, api, saveIntegration, saveMessageId };
}

async function captureSyncError(value: ProcessContext): Promise<DiscordSyncError> {
  try {
    await processDiscordEvent(value);
  } catch (error) {
    expect(error).toBeInstanceOf(DiscordSyncError);
    return error as DiscordSyncError;
  }
  throw new Error('Expected Discord sync error');
}

describe('Discord channel mapping', () => {
  it('creates a stable sanitized name', () => {
    expect(channelName('Sistema de Autenticação!')).toBe('squad-sistema-de-autenticacao');
    expect(channelName('Dashboard de Dados Públicos')).toBe('squad-dashboard-de-dados-publicos');
    expect(channelName('Sistema Financeiro Pessoal')).toBe('squad-sistema-financeiro-pessoal');
    expect(channelName('  Áreas --- & Dados  ')).toBe('squad-areas-dados');
    expect(channelName('***')).toBe('squad-projeto');
    expect(channelName('x'.repeat(200)).length).toBe(100);
    expect(channelName('x'.repeat(93) + '-resto')).toBe(`squad-${'x'.repeat(93)}`);
  });

  it('keeps everyone private and members read-only when archived', () => {
    const overwrites = channelOverwrites(
      'guild',
      'bot',
      [connectedDiscordId, connectedDiscordId],
      true,
    );
    expect(overwrites).toHaveLength(3);
    expect(overwrites[0]).toMatchObject({ id: 'guild', type: 0, deny: '1024' });
    expect(overwrites[2]).toMatchObject({
      id: connectedDiscordId,
      type: 1,
      allow: '66560',
      deny: '2048',
    });
  });
});

describe('Discord event processing', () => {
  it('creates one private channel, syncs the connected guild member, and sends the first message', async () => {
    const { value, api, saveIntegration } = context();
    await processDiscordEvent(value);
    expect(api.createChannel).toHaveBeenCalledTimes(1);
    expect(api.createChannel.mock.calls[0][1]).toBe('squad-sistema-de-autenticacao');
    expect(api.createChannel.mock.calls[0][1]).not.toContain(projectId.slice(0, 8));
    expect(api.createChannel.mock.calls[0][2]).toBe(channelTopic(projectId));
    expect(api.createChannel.mock.calls[0][4]).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'guild', deny: '1024' })]),
    );
    expect(api.createChannel.mock.calls[0][4]).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: connectedDiscordId })]),
    );
    expect(api.guildMember).toHaveBeenCalledWith('guild', connectedDiscordId);
    expect(api.putChannelPermission).toHaveBeenCalledWith(
      'channel-1',
      expect.objectContaining({
        id: connectedDiscordId,
        type: 1,
        allow: '68608',
        deny: '0',
      }),
    );
    expect(api.putChannelPermission).not.toHaveBeenCalledWith(
      'channel-1',
      expect.objectContaining({ id: missingDiscordId }),
    );
    expect(saveIntegration).toHaveBeenLastCalledWith(
      expect.objectContaining({
        external_id: 'channel-1',
        external_name: 'squad-sistema-de-autenticacao',
        status: 'ACTIVE',
        member_count: 3,
        synced_count: 1,
        last_error: expect.stringContaining('no_discord_integration:1'),
      }),
    );
    expect(saveIntegration).toHaveBeenLastCalledWith(
      expect.objectContaining({ last_error: expect.stringContaining('not_in_guild:1') }),
    );
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    expect(api.updateChannel.mock.invocationCallOrder[0]).toBeLessThan(
      api.sendMessage.mock.invocationCallOrder[0],
    );
  });

  it('reuses the saved channel on resync without creating or posting', async () => {
    const { value, api, saveIntegration } = context({
      integration: {
        external_id: 'existing',
        external_name: 'squad-sistema-de-autenticacao-a31f1234',
      },
      event: { id: 'event-2', event_type: 'DISCORD_RESYNC_REQUESTED', external_message_id: null },
    });
    await processDiscordEvent(value);
    expect(api.createChannel).not.toHaveBeenCalled();
    expect(api.guildChannels).not.toHaveBeenCalled();
    expect(api.updateChannel).toHaveBeenCalledWith('existing', 'active', channelTopic(projectId));
    expect(saveIntegration).toHaveBeenLastCalledWith(
      expect.objectContaining({
        external_id: 'existing',
        external_name: 'squad-sistema-de-autenticacao-a31f1234',
      }),
    );
    expect(api.putChannelPermission).toHaveBeenCalledWith(
      'existing',
      expect.objectContaining({ id: connectedDiscordId, type: 1 }),
    );
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('recovers a channel after a crash before database persistence', async () => {
    const { value, api, saveIntegration } = context();
    api.guildChannels.mockResolvedValueOnce([
      {
        id: 'other-project',
        name: 'squad-sistema-de-autenticacao',
        type: 0,
        parent_id: 'active',
        topic: 'FocusAcademy project:another-project',
      },
      {
        id: 'recovered',
        name: 'squad-sistema-de-autenticacao-a31f1234',
        type: 0,
        parent_id: 'active',
        topic: `FocusEdu project:${projectId}`,
      },
    ]);
    await processDiscordEvent(value);
    expect(api.createChannel).not.toHaveBeenCalled();
    expect(api.updateChannel).toHaveBeenCalledWith('recovered', 'active', channelTopic(projectId));
    expect(saveIntegration).toHaveBeenLastCalledWith(
      expect.objectContaining({
        external_id: 'recovered',
        external_name: 'squad-sistema-de-autenticacao-a31f1234',
      }),
    );
  });

  it('reuses a newly created channel by external ID on the next sync', async () => {
    const { value, api, saveIntegration } = context();
    await processDiscordEvent(value);
    value.integration = {
      external_id: 'channel-1',
      external_name: 'squad-sistema-de-autenticacao',
    };
    value.event = {
      id: 'event-resync',
      event_type: 'DISCORD_RESYNC_REQUESTED',
      external_message_id: null,
    };
    await processDiscordEvent(value);
    expect(api.createChannel).toHaveBeenCalledTimes(1);
    expect(saveIntegration).toHaveBeenLastCalledWith(
      expect.objectContaining({
        external_id: 'channel-1',
        external_name: 'squad-sistema-de-autenticacao',
      }),
    );
  });

  it('does not create a channel for cancellation before start', async () => {
    const { value, api, saveIntegration } = context({
      project: { ...context().value.project, status: 'CANCELLED', started_at: null },
      event: { id: 'event-3', event_type: 'PROJECT_CANCELLED', external_message_id: null },
    });
    await processDiscordEvent(value);
    expect(api.createChannel).not.toHaveBeenCalled();
    expect(saveIntegration).toHaveBeenLastCalledWith(
      expect.objectContaining({ external_id: null }),
    );
  });

  it('moves archived channels and removes member send permission', async () => {
    const { value, api } = context({
      project: { ...context().value.project, status: 'ARCHIVED' },
      integration: { external_id: 'existing', external_name: 'squad-legado' },
      event: { id: 'event-4', event_type: 'PROJECT_ARCHIVED', external_message_id: null },
    });
    await processDiscordEvent(value);
    expect(api.updateChannel).toHaveBeenCalledWith('existing', 'archive', channelTopic(projectId));
    expect(api.putChannelPermission).toHaveBeenCalledWith(
      'existing',
      expect.objectContaining({ id: connectedDiscordId, type: 1, deny: '2048' }),
    );
  });

  it('does not repost an already recorded completion message', async () => {
    const { value, api } = context({
      integration: { external_id: 'existing', external_name: 'squad-legado' },
      event: { id: 'event-5', event_type: 'PROJECT_COMPLETED', external_message_id: 'sent' },
    });
    await processDiscordEvent(value);
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('fails the event when one member overwrite cannot be applied', async () => {
    const { value, api, saveIntegration } = context({
      members: [
        { name: 'Artur', role: 'Backend', discordId: connectedDiscordId },
        { name: 'Maria', role: 'QA', discordId: missingDiscordId },
      ],
    });
    api.guildMember.mockResolvedValue(true);
    api.putChannelPermission.mockImplementation(async (_channelId, overwrite) => {
      if (overwrite.id === missingDiscordId) throw new DiscordApiError(403);
    });

    const error = await captureSyncError(value);
    expect(error.message).toContain('overwrite_failed_403');
    expect(error.retryable).toBe(false);
    expect(saveIntegration).toHaveBeenLastCalledWith(
      expect.objectContaining({
        external_id: 'channel-1',
        status: 'FAILED',
        member_count: 2,
        synced_count: 1,
        last_error: expect.stringContaining('overwrite_failed_403:1'),
      }),
    );
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it('keeps Discord 429 overwrite failures retryable with Retry-After', async () => {
    const { value, api } = context({
      members: [{ name: 'Artur', role: 'Backend', discordId: connectedDiscordId }],
    });
    api.putChannelPermission.mockImplementation(async (_channelId, overwrite) => {
      if (overwrite.id === connectedDiscordId) throw new DiscordApiError(429, 45_000);
    });

    const error = await captureSyncError(value);
    expect(error.message).toContain('overwrite_failed_429');
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(45_000);
  });

  it('keeps transient guild validation errors retryable', async () => {
    const { value, api } = context({
      members: [{ name: 'Artur', role: 'Backend', discordId: connectedDiscordId }],
    });
    api.guildMember.mockRejectedValueOnce(new DiscordApiError(503));

    const error = await captureSyncError(value);
    expect(error.message).toContain('guild_check_failed_503');
    expect(error.retryable).toBe(true);
    expect(api.createChannel).not.toHaveBeenCalled();
  });

  it('keeps resync idempotent while reapplying the missing member overwrite', async () => {
    const { value, api } = context({
      integration: { external_id: 'existing', external_name: 'squad-legado' },
      event: { id: 'event-6', event_type: 'DISCORD_RESYNC_REQUESTED', external_message_id: null },
      members: [{ name: 'Artur', role: 'Backend', discordId: connectedDiscordId }],
    });

    await processDiscordEvent(value);
    await processDiscordEvent(value);

    const memberCalls = api.putChannelPermission.mock.calls.filter(
      ([, overwrite]) => overwrite.id === connectedDiscordId,
    );
    expect(api.createChannel).not.toHaveBeenCalled();
    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(memberCalls).toHaveLength(2);
    expect(memberCalls[0][1]).toEqual(memberCalls[1][1]);
  });
});

it('maps Discord rate limits without logging a response body', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response('secret response', {
        status: 429,
        headers: { 'retry-after': '2' },
      }),
  );
  const client = new DiscordClient('test-token', fetcher as typeof fetch);
  await expect(client.botId()).rejects.toMatchObject({
    status: 429,
    retryAfterMs: 2000,
  } satisfies Partial<DiscordApiError>);
});

it('uses a Discord-valid stable nonce for message retries', async () => {
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    Response.json({ id: 'message' }),
  );
  const client = new DiscordClient('test-token', fetcher as typeof fetch);
  await client.sendMessage('123', 'Hello', 'a31f1234-1111-4111-8111-123456789abc');
  const body = JSON.parse(fetcher.mock.calls[0][1]?.body as string);
  expect(body.nonce).toHaveLength(25);
  expect(body.enforce_nonce).toBe(true);
  expect(body.allowed_mentions).toEqual({ parse: [] });
});

it('edits member overwrites through the Discord permission endpoint', async () => {
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(null, { status: 204 });
  });
  const client = new DiscordClient('test-token', fetcher as typeof fetch);
  await client.putChannelPermission('channel-1', {
    id: connectedDiscordId,
    type: 1,
    allow: '68608',
    deny: '0',
  });

  expect(fetcher).toHaveBeenCalledWith(
    `https://discord.com/api/v10/channels/channel-1/permissions/${connectedDiscordId}`,
    expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ allow: '68608', deny: '0', type: 1 }),
    }),
  );
});

describe('Discord event retry policy', () => {
  const now = Date.UTC(2026, 9, 1, 12, 0, 0);

  it('treats Discord 429 as retryable and respects Retry-After', () => {
    const failure = classifyDiscordEventFailure(new DiscordApiError(429, 45_000));
    expect(failure).toMatchObject({ retryable: true, retryAfterMs: 45_000 });
    expect(nextDiscordRetryAt(failure, 1, now)).toBe('2026-10-01T12:00:45.000Z');
  });

  it('uses bounded backoff for transient failures', () => {
    const failure = classifyDiscordEventFailure(new DiscordApiError(503));
    expect(failure.retryable).toBe(true);
    expect(nextDiscordRetryAt(failure, 1, now)).toBe('2026-10-01T12:01:00.000Z');
    expect(nextDiscordRetryAt(failure, 2, now)).toBe('2026-10-01T12:05:00.000Z');
    expect(nextDiscordRetryAt(failure, 4, now)).toBe('2026-10-01T13:00:00.000Z');
  });

  it('does not retry permanent failures or events at max attempts', () => {
    const permanent = classifyDiscordEventFailure(new DiscordApiError(403));
    const transient: ClassifiedDiscordFailure = {
      message: 'Falha transitória',
      retryable: true,
      retryAfterMs: 0,
    };
    expect(permanent.retryable).toBe(false);
    expect(nextDiscordRetryAt(permanent, 1, now)).toBeNull();
    expect(nextDiscordRetryAt(transient, 5, now)).toBeNull();
  });
});
