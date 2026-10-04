// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDetail } from './ProjectDetail';
import { DiscordSection } from '../profile/DiscordSection';
import { ProjectDiscordSection } from './ProjectDiscordSection';
import { useDiscordIntegration } from '../../services/useDiscordIntegration';
import { friendlyDiscordError } from '../../services/authService';
import type { ProjectDisplay } from '../../types';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  linkIdentity: vi.fn(),
  signInWithOAuth: vi.fn(),
  getUserIdentities: vi.fn(),
  getOwnDiscordIntegration: vi.fn(),
  getProjectDiscordIntegration: vi.fn(),
  getProjectDiscordLink: vi.fn(),
  getProjectDiscordReadiness: vi.fn(),
  getDiscordMembership: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({ getSupabase: () => ({ auth: mocks }) }));
vi.mock('../../services/discordService', () => ({
  getOwnDiscordIntegration: mocks.getOwnDiscordIntegration,
  getProjectDiscordIntegration: mocks.getProjectDiscordIntegration,
  getProjectDiscordLink: mocks.getProjectDiscordLink,
  getDiscordMembership: mocks.getDiscordMembership,
  requestDiscordResync: vi.fn(),
  retryDiscordEvent: vi.fn(),
}));
vi.mock('../../services/projectService', () => ({
  getProjectDiscordReadiness: mocks.getProjectDiscordReadiness,
}));

const project: ProjectDisplay = {
  id: 'project',
  kind: 'project',
  status: 'FORMING',
  moderationStatus: 'APPROVED',
  ownerId: 'email-user',
  name: 'Projeto',
  shortDescription: 'Escopo',
  category: 'Web',
  memberLimit: 5,
  suggestedTechnologies: [],
  recommendedAreas: [],
  difficulty: 'Iniciante',
  suggestedDuration: '',
  type: 'Community Project',
  suggestedRoles: [],
  possibleStacks: [],
  outcomes: [],
  members: [
    {
      memberId: 'email-user',
      name: 'Julio',
      avatarUrl: '',
      role: 'QA',
      contributionIntent: '',
      joinedAt: '',
    },
  ],
};
let connected = false;
let username: string | null = 'julio';

function Flow({ profile = false, revision = 0 }: { profile?: boolean; revision?: number }) {
  const discord = useDiscordIntegration('email-user', revision, profile);
  if (profile) return <DiscordSection connection={discord} />;
  return (
    <ProjectDetail
      project={project}
      profileId="email-user"
      discordConnected={discord.connected}
      discord={discord}
      canManageDiscord={false}
      discordRefresh={0}
      onConnectDiscord={() => void discord.connect()}
      onJoin={vi.fn()}
      onDecideJoinRequest={vi.fn()}
      onReuse={vi.fn()}
      onLeave={vi.fn()}
      onEdit={vi.fn()}
      onResubmit={vi.fn()}
      onTransition={vi.fn()}
      busy={false}
    />
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  connected = false;
  username = 'julio';
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/?project=project');
  const session = {
    user: { id: 'email-user' },
    expires_at: Date.now() / 1000 + 3600,
  };
  mocks.getSession.mockResolvedValue({ data: { session }, error: null });
  mocks.refreshSession.mockResolvedValue({ data: { session }, error: null });
  mocks.linkIdentity.mockResolvedValue({ error: null });
  mocks.getUserIdentities.mockImplementation(async () => ({
    data: {
      identities: connected
        ? [{ provider: 'email' }, { provider: 'discord' }]
        : [{ provider: 'email' }],
    },
    error: null,
  }));
  mocks.getOwnDiscordIntegration.mockImplementation(async () =>
    connected ? { provider_user_id: '123456789012345678', provider_username: username } : null,
  );
  mocks.getProjectDiscordIntegration.mockResolvedValue({ integration: null, failedEvent: null });
  mocks.getProjectDiscordLink.mockResolvedValue(null);
  mocks.getProjectDiscordReadiness.mockImplementation(async () => ({
    readyCount: connected ? 1 : 0,
    memberCount: 1,
    members: [
      {
        userId: 'email-user',
        name: 'Julio',
        avatarUrl: '',
        role: 'QA',
        discordConnected: connected,
      },
    ],
  }));
});
afterEach(cleanup);

