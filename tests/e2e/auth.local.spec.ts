import { test, expect } from '@playwright/test';

test('auth: sanitized failures, recovery request and responsive layout', async ({ page }) => {
  await page.route('https://rc-test.invalid/auth/v1/token?*', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error_code: 'invalid_credentials',
        message: 'Internal SQL fixture must never be displayed',
      }),
    }),
  );
  await page.route('https://rc-test.invalid/auth/v1/recover*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entrar na Focus Academy' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar com Discord' })).toBeVisible();
  await page.getByLabel('E-mail', { exact: true }).fill('rc@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('invalid-test-password');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('E-mail ou senha incorretos.');
  await expect(page.getByText('Internal SQL fixture must never be displayed')).toHaveCount(0);
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByRole('status')).toHaveText('Verifique seu e-mail para continuar.');
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('button', { name: 'Enviar link' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/auth-${viewport.width}.png`, fullPage: true });
  }
});

test('OAuth callback error is sanitized and removed from URL', async ({ page }) => {
  await page.goto('/?error=access_denied&error_description=private-provider-detail');
  await expect(page.getByRole('status')).toHaveText('Não foi possível conectar ao Discord.');
  expect(page.url()).not.toContain('private-provider-detail');
  await expect(page.getByText('private-provider-detail')).toHaveCount(0);
});

test('Supabase recovery callback opens password update instead of the dashboard', async ({
  page,
}) => {
  const user = {
    id: '40000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'rc@example.test',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: '2026-10-02T00:00:00Z',
  };
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: user.id,
    role: user.role,
    aud: user.aud,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.local-fixture`;
  await page.route('https://rc-test.invalid/auth/v1/user', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    }),
  );
  await page.route('https://rc-test.invalid/rest/v1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    }),
  );
  await page.goto(
    `/#access_token=${token}&refresh_token=local-fixture&expires_in=3600&token_type=bearer&type=recovery`,
  );
  await expect(page.getByRole('heading', { name: 'Definir nova senha' })).toBeVisible();
  await page.getByLabel('Senha', { exact: true }).fill('new-staging-fixture-password');
  const update = page.waitForRequest(
    (request) => request.url().endsWith('/auth/v1/user') && request.method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  expect((await update).postDataJSON()).toMatchObject({ password: 'new-staging-fixture-password' });
  await expect(page.getByRole('heading', { name: 'Definir nova senha' })).toHaveCount(0);
});
