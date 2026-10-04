// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthPage } from './AuthPage';

const auth = vi.hoisted(() => ({ updateUser: vi.fn(), signInWithOAuth: vi.fn() }));
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

test.each([
  ['Entrar', 'Entrar com Discord'],
  ['Criar conta', 'Criar conta com Discord'],
])('starts Discord OAuth from the %s tab', async (tab, label) => {
  auth.signInWithOAuth.mockResolvedValue({ error: null });
  render(<AuthPage />);
  if (tab === 'Criar conta') fireEvent.click(screen.getByRole('tab', { name: tab }));

  fireEvent.click(screen.getByRole('button', { name: label }));
  await waitFor(() =>
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'discord',
      options: { redirectTo: window.location.origin },
    }),
  );
});

test('shows the specific message when this Discord belongs to another account', async () => {
  auth.signInWithOAuth.mockResolvedValue({
    error: { code: 'identity_already_exists', message: 'identity conflict' },
  });
  render(<AuthPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Entrar com Discord' }));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe(
      'Este Discord já está conectado a outra conta do FocusAcademy.',
    ),
  );
});
