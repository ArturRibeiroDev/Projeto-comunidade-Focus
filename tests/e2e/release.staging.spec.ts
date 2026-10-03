import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing staging test configuration: ${name}`);
  return value;
}
async function apiIdentity(role: string) {
  const api = createClient(
    required('FOCUSEDU_E2E_SUPABASE_URL'),
    required('FOCUSEDU_E2E_PUBLIC_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await api.auth.signInWithPassword({
    email: required(`FOCUSEDU_E2E_${role}_EMAIL`),
    password: required(`FOCUSEDU_E2E_${role}_PASSWORD`),
  });
  if (error || !data.user) throw new Error(`Staging ${role} authentication failed`);
  return { api, userId: data.user.id };
}
async function login(page: Page, role: string) {
  await page.goto('/');
  await page.getByLabel('E-mail', { exact: true }).fill(required(`FOCUSEDU_E2E_${role}_EMAIL`));
  await page.getByLabel('Senha', { exact: true }).fill(required(`FOCUSEDU_E2E_${role}_PASSWORD`));
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeVisible();
}

test('staging: profile, create, request, approval, Discord readiness and ADMIN authorization', async ({
  browser,
}) => {
  if (
    required('FOCUSEDU_E2E_ENVIRONMENT') !== 'staging' ||
    required('FOCUSEDU_E2E_BASE_URL') !== required('FOCUSEDU_E2E_CONFIRMED_STAGING_URL')
  ) {
    throw new Error('Exact staging target confirmation required');
  }
  const owner = await apiIdentity('OWNER');
  const candidate = await apiIdentity('MEMBER');
  const admin = await apiIdentity('ADMIN');
  expect(new Set([owner.userId, candidate.userId, admin.userId]).size).toBe(3);
  for (const identity of [owner, candidate]) {
    const integration = await identity.api
      .from('user_integrations')
      .select('user_id')
      .eq('provider', 'discord');
    expect(integration.error).toBeNull();
    expect(
      integration.data?.length,
      'Owner and member must link real Discord accounts beforehand',
    ).toBe(1);
  }
  const denied = await candidate.api.rpc('admin_overview');
  expect(denied.error?.code).toBe('42501');
  expect((await admin.api.rpc('admin_overview')).error).toBeNull();

  const contexts = await Promise.all([
    browser.newContext({ baseURL: required('FOCUSEDU_E2E_BASE_URL') }),
    browser.newContext({ baseURL: required('FOCUSEDU_E2E_BASE_URL') }),
    browser.newContext({ baseURL: required('FOCUSEDU_E2E_BASE_URL') }),
  ]);
  let projectId: string | undefined;
  try {
    const [ownerPage, memberPage, adminPage] = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    await login(ownerPage, 'OWNER');
    await ownerPage.getByRole('button', { name: 'Perfil', exact: true }).click();
    await ownerPage.getByRole('button', { name: 'Editar perfil', exact: true }).click();
    const currentName = await ownerPage.locator('input[name="profile-name"]').inputValue();
    await ownerPage.locator('input[name="profile-name"]').fill(currentName);
    await ownerPage.getByRole('button', { name: /Salvar/ }).click();
    await ownerPage.getByRole('button', { name: 'Criar projeto', exact: true }).click();
    await ownerPage.getByRole('button', { name: 'Usar esta ideia' }).first().click();
    const created = ownerPage.waitForResponse(
      (response) =>
        response.url().endsWith('/rpc/create_planned_project_from_template') &&
        response.request().method() === 'POST',
    );
    await ownerPage
      .getByRole('dialog')
      .getByRole('button', { name: 'Criar projeto', exact: true })
      .click();
    const response = await created;
    expect(response.ok()).toBe(true);
    projectId = await response.json();
    expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
    await ownerPage.goto(`/?project=${projectId}`);
    await expect(ownerPage.getByRole('heading', { name: 'Discord da squad' })).toBeVisible();
    const readiness = await owner.api.rpc('get_project_discord_readiness', {
      p_project_id: projectId,
    });
    expect(readiness.error).toBeNull();
    expect(readiness.data.readyCount).toBe(readiness.data.memberCount);

    await login(memberPage, 'MEMBER');
    await expect(
      memberPage.getByRole('button', { name: 'Administração', exact: true }),
    ).toHaveCount(0);
    await memberPage.goto(`/?project=${projectId}`);
    await memberPage.getByRole('button', { name: 'Solicitar entrada', exact: true }).click();
    const requested = memberPage.waitForResponse(
      (response) =>
        response.url().endsWith('/rpc/request_project_join') &&
        response.request().method() === 'POST',
    );
    await memberPage
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: 'Solicitar entrada', exact: true })
      .click();
    expect((await requested).ok()).toBe(true);
    await ownerPage.reload();
    const approved = ownerPage.waitForResponse(
      (response) =>
        response.url().endsWith('/rpc/decide_project_join_request') &&
        response.request().method() === 'POST',
    );
    await ownerPage.getByRole('button', { name: 'Aprovar', exact: true }).click();
    expect((await approved).ok()).toBe(true);
    const membership = await candidate.api
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('user_id', candidate.userId);
    expect(membership.error).toBeNull();
    expect(membership.data).toHaveLength(1);
    const squadReady = await owner.api.rpc('get_project_discord_readiness', {
      p_project_id: projectId,
    });
    expect(squadReady.error).toBeNull();
    expect(squadReady.data.memberCount).toBe(2);
    expect(squadReady.data.readyCount).toBe(2);
    const unauthorizedCancel = await candidate.api.rpc('transition_project', {
      p_project_id: projectId,
      p_target_status: 'CANCELLED',
      p_cancellation_reason: 'Unauthorized',
    });
    expect(unauthorizedCancel.error?.code).toBe('42501');

    await login(adminPage, 'ADMIN');
    await adminPage.getByRole('button', { name: 'Administração', exact: true }).click();
    await expect(adminPage.getByText('Visão geral', { exact: true })).toBeVisible();
    await adminPage.goto(`/?project=${projectId}`);
    await adminPage.getByRole('button', { name: /Cancelar projeto/ }).click();
    await adminPage.getByLabel('Motivo do cancelamento').fill('Staging RC E2E cleanup');
    const cancelled = adminPage.waitForResponse(
      (response) =>
        response.url().endsWith('/rpc/transition_project') &&
        response.request().method() === 'POST',
    );
    await adminPage
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: 'Cancelar projeto', exact: true })
      .click();
    expect((await cancelled).ok()).toBe(true);
    const audit = await admin.api.rpc('admin_audit_recent');
    expect(audit.error).toBeNull();
    expect(
      audit.data.some(
        (row: { action: string; target_id: string }) =>
          row.action === 'PROJECT_ADMIN_CANCELLED' && row.target_id === projectId,
      ),
    ).toBe(true);
  } finally {
    let cleanupFailed = false;
    if (projectId) {
      const cancelled = await admin.api.rpc('transition_project', {
        p_project_id: projectId,
        p_target_status: 'CANCELLED',
        p_cancellation_reason: 'Staging RC E2E cleanup',
      });
      cleanupFailed = Boolean(cancelled.error);
    }
    await Promise.all(contexts.map((context) => context.close()));
    await Promise.all([owner, candidate, admin].map(({ api }) => api.auth.signOut()));
    if (cleanupFailed)
      throw new Error('E2E fixture cleanup failed; review staging project history');
  }
});
