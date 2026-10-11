import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  serve: vi.fn(),
  createChannel: vi.fn(),
  updateChannel: vi.fn(),
  putChannelPermission: vi.fn(),
}));
vi.mock('npm:@supabase/supabase-js@2', () => ({ createClient: () => mocks }));
vi.mock('./discord.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('./discord.ts')>();
  return {
    ...original,
    DiscordClient: class {
      botId = async () => 'bot';
      guildMember = async () => true;
      guildChannels = async () => [];
      createChannel = mocks.createChannel;
      updateChannel = mocks.updateChannel;
      putChannelPermission = mocks.putChannelPermission;
      sendMessage = async () => 'message';
    },
  };
});

type Row = Record<string, unknown>;
let integrations: Row[];
let queries: Array<{ table: string; operation: string; filters: Row; data?: Row }>;
let handler: (request: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-config' }, serve: mocks.serve });
  await import('./index.ts');
  handler = mocks.serve.mock.calls[0][0];
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  integrations = [];
  queries = [];
  mocks.createChannel
    .mockReset()
    .mockImplementation(async (_guild, name, _topic, _parent, _overwrites, type) => ({
      id: type === 2 ? 'new-voice' : 'new-text',
      name,
      type: type ?? 0,
    }));
  mocks.updateChannel.mockReset().mockResolvedValue(undefined);
  mocks.putChannelPermission.mockReset().mockResolvedValue(undefined);
  mocks.rpc.mockReset();
  mocks.from.mockReset().mockImplementation((table: string) => {
    const entry = {
      table,
      operation: 'select',
      filters: {} as Row,
      data: undefined as Row | undefined,
    };
    queries.push(entry);
    let ignoreDuplicates = false;
    const builder = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      eq: (key: string, value: unknown) => {
        entry.filters[key] = value;
        return builder;
      },
      is: (key: string, value: unknown) => {
        entry.filters[key] = value;
        return builder;
      },
      in: vi.fn().mockReturnThis(),
      update: (data: Row) => {
        entry.operation = 'update';
        entry.data = data;
        return builder;
      },
      upsert: (data: Row, options: { ignoreDuplicates?: boolean }) => {
        entry.operation = 'upsert';
        entry.data = data;
        ignoreDuplicates = Boolean(options.ignoreDuplicates);
        return builder;
      },
      then: (resolve: (result: { data: unknown; error: null }) => void) => {
        let data: unknown = [];
        if (table === 'projects') {
          data = { id: 'project', name: 'Same name', started_at: '2026-10-10', status: 'ACTIVE' };
        } else if (table === 'project_integrations') {
          if (entry.operation === 'upsert') {
            const existing = integrations.find(
              (row) => row.channel_kind === entry.data?.channel_kind,
            );
            if (existing) {
              if (!ignoreDuplicates) Object.assign(existing, entry.data);
            } else {
              integrations.push({
                id: String(integrations.length),
                external_id: null,
                voice_creation_started_at: null,
                ...entry.data,
              });
            }
          } else {
            const matched = integrations.filter((row) =>
              Object.entries(entry.filters).every(([key, value]) => row[key] === value),
            );
            if (entry.operation === 'update')
              matched.forEach((row) => Object.assign(row, entry.data));
            data = matched.map((row) => ({ ...row }));
          }
        }
        resolve({ data, error: null });
      },
    };
    return builder;
  });
});

function saved(channel_kind: string, external_id: string | null): Row {
  return {
    id: channel_kind,
    project_id: 'project',
    provider: 'discord',
    channel_kind,
    external_id,
    external_name: 'Same name',
    voice_creation_started_at: null,
    status: 'ACTIVE',
  };
}

async function runWorker() {
  mocks.rpc.mockResolvedValueOnce({
    data: [
      {
        id: 'event',
        project_id: 'project',
        attempts: 1,
        processing_token: 'token',
        event_type: 'DISCORD_RESYNC_REQUESTED',
        external_message_id: null,
      },
    ],
    error: null,
  });
  const response = await handler(
    new Request('https://local.test', {
      method: 'POST',
      headers: { 'x-focusedu-worker-secret': 'test-config', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'worker', limit: 1 }),
    }),
  );
  return response.json();
}

it('loads voice-only integrations without treating them as text', async () => {
  integrations.push(saved('DISCORD_VOICE_CHANNEL', 'saved-voice'));
  expect(await runWorker()).toMatchObject({ processed: 1 });
  expect(mocks.createChannel).toHaveBeenCalledTimes(1);
  expect(mocks.createChannel.mock.calls[0][5]).toBeUndefined();
  expect(integrations.find((row) => row.channel_kind === 'DISCORD_TEXT_CHANNEL')?.external_id).toBe(
    'new-text',
  );
  expect(
    integrations.find((row) => row.channel_kind === 'DISCORD_VOICE_CHANNEL')?.external_id,
  ).toBe('saved-voice');
});

it('reserves voice atomically and preserves that reservation through failure, retry and resync', async () => {
  integrations.push(saved('DISCORD_TEXT_CHANNEL', 'saved-text'));
  mocks.createChannel.mockRejectedValueOnce(new Error('remote result unknown'));
  expect(await runWorker()).toMatchObject({ failed: 1 });
  expect(integrations.every((row) => row.status === 'FAILED')).toBe(true);
  const voice = integrations.find((row) => row.channel_kind === 'DISCORD_VOICE_CHANNEL');
  expect(voice?.voice_creation_started_at).toEqual(expect.any(String));
  expect(voice?.external_id).toBeNull();
  expect(queries).toContainEqual(
    expect.objectContaining({
      table: 'project_integrations',
      operation: 'update',
      filters: {
        project_id: 'project',
        provider: 'discord',
        channel_kind: 'DISCORD_VOICE_CHANNEL',
        external_id: null,
        voice_creation_started_at: null,
      },
    }),
  );
  expect(await runWorker()).toMatchObject({ failed: 1, final: 1 });
  expect(mocks.createChannel).toHaveBeenCalledTimes(1);
  expect(integrations.find((row) => row.channel_kind === 'DISCORD_TEXT_CHANNEL')?.external_id).toBe(
    'saved-text',
  );
  Object.assign(voice!, { external_id: 'reconciled-voice' });
  expect(await runWorker()).toMatchObject({ processed: 1 });
  expect(mocks.createChannel).toHaveBeenCalledTimes(1);
  expect(integrations.every((row) => row.status === 'ACTIVE')).toBe(true);
});
