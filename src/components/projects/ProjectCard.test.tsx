// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ProjectCard } from './ProjectCard';
import type { MemberProfile, ProjectDisplay } from '../../types';

const profile: MemberProfile = {
  id: 'user',
  name: 'Ana',
  avatarUrl: '',
  bio: '',
  primaryRole: 'Backend',
  secondaryRoles: [],
  areas: ['Backend'],
  technologies: ['Node.js', 'PostgreSQL'],
  interests: [],
  availability: '',
  links: {},
  currentProjectIds: [],
  completedProjectIds: [],
  evidence: [],
};

const project: ProjectDisplay = {
  id: 'project',
  kind: 'project',
  name: 'API de Mentorias',
  shortDescription: 'Organiza mentorias da comunidade.',
  category: 'Comunidade',
  status: 'FORMING',
  moderationStatus: 'APPROVED',
  memberLimit: 5,
  suggestedTechnologies: ['Node.js', 'React'],
  recommendedAreas: ['Backend', 'Frontend'],
  difficulty: 'Intermediário',
  suggestedDuration: '',
  type: 'Community Project',
  suggestedRoles: [],
  possibleStacks: [],
  outcomes: [],
  members: [],
  ownerName: 'Lia',
};

it('shows project areas, technologies, owner, and profile context', () => {
  render(<ProjectCard onSelect={() => {}} profile={profile} project={project} />);
  expect(screen.getByText('Backend')).toBeTruthy();
  expect(screen.getByText('Node.js')).toBeTruthy();
  expect(screen.getByText('Owner: Lia')).toBeTruthy();
  expect(screen.getByText('Sua área combina com este projeto')).toBeTruthy();
  expect(screen.getByText('Ver projeto / solicitar entrada')).toBeTruthy();
});

it('omits profile context when there is no area or technology match', () => {
  render(
    <ProjectCard
      onSelect={() => {}}
      profile={{ ...profile, primaryRole: 'QA', areas: ['QA'], technologies: ['Cypress'] }}
      project={project}
    />,
  );
  expect(screen.queryByText('Sua área combina com este projeto')).toBeNull();
  expect(screen.queryByText(/Você já conhece/)).toBeNull();
});
