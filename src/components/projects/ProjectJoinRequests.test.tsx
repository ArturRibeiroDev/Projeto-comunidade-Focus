// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectJoinRequests } from './ProjectJoinRequests';
afterEach(cleanup);
it('lets the owner review a candidate profile without approving the request', () => {
  const open = vi.fn();
  const approve = vi.fn();
  render(
    <ProjectJoinRequests
      busy={false}
      onOpenMember={open}
      onApprove={approve}
      onReject={vi.fn()}
      requests={[
        {
          id: 'request',
          projectId: 'project',
          userId: 'private-auth-id',
          communityId: 'public-key',
          name: 'Maria Silva',
          avatarUrl: '',
          role: 'Frontend',
          bio: 'Praticando React',
          interests: ['APIs'],
          contributionIntent: '',
          status: 'PENDING',
          requestedAt: '2026-10-04',
          discordConnected: true,
          areas: ['Frontend'],
          technologies: ['React'],
        },
      ]}
    />,
  );
  expect(screen.getByText('Praticando React')).toBeTruthy();
  expect(screen.getByText('Função solicitada: Frontend')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ver perfil de Maria Silva' }));
  expect(open).toHaveBeenCalledWith('public-key');
  expect(approve).not.toHaveBeenCalled();
  expect(screen.queryByText('private-auth-id')).toBeNull();
});
