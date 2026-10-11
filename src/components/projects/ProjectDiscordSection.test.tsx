// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProjectDiscordSection } from './ProjectDiscordSection';

const mocks = vi.hoisted(() => ({ get: vi.fn(), link: vi.fn() }));
vi.mock('../../services/discordService', () => ({
  getProjectDiscordIntegration: mocks.get,
  getProjectDiscordLink: mocks.link,
  requestDiscordResync: vi.fn(),
  retryDiscordEvent: vi.fn(),
}));
const integration = {
  channel_kind: 'DISCORD_TEXT_CHANNEL' as const,
  external_id: 'channel',
  external_name: 'technical-squad-uuid',
  status: 'ACTIVE',
  member_count: 1,
  synced_count: 1,
  last_error: null,
  last_synced_at: null,
};
const voiceIntegration = {
  ...integration,
  channel_kind: 'DISCORD_VOICE_CHANNEL' as const,
  external_id: 'voice-channel',
  external_name: 'technical-voice',
};
const props = {
  projectId: 'project',
  projectName: 'Delivery',
  status: 'ACTIVE' as const,
  started: true,
  canManage: true,
  refreshKey: 0,
};
beforeEach(() => {
  vi.useFakeTimers();
  mocks.get.mockReset().mockResolvedValue({
    integration,
    voiceIntegration,
    failedEvent: null,
    pendingEvent: null,
  });
  mocks.link.mockReset().mockResolvedValue('https://discord.com/channels/guild/channel');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('stops polling at synchronized state and preserves it after a transient read failure', async () => {
  const view = render(<ProjectDiscordSection {...props} />);
  await act(async () => {});
  expect(screen.getByText('Canais Discord ativos')).toBeTruthy();
  expect(screen.getByText('Delivery')).toBeTruthy();
  expect(screen.queryByText(/technical-squad/)).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(mocks.get).toHaveBeenCalledTimes(1);
  mocks.get.mockRejectedValue(new Error('temporary network error'));
  view.rerender(<ProjectDiscordSection {...props} refreshKey={1} />);
  await act(async () => {});
  expect(screen.getByText('Canais Discord ativos')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
});

it.each(['PENDING', 'PROCESSING'])(
  'polls a %s event even when the channel already exists',
  async (status) => {
    mocks.get.mockResolvedValueOnce({
      integration,
      voiceIntegration,
      failedEvent: null,
      pendingEvent: { status },
    });
    render(<ProjectDiscordSection {...props} />);
    await act(async () => {});
    expect(screen.getByText('Sincronizando canais Discord...')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(screen.getByText('Canais Discord ativos')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(mocks.get).toHaveBeenCalledTimes(2);
  },
);

it('offers retry for an incomplete terminal synchronization, not a stale failure on a synced channel', async () => {
  mocks.get.mockResolvedValueOnce({
    integration: { ...integration, synced_count: 0 },
    voiceIntegration,
    failedEvent: null,
  });
  const view = render(<ProjectDiscordSection {...props} />);
  await act(async () => {});
  expect(screen.getByRole('button', { name: 'Tentar sincronizar novamente' })).toBeTruthy();
  mocks.get.mockResolvedValue({
    integration: { ...integration, last_error: 'old error' },
    voiceIntegration,
    failedEvent: { status: 'FAILED' },
  });
  view.rerender(<ProjectDiscordSection {...props} refreshKey={1} />);
  await act(async () => {});
  expect(screen.getByText('Canais Discord ativos')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByText(/old error/)).toBeNull();
});

it('cancels pending timers when the drawer closes', async () => {
  mocks.get.mockResolvedValue({
    integration: { ...integration, status: 'PENDING' },
    voiceIntegration,
    failedEvent: null,
  });
  const view = render(<ProjectDiscordSection {...props} />);
  await act(async () => {});
  view.unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(mocks.get).toHaveBeenCalledTimes(1);
});

it('does not show synchronized channels when text is 4/4 and voice is 1/4', async () => {
  mocks.get.mockResolvedValue({
    integration: { ...integration, member_count: 4, synced_count: 4 },
    voiceIntegration: { ...voiceIntegration, member_count: 4, synced_count: 1 },
    failedEvent: null,
    pendingEvent: null,
  });
  render(<ProjectDiscordSection {...props} />);
  await act(async () => {});
  expect(screen.queryByText('Canais Discord ativos')).toBeNull();
  expect(screen.queryByText('Canal de voz privado sincronizado.')).toBeNull();
  expect(screen.getByText('Voz: 1 de 4 membros sincronizados')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Tentar sincronizar novamente' })).toBeTruthy();
});

it.each([integration, null])(
  'shows voice failure and retry even without a failed event (%j)',
  async (text) => {
    mocks.get.mockResolvedValue({
      integration: text,
      voiceIntegration: {
        ...voiceIntegration,
        status: 'FAILED',
        last_error: 'voice permission failed',
      },
      failedEvent: null,
      pendingEvent: null,
    });
    render(<ProjectDiscordSection {...props} />);
    await act(async () => {});
    expect(screen.getByText(/Falha ao sincronizar Discord.*voice permission failed/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar sincronizar novamente' })).toBeTruthy();
    expect(screen.queryByText('Canais Discord ativos')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  },
);

it('polls pending voice with text already active and stops when both are synchronized', async () => {
  mocks.get.mockResolvedValueOnce({
    integration,
    voiceIntegration: { ...voiceIntegration, status: 'PENDING' },
    failedEvent: null,
    pendingEvent: null,
  });
  render(<ProjectDiscordSection {...props} />);
  await act(async () => {});
  expect(screen.getByText('Sincronizando canais Discord...')).toBeTruthy();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2500);
  });
  expect(screen.getByText('Canais Discord ativos')).toBeTruthy();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(mocks.get).toHaveBeenCalledTimes(2);
});

it('shows retry when the event fails before a channel record exists and stops polling', async () => {
  mocks.get.mockResolvedValue({
    integration: null,
    voiceIntegration: null,
    failedEvent: {
      id: 'failed',
      status: 'FAILED',
      attempts: 1,
      last_error: 'failed',
      retry_after: null,
    },
  });
  render(<ProjectDiscordSection {...props} />);
  await act(async () => {});
  expect(screen.getByRole('button', { name: 'Tentar sincronizar novamente' })).toBeTruthy();
  expect(screen.queryByText('Sincronizando canais Discord...')).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(mocks.get).toHaveBeenCalledTimes(1);
});
