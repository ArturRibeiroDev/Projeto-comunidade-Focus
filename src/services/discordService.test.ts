import { beforeEach, expect, it, vi } from 'vitest';
import { getProjectDiscordIntegration } from './discordService';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabase', () => ({ getSupabase: () => mocks }));

function query(data: object[]) {
  const result = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: object[]; error: null }) => void) =>
      resolve({ data, error: null }),
  };
  return result;
}

beforeEach(() => mocks.from.mockReset());

it('filters integrations and events by project and Discord before selecting channel kinds', async () => {
  const text = { channel_kind: 'DISCORD_TEXT_CHANNEL', external_id: 'text' };
  const voice = { channel_kind: 'DISCORD_VOICE_CHANNEL', external_id: 'voice' };
  const integrations = query([voice, text]);
  const events = query([]);
  mocks.from.mockImplementation((table) =>
    table === 'project_integrations' ? integrations : events,
  );
  const result = await getProjectDiscordIntegration('project');
  for (const request of [integrations, events]) {
    expect(request.eq).toHaveBeenCalledWith('project_id', 'project');
    expect(request.eq).toHaveBeenCalledWith('provider', 'discord');
  }
  expect(result.integration).toEqual(text);
  expect(result.voiceIntegration).toEqual(voice);
});

it('does not use a voice-only record as legacy text', async () => {
  const voice = { channel_kind: 'DISCORD_VOICE_CHANNEL', external_id: 'voice' };
  mocks.from.mockReturnValueOnce(query([voice])).mockReturnValueOnce(query([]));
  const result = await getProjectDiscordIntegration('project');
  expect(result.integration).toBeNull();
  expect(result.voiceIntegration).toEqual(voice);
});

it('keeps records without channel_kind as legacy text', async () => {
  const legacy = { external_id: 'legacy-text' };
  const voice = { channel_kind: 'DISCORD_VOICE_CHANNEL', external_id: 'voice' };
  mocks.from.mockReturnValueOnce(query([voice, legacy])).mockReturnValueOnce(query([]));
  const result = await getProjectDiscordIntegration('project');
  expect(result.integration).toEqual(legacy);
  expect(result.voiceIntegration).toEqual(voice);
});
