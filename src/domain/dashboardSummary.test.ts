import { describe, expect, it } from 'vitest';
import type { ProjectDisplay } from '../types';
import { summarizeDashboard } from './dashboardSummary';

const base: ProjectDisplay = {
  id: 'template',
  kind: 'template',
  name: 'Escopo Focus',
  shortDescription: 'Escopo',
  category: 'Web',
  memberLimit: 2,
  suggestedTechnologies: [],
  recommendedAreas: [],
  difficulty: 'Misto',
  suggestedDuration: '4 semanas',
  type: 'Focus Project',
  suggestedRoles: [],
  possibleStacks: [],
  outcomes: [],
  members: [],
};

describe('dashboard summary', () => {
  it('counts templates as available without treating them as active squads', () => {
    const summary = summarizeDashboard([base], 'user-a');
    expect(summary.availableProjects).toHaveLength(1);
    expect(summary.formingSquads).toHaveLength(0);
    expect(summary.activeProjects).toHaveLength(0);
    expect(summary.currentProjects).toHaveLength(0);
  });

  it('counts a real project separately and excludes full squads from availability', () => {
    const project: ProjectDisplay = {
      ...base,
      id: 'run',
      kind: 'project',
      type: 'Community Project',
      status: 'FORMING',
      moderationStatus: 'APPROVED',
      members: [
        {
          memberId: 'user-a',
          name: 'A',
          avatarUrl: '',
          role: 'QA',
          contributionIntent: '',
          joinedAt: '',
        },
        {
          memberId: 'user-b',
          name: 'B',
          avatarUrl: '',
          role: 'Backend',
          contributionIntent: '',
          joinedAt: '',
        },
      ],
    };
    const summary = summarizeDashboard([base, project], 'user-a');
    expect(summary.availableProjects.map((item) => item.id)).toEqual(['template']);
    expect(summary.formingSquads).toHaveLength(1);
    expect(summary.currentProjects).toHaveLength(1);
  });

  it('does not advertise ACTIVE or COMPLETED projects as vacancies', () => {
    const active: ProjectDisplay = {
      ...base,
      id: 'active',
      kind: 'project',
      type: 'Community Project',
      status: 'ACTIVE',
      moderationStatus: 'APPROVED',
      members: [],
    };
    const completed: ProjectDisplay = {
      ...active,
      id: 'done',
      status: 'COMPLETED',
    };
    const summary = summarizeDashboard([base, active, completed], 'user-a');
    expect(summary.availableProjects.map((item) => item.id)).toEqual(['template']);
    expect(summary.activeProjects.map((item) => item.id)).toEqual(['active']);
  });

  it('keeps pending owner work visible without advertising it publicly', () => {
    const pending: ProjectDisplay = {
      ...base,
      id: 'pending',
      kind: 'project',
      type: 'Community Project',
      status: 'FORMING',
      moderationStatus: 'PENDING',
      members: [
        {
          memberId: 'owner',
          name: 'A',
          avatarUrl: '',
          role: 'QA',
          contributionIntent: '',
          joinedAt: '',
        },
      ],
    };
    const summary = summarizeDashboard([base, pending], 'owner');
    expect(summary.currentProjects.map((item) => item.id)).toContain('pending');
    expect(summary.availableProjects.map((item) => item.id)).toEqual(['template']);
    expect(summary.formingSquads).toHaveLength(0);
  });
});
