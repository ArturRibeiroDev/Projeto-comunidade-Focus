// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ProjectDisplay } from '../../types';
import { JoinProjectModal } from './JoinProjectModal';

const project = {
  id: 'p1',
  kind: 'project',
  name: 'Squad',
  shortDescription: '',
  category: 'Web',
  memberLimit: 5,
  suggestedTechnologies: [],
  recommendedAreas: ['Backend', 'QA'],
  difficulty: 'Misto',
  suggestedDuration: '',
  type: 'Community Project',
  suggestedRoles: [],
  possibleStacks: [],
  outcomes: [],
  members: [],
} as ProjectDisplay;

afterEach(cleanup);

it('only submits an exact role offered by the selected project', () => {
  const onJoin = vi.fn();
  render(
    <JoinProjectModal
      project={project}
      open
      defaultRole="Outra"
      defaultIntent=""
      onClose={vi.fn()}
      onJoin={onJoin}
    />,
  );
  const role = screen.getByLabelText(/Função principal/) as HTMLSelectElement;
  expect(role.value).toBe('');
  expect(Array.from(role.options).map((option) => option.value)).toEqual(['', 'Backend', 'QA']);
  expect(screen.getByRole('button', { name: 'Solicitar entrada' }).hasAttribute('disabled')).toBe(
    true,
  );
  fireEvent.change(role, { target: { value: 'Backend' } });
  fireEvent.click(screen.getByRole('button', { name: 'Solicitar entrada' }));
  expect(onJoin).toHaveBeenCalledWith('p1', 'Backend', '');
});
