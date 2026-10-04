// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminPage } from './AdminPage';

const mocks = vi.hoisted(() => ({ projects: vi.fn(), moderate: vi.fn() }));
vi.mock('../services/adminService', async (original) => ({
  ...(await original<typeof import('../services/adminService')>()),
  getAdminProjects: mocks.projects,
  moderateProject: mocks.moderate,
}));
beforeEach(() => {
  mocks.projects.mockReset().mockResolvedValue([
    {
      id: 'project',
      name: 'Community pending',
      owner_id: 'owner',
      owner_name: 'Owner',
      origin: 'community',
      status: 'FORMING',
      moderation_status: 'PENDING',
      moderation_reason: null,
      members: 1,
      created_at: '2026-10-04T12:00:00Z',
    },
  ]);
  mocks.moderate.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

it('invalidates shared data immediately after approval even while the admin refetch is pending', async () => {
  const changed = vi.fn();
  render(<AdminPage role="MODERATOR" onOpenProject={vi.fn()} onChanged={changed} />);
  await screen.findByText('Community pending');
  let resolve!: (value: []) => void;
  mocks.projects.mockReturnValueOnce(
    new Promise<[]>((done) => {
      resolve = done;
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  expect(mocks.moderate).toHaveBeenCalled();
  await act(async () => {
    resolve([]);
  });
});

it('refreshes moderation on focus without a global timer', async () => {
  render(<AdminPage role="MODERATOR" onOpenProject={vi.fn()} onChanged={vi.fn()} />);
  await screen.findByText('Community pending');
  mocks.projects.mockResolvedValue([]);
  fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByText('Community pending')).toBeNull());
  expect(mocks.projects).toHaveBeenCalledTimes(2);
});
