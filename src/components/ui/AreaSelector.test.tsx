// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { AreaSelector } from './AreaSelector';
import { Avatar } from './Avatar';
afterEach(cleanup);
it('selects canonical areas, removes chips, closes outside and supports keyboard', () => {
  function Form() {
    const [values, setValues] = useState<string[]>([]);
    return <AreaSelector options={['Backend', 'Cloud']} values={values} onChange={setValues} />;
  }
  render(<Form />);
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar área' }));
  const backend = screen.getByRole('checkbox', { name: 'Backend' });
  expect(document.activeElement).toBe(backend);
  fireEvent.click(backend);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Cloud' }));
  expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.keyDown(backend, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'Cloud' }));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Adicionar área' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remover Backend' }));
  expect(screen.queryByRole('button', { name: 'Remover Backend' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar área' }));
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('checkbox')).toBeNull();
});
it('does not offer arbitrary options and honors disabled', () => {
  render(<AreaSelector options={['QA']} values={[]} disabled onChange={vi.fn()} />);
  expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
});
it('shows initials for absent, unsafe or failed avatar images', () => {
  const view = render(<Avatar name="Ana Souza" />);
  expect(screen.getByLabelText('Avatar de Ana Souza').textContent).toBe('AS');
  view.rerender(<Avatar name="Ana Souza" src="https://example.com/avatar.png" />);
  fireEvent.error(view.container.querySelector('img')!);
  expect(screen.getByLabelText('Avatar de Ana Souza').textContent).toBe('AS');
  view.rerender(<Avatar name="Ana Souza" src="javascript:alert(1)" />);
  expect(view.container.querySelector('img')).toBeNull();
});
