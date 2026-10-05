// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CommunityPage } from './CommunityPage';
import { PublicMemberDrawer } from '../components/profile/PublicMemberDrawer';
const mocks = vi.hoisted(() => ({ list: vi.fn(), profile: vi.fn() }));
vi.mock('../services/communityService', () => ({
  listCommunityMembers: mocks.list,
  getCommunityMember: mocks.profile,
}));
const member = {
  memberKey: 'public-key',
  name: 'Ana Souza',
  avatarUrl: '',
  primaryRole: 'QA',
  bio: 'Praticando APIs',
  interests: ['APIs'],
  areas: ['QA'],
  technologies: [],
};
beforeEach(() => {
  mocks.list.mockReset().mockResolvedValue({ members: [member], hasMore: true });
  mocks.profile.mockReset().mockResolvedValue({
    ...member,
    links: {},
    discordConnected: true,
    projects: [],
    evidence: [],
  });
});
afterEach(cleanup);
it('searches, filters, paginates and opens the selected public profile', async () => {
  const open = vi.fn();
  render(<CommunityPage areas={['QA']} refreshKey={0} onOpenMember={open} />);
  await screen.findByText('Ana Souza');
  fireEvent.click(screen.getByRole('button', { name: 'Ver perfil de Ana Souza' }));
  expect(open).toHaveBeenCalledWith('public-key');
  fireEvent.change(screen.getByLabelText('Buscar pessoa'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Área'), { target: { value: 'QA' } });
  fireEvent.change(screen.getByLabelText('Quero praticar'), { target: { value: 'APIs' } });
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith('Ana', 'QA', 'APIs', 0));
  await screen.findByText('Ana Souza');
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
  await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith('Ana', 'QA', 'APIs', 1));
});
it('refreshes a public profile after membership invalidation and on focus', async () => {
  const view = render(
    <PublicMemberDrawer memberKey="public-key" refreshKey={0} onClose={vi.fn()} />,
  );
  await screen.findByText('Ana Souza');
  mocks.profile.mockResolvedValue({
    ...member,
    name: 'Ana atualizada',
    links: {},
    discordConnected: true,
    projects: [{ name: 'Projeto novo', status: 'FORMING', role: 'QA' }],
    evidence: [],
  });
  view.rerender(<PublicMemberDrawer memberKey="public-key" refreshKey={1} onClose={vi.fn()} />);
  await screen.findByText('Ana atualizada');
  expect(screen.getByText('Projeto novo')).toBeTruthy();
  fireEvent.focus(window);
  await waitFor(() => expect(mocks.profile).toHaveBeenCalledTimes(3));
});
