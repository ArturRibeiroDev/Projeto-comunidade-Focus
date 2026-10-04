// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Project, ProjectDisplay } from './types';
import type { View } from './viewTypes';
import App from './App';

const mocks = vi.hoisted(() => ({ getProjects: vi.fn() }));

vi.mock('./components/layout/AppShell', () => ({
  AppShell: ({
    children,
    onNavigate,
  }: {
    children: ReactNode;
    onNavigate: (view: View) => void;
  }) => (
    <main>
      <h1>Core ready</h1>
      <button onClick={() => onNavigate('catalog')}>Catalog</button>
      <button onClick={() => onNavigate('dashboard')}>Home</button>
      <button onClick={() => onNavigate('my-projects')}>My projects</button>
      {children}
    </main>
  ),
}));
vi.mock('./pages/CatalogPage', () => ({
  CatalogPage: ({ projects }: { projects: ProjectDisplay[] }) => (
    <>
      {projects.map((project) => (
        <p key={project.id}>{project.moderationStatus}</p>
      ))}
    </>
  ),
}));
vi.mock('./pages/DashboardPage', () => ({ DashboardPage: () => <p>Dashboard ready</p> }));
vi.mock('./services/authService', () => ({
  getSession: async () => ({ user: { id: 'rc-user' } }),
  watchSession: () => () => {},
  signOut: vi.fn(),
  friendlyAuthError: () => 'Auth unavailable',
}));
vi.mock('./services/useDiscordIntegration', () => ({
  useDiscordIntegration: () => ({ connected: false }),
}));
vi.mock('./services/templateService', () => ({ getTemplates: async () => [] }));
vi.mock('./services/evidenceService', () => ({ getEvidence: async () => [] }));
vi.mock('./services/profileService', () => ({
  getSkillSuggestions: async () => ({ technologies: [], areas: [] }),
  getProfile: async () => ({
    id: 'rc-user',
    name: 'RC User',
    primaryRole: 'QA',
    evidence: [],
    technologies: [],
    areas: [],
    interests: [],
    links: {},
  }),
  updateProfile: vi.fn(),
}));
vi.mock('./services/adminService', () => ({
  getPlatformAccount: async () => ({ platform_role: 'MEMBER', account_status: 'ACTIVE' }),
}));
vi.mock('./services/projectService', async (original) => ({
  ...(await original<typeof import('./services/projectService')>()),
  getProjects: mocks.getProjects,
  getMyGamification: async () => {
    throw new Error('gamification backend unavailable');
  },
}));
afterEach(cleanup);
beforeEach(() => {
  mocks.getProjects.mockReset().mockResolvedValue([]);
  window.history.replaceState(null, '', '/');
});

test('a gamification read failure does not block the authenticated application', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Core ready' });
  expect(screen.getByText('Dashboard ready')).toBeTruthy();
  expect(screen.queryByText('gamification backend unavailable')).toBeNull();
});

test.each(['APPROVED', 'REJECTED'] as const)(
  'navigation refreshes moderation PENDING -> %s without reload',
  async (status) => {
    const project: Project = {
      id: 'project',
      ownerId: 'rc-user',
      ownerName: 'RC User',
      name: 'Community',
      description: 'Test',
      category: 'Web',
      problem: '',
      objective: '',
      status: 'FORMING',
      moderationStatus: 'PENDING',
      origin: 'community',
      maxMembers: 5,
      duration: '',
      difficulty: 'Misto',
      technologies: [],
      relatedAreas: ['QA'],
      suggestedComposition: [],
      possibleStacks: [],
      outcomes: [],
      members: [
        {
          memberId: 'rc-user',
          name: 'RC User',
          avatarUrl: '',
          role: 'QA',
          contributionIntent: '',
          joinedAt: '',
        },
      ],
      joinRequests: [],
      createdAt: '',
      updatedAt: '',
    };
    mocks.getProjects.mockResolvedValue([project]);
    render(<App />);
    await screen.findByText('Dashboard ready');
    fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
    await screen.findByText('PENDING');
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await screen.findByText('Dashboard ready');
    const previousReads = mocks.getProjects.mock.calls.length;
    mocks.getProjects.mockResolvedValue([{ ...project, moderationStatus: status }]);
    fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
    await screen.findByText(status);
    expect(screen.queryByText('PENDING')).toBeNull();
    expect(mocks.getProjects.mock.calls.length).toBeGreaterThan(previousReads);
    const beforeFocus = mocks.getProjects.mock.calls.length;
    fireEvent.focus(window);
    await waitFor(() => expect(mocks.getProjects.mock.calls.length).toBeGreaterThan(beforeFocus));
    fireEvent.click(screen.getByRole('button', { name: 'My projects' }));
    await screen.findByRole('button', { name: 'Community' });
    expect(screen.queryByText('Aguardando revisão')).toBeNull();
    if (status === 'REJECTED') expect(screen.getByText('Projeto não aprovado')).toBeTruthy();
    const beforeOpen = mocks.getProjects.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Community' }));
    await screen.findByText(status);
    await waitFor(() => expect(mocks.getProjects.mock.calls.length).toBeGreaterThan(beforeOpen));
  },
);
