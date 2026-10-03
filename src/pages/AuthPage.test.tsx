// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthPage } from './AuthPage';

const auth = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock('../lib/supabase', () => ({ getSupabase: () => ({ auth }) }));
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

test('recovery saves a new password through the existing Supabase session', async () => {
  auth.updateUser.mockResolvedValue({ error: null });
  const recovered = vi.fn();
  render(<AuthPage recovery onRecovered={recovered} />);
  expect(screen.queryByLabelText('E-mail')).toBeNull();
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'new-test-password' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar nova senha' }).closest('form')!);
  await waitFor(() => expect(recovered).toHaveBeenCalledOnce());
  expect(auth.updateUser).toHaveBeenCalledWith({ password: 'new-test-password' });
});

test('a rejected password update stays on recovery with a sanitized message', async () => {
  auth.updateUser.mockResolvedValue({ error: { message: 'internal-database-detail' } });
  const recovered = vi.fn();
  render(<AuthPage recovery onRecovered={recovered} />);
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'new-test-password' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Salvar nova senha' }).closest('form')!);
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe(
      'Não foi possível autenticar. Tente novamente.',
    ),
  );
  expect(recovered).not.toHaveBeenCalled();
  expect(screen.queryByText('internal-database-detail')).toBeNull();
});
