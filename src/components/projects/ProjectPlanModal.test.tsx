// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectPlanModal } from './ProjectPlanModal';
import { todayIsoDate } from '../../domain/projectSchedule';

afterEach(cleanup);

it('defaults to local today and preserves edited dates when source areas are refreshed', () => {
  const props = { name: 'Idea', busy: false, onClose: vi.fn(), onCreate: vi.fn() };
  const view = render(<ProjectPlanModal {...props} areas={['QA']} />);
  const start = screen.getByLabelText('Data prevista de início') as HTMLInputElement;
  expect(start.value).toBe(todayIsoDate());
  expect((screen.getByLabelText('Data prevista de conclusão') as HTMLInputElement).value).toBe('');
  fireEvent.change(start, { target: { value: '2099-10-05' } });
  view.rerender(<ProjectPlanModal {...props} areas={['QA']} />);
  expect(start.value).toBe('2099-10-05');
});

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
  await waitFor(() => expect(onCreate).toHaveBeenCalledWith('QA', todayIsoDate(), ''));
});