describe('Discord identity linking UX', () => {
  it('links the email/password user from Project Detail and restores connected readiness after callback', async () => {
    const initial = render(
      <StrictMode>
        <Flow />
      </StrictMode>,
    );
    const connect = await screen.findByRole('button', {
      name: 'Conectar meu Discord',
    });
    await waitFor(() => expect((connect as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(connect);
    await waitFor(() =>
      expect(mocks.linkIdentity).toHaveBeenCalledWith({
        provider: 'discord',
        options: { redirectTo: window.location.href },
      }),
    );
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(
      (
        (await screen.findByRole('button', {
          name: 'Conectando...',
        })) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    initial.unmount();
    connected = true;
    render(
      <StrictMode>
        <Flow />
      </StrictMode>,
    );
    await screen.findByText('Discord conectado');
    expect(screen.getByText('@julio')).toBeTruthy();
    expect(screen.getByText('1/1 prontos')).toBeTruthy();
    expect(screen.queryByText('Discord não conectado')).toBeNull();
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(mocks.getUserIdentities).toHaveBeenCalled();
    expect(mocks.getOwnDiscordIntegration).toHaveBeenCalledWith('email-user');
    expect(window.location.search).toBe('?project=project');
  });

  it('does not offer a CTA to connect another member, even to the owner', async () => {
    connected = true;
    mocks.getProjectDiscordReadiness.mockResolvedValue({
      readyCount: 1,
      memberCount: 2,
      members: [
        { userId: 'email-user', name: 'Julio', discordConnected: true },
        { userId: 'other-user', name: 'Ana', discordConnected: false },
      ],
    });
    render(<Flow />);
    await screen.findByText('Precisa conectar o Discord');
    expect(screen.queryByRole('button', { name: 'Conectar meu Discord' })).toBeNull();
  });

  it('reloads readiness when Auth updates identities for the same user', async () => {
    const view = render(<Flow />);
    await screen.findByText('Conecte seu Discord para participar da squad.');
    connected = true;
    view.rerender(<Flow revision={1} />);
    await screen.findByText('Discord conectado');
    expect(screen.getByText('1/1 prontos')).toBeTruthy();
  });

  it('preserves the profile return destination and never exposes the Discord ID', async () => {
    window.history.replaceState(null, '', '/');
    const view = render(<Flow profile />);
    fireEvent.click(await screen.findByRole('button', { name: 'Conectar Discord' }));
    await waitFor(() =>
      expect(mocks.linkIdentity).toHaveBeenCalledWith({
        provider: 'discord',
        options: { redirectTo: `${window.location.origin}/?view=profile` },
      }),
    );
    view.unmount();
    connected = true;
    username = null;
    render(<Flow profile />);
    await screen.findByText('Conectado');
    expect(screen.queryByText(/123456789012345678/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Gerenciar' })).toBeTruthy();
  });

  it('shows a friendly cancellation and allows retry while keeping the existing session', async () => {
    window.sessionStorage.setItem('focusedu.discord-link-user', 'email-user');
    window.history.replaceState(
      null,
      '',
      '/?project=project#error=access_denied&error_description=raw_secret',
    );
    render(
      <StrictMode>
        <Flow />
      </StrictMode>,
    );
    await screen.findByText('Conexão cancelada. Você pode tentar novamente quando quiser.');
    expect(window.location.hash).toBe('');
    expect(screen.queryByText(/raw_secret/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(mocks.linkIdentity).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['identity_already_linked', 'já está vinculado'],
    ['identity_already_exists', 'outra conta'],
    ['provider_disabled', 'indisponível'],
    ['Failed to fetch', 'Verifique sua conexão'],
  ])('handles %s without showing the provider error', async (code, message) => {
    mocks.linkIdentity.mockResolvedValue({
      error: { code, message: 'raw_error' },
    });
    render(<Flow profile />);
    fireEvent.click(await screen.findByRole('button', { name: 'Conectar Discord' }));
    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(screen.queryByText(/raw_error/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
  });

  it('uses a friendly fallback for unknown errors', () => {
    expect(friendlyDiscordError(new Error('sensitive database error'))).not.toContain('sensitive');
  });

  it('retries a failed user-integration read without starting identity linking', async () => {
    mocks.getOwnDiscordIntegration
      .mockRejectedValueOnce(new Error('temporary read failure'))
      .mockResolvedValue({
        provider_user_id: '123456789012345678',
        provider_username: 'julio',
      });
    connected = true;
    render(<Flow profile />);
    await screen.findByText('Erro');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('Conectado');
    expect(mocks.linkIdentity).not.toHaveBeenCalled();
    expect(mocks.getOwnDiscordIntegration).toHaveBeenCalledTimes(2);
  });

  it('keeps user Discord connected while a pending project channel finishes syncing', async () => {
    mocks.getProjectDiscordIntegration
      .mockResolvedValueOnce({
        integration: {
          external_id: null,
          external_name: null,
          status: 'PENDING',
          member_count: 1,
          synced_count: 0,
          last_error: null,
          last_synced_at: null,
        },
        failedEvent: null,
      })
      .mockResolvedValue({
        integration: {
          external_id: 'channel-id',
          external_name: 'squad',
          status: 'ACTIVE',
          member_count: 1,
          synced_count: 1,
          last_error: null,
          last_synced_at: new Date().toISOString(),
        },
        failedEvent: null,
      });
    connected = true;
    function SplitState() {
      const connection = useDiscordIntegration('email-user', 0, false);
      return (
        <>
          <DiscordSection connection={connection} />
          <ProjectDiscordSection
            projectId="project"
            status="ACTIVE"
            started
            canManage
            refreshKey={0}
          />
        </>
      );
    }
    render(<SplitState />);
    await screen.findByText('Sincronização do canal pendente.');
    expect(screen.getByText('Conectado')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sincronizar canal' })).toBeTruthy();

    await screen.findByText('#squad', {}, { timeout: 4000 });
    expect(screen.getByText('Conectado')).toBeTruthy();
    expect(mocks.getProjectDiscordIntegration).toHaveBeenCalledTimes(2);
  });

  it('keeps user Discord connected when project-channel synchronization fails', async () => {
    mocks.getProjectDiscordIntegration.mockResolvedValue({
      integration: {
        external_id: 'channel-id',
        external_name: 'squad',
        status: 'FAILED',
        member_count: 1,
        synced_count: 0,
        last_error: 'discord unavailable',
        last_synced_at: null,
      },
      failedEvent: {
        id: 'event-id',
        status: 'FAILED',
        event_type: 'PROJECT_STARTED',
        attempts: 1,
        last_error: 'discord unavailable',
        retry_after: null,
        failure_kind: 'FINAL',
        last_attempted_at: new Date().toISOString(),
      },
    });
    connected = true;
    function SplitState() {
      const connection = useDiscordIntegration('email-user', 0, false);
      return (
        <>
          <DiscordSection connection={connection} />
          <ProjectDiscordSection
            projectId="project"
            status="ACTIVE"
            started
            canManage
            refreshKey={0}
          />
        </>
      );
    }
    render(<SplitState />);
    await screen.findByText(/Falha ao sincronizar Discord/);
    expect(screen.getByText('Conectado')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
  });
});
