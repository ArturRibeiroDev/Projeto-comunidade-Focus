// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import App from './App';

vi.mock('./components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <main>
      <h1>Core ready</h1>
      {children}
    </main>
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
  getProjects: async () => [],
  getMyGamification: async () => {
    throw new Error('gamification backend unavailable');
  },
}));
afterEach(cleanup);

test('a gamification read failure does not block the authenticated application', async () => {
  render(<App />);
  await screen.findByRole('heading', { name: 'Core ready' });
  expect(screen.getByText('Dashboard ready')).toBeTruthy();
  expect(screen.queryByText('gamification backend unavailable')).toBeNull();
});
