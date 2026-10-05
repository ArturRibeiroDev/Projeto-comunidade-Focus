// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ProjectDisplay } from '../../types';
import { ProjectMembers } from './ProjectMembers';

const mocks = vi.hoisted(() => ({ remove: vi.fn(), role: vi.fn() }));
vi.mock('../../services/projectService', () => ({
  removeProjectMember: mocks.remove,
  updateMyProjectRole: mocks.role,
}));
const project: ProjectDisplay = {
  id: 'project',
  kind: 'project',
  name: 'Squad',
  shortDescription: '',
  category: '',
  status: 'FORMING',
  ownerId: 'owner',
  memberLimit: 5,
  suggestedTechnologies: [],
  recommendedAreas: ['Backend', 'Frontend'],
  difficulty: 'Misto',
  suggestedDuration: '',
  type: 'Community Project',
  suggestedRoles: [],
  possibleStacks: [],
  outcomes: [],
  members: ['owner', 'member'].map((id) => ({
    memberId: id,
    name: id,
    avatarUrl: '',
    role: 'Backend',
    contributionIntent: '',
    joinedAt: '',
  })),
};
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

it('opens a squad member using their public key, not their Auth identifier', () => {
  const onOpenMember = vi.fn();
  render(
    <ProjectMembers
      project={{
        ...project,
        members: project.members.map((member) => ({
          ...member,
          communityId: `public-${member.memberId}`,
        })),
      }}
      profileId="owner"
      onOpenMember={onOpenMember}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Ver perfil de member' }));
  expect(onOpenMember).toHaveBeenCalledWith('public-member');
  expect(screen.getByText('Responsável')).toBeTruthy();
});

it('confirms removal of another member and invalidates the squad after the RPC', async () => {
  const onMembersChanged = vi.fn(async () => {});
  render(
    <ProjectMembers project={project} profileId="owner" onMembersChanged={onMembersChanged} />,
  );
  expect(screen.queryByRole('button', { name: 'Remover owner da squad' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Remover member da squad' }));
  expect(screen.getByText('Remover member da squad?')).toBeTruthy();
  expect(mocks.remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
  await waitFor(() => expect(onMembersChanged).toHaveBeenCalledOnce());
  expect(mocks.remove).toHaveBeenCalledWith('project', 'member');
});

it.each(['owner', 'member'])(
  'lets %s change only their own participation role using project areas',
  async (profileId) => {
    const onMembersChanged = vi.fn(async () => {});
    render(
      <ProjectMembers
        project={project}
        profileId={profileId}
        onMembersChanged={onMembersChanged}
      />,
    );
    const select = screen.getByLabelText('Sua função na squad') as HTMLSelectElement;
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      '',
      'Backend',
      'Frontend',
    ]);
    fireEvent.change(select, { target: { value: 'Frontend' } });
    await waitFor(() => expect(onMembersChanged).toHaveBeenCalledOnce());
    expect(mocks.role).toHaveBeenCalledWith('project', 'Frontend');
    if (profileId === 'member') expect(screen.queryByRole('button')).toBeNull();
  },
);

it('hides all membership controls after ACTIVE', () => {
  render(<ProjectMembers project={{ ...project, status: 'ACTIVE' }} profileId="owner" />);
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
});

it('keeps the member visible and reports a failed mutation without claiming success', async () => {
  mocks.remove.mockRejectedValueOnce(new Error('PROJECT_NOT_FORMING'));
  const onMembersChanged = vi.fn();
  render(
    <ProjectMembers project={project} profileId="owner" onMembersChanged={onMembersChanged} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remover member da squad' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
  await screen.findByRole('alert');
  expect(screen.getByText('member', { exact: true })).toBeTruthy();
  expect(onMembersChanged).not.toHaveBeenCalled();
});
