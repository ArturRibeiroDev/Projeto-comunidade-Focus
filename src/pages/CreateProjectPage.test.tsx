// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { createDefaultProjectForm } from '../viewTypes';
import { todayIsoDate } from '../domain/projectSchedule';
import { CreateProjectPage } from './CreateProjectPage';
afterEach(cleanup);
it('keeps participation single-select, resets a removed role and starts on the local date', () => {
  function Form() {
    const [form, setForm] = useState(createDefaultProjectForm);
    return (
      <CreateProjectPage
        templates={[]}
        projectForm={form}
        onFormChange={setForm}
        onSubmit={vi.fn()}
        onReuseTemplate={vi.fn()}
        busy={false}
        areaOptions={['Backend', 'Cloud']}
      />
    );
  }
  render(<Form />);
  fireEvent.click(screen.getByRole('tab', { name: /Criar projeto comunitário/ }));
  expect((screen.getByLabelText('Data prevista de início') as HTMLInputElement).value).toBe(
    todayIsoDate(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar área' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Backend' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Cloud' }));
  const role = screen.getByLabelText('Sua função na squad') as HTMLSelectElement;
  expect(role.multiple).toBe(false);
  expect(Array.from(role.options).map((option) => option.value)).toEqual(['', 'Backend', 'Cloud']);
  fireEvent.change(role, { target: { value: 'Backend' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remover Backend' }));
  expect(role.value).toBe('');
  expect(screen.queryByRole('option', { name: 'Backend' })).toBeNull();
});
