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
  external_id: 'channel',
  external_name: 'technical-squad-uuid',
  status: 'ACTIVE',
  member_count: 1,
  synced_count: 1,
  last_error: null,
  last_synced_at: null,
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
  mocks.get.mockReset().mockResolvedValue({ integration, failedEvent: null, pendingEvent: null });
  mocks.link.mockReset().mockResolvedValue('https://discord.com/channels/guild/channel');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('stops polling at synchronized state and preserves it after a transient read failure', async () => {
  const view = render(<ProjectDiscordSection {...props} />);
  await act(async () => {});
  expect(screen.getByText('Canal Discord ativo')).toBeTruthy();
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
  expect(screen.getByText('Canal Discord ativo')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
});

it.each(['PENDING', 'PROCESSING'])(
  'polls a %s event even when the channel already exists',
  async (status) => {
    mocks.get.mockResolvedValueOnce({ integration, failedEvent: null, pendingEvent: { status } });
    render(<ProjectDiscordSection {...props} />);
    await act(async () => {});
    expect(screen.getByText('Sincronizando canal Discord...')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(screen.getByText('Canal Discord ativo')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(mocks.get).toHaveBeenCalledTimes(2);
  },
);

it('offers retry for an incomplete terminal synchronization, not a stale failure on a synced channel', async () => {
  mocks.get.mockResolvedValueOnce({
    integration: { ...integration, synced_count: 0 },
    failedEvent: null,
  });
  const view = render(<ProjectDiscordSection {...props} />);
  await act(async () => {});
  expect(screen.getByRole('button', { name: 'Tentar sincronizar novamente' })).toBeTruthy();
  mocks.get.mockResolvedValue({
    integration: { ...integration, last_error: 'old error' },
    failedEvent: { status: 'FAILED' },
  });
  view.rerender(<ProjectDiscordSection {...props} refreshKey={1} />);
  await act(async () => {});
  expect(screen.getByText('Canal Discord ativo')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByText(/old error/)).toBeNull();
});

it('cancels pending timers when the drawer closes', async () => {
  mocks.get.mockResolvedValue({
    integration: { ...integration, status: 'PENDING' },
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

it('shows retry when the event fails before a channel record exists and stops polling', async () => {
  mocks.get.mockResolvedValue({
    integration: null,
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
  expect(screen.queryByText('Sincronizando canal Discord...')).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(mocks.get).toHaveBeenCalledTimes(1);
});
