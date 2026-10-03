// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectPlanModal } from './ProjectPlanModal';

afterEach(cleanup);

it('requires the creator to choose a source-project area', async () => {
  const onCreate = vi.fn(async () => true);
  render(
    <ProjectPlanModal
      name="Biblioteca"
      areas={['Backend', 'QA']}
      busy={false}
      onClose={vi.fn()}
      onCreate={onCreate}
    />,
  );
  const role = screen.getByLabelText(/Sua função na squad/) as HTMLSelectElement;
  expect(role.value).toBe('');
  expect(Array.from(role.options).map((option) => option.value)).toEqual(['', 'Backend', 'QA']);
  const submit = screen.getByRole('button', { name: 'Criar projeto' });
  expect(submit.hasAttribute('disabled')).toBe(true);
  fireEvent.change(role, { target: { value: 'QA' } });
  fireEvent.click(submit);
  await waitFor(() => expect(onCreate).toHaveBeenCalledWith('QA', '', ''));
});
