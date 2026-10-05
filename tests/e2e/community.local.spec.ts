import { expect, test, type Page } from '@playwright/test';

const owner = '40000000-0000-4000-8000-000000000001';
const ana = '40000000-0000-4000-8000-000000000002';
const maria = '40000000-0000-4000-8000-000000000003';
const profiles = [
  { id: owner, community_id: 'public-owner', name: 'Artur Ribeiro', main_role: 'Backend' },
  { id: ana, community_id: 'public-ana', name: 'Ana Souza', main_role: 'UX/UI' },
  { id: maria, community_id: 'public-maria', name: 'Maria Silva', main_role: 'Frontend' },
].map((profile) => ({
  ...profile,
  avatar_url: '',
  bio: 'Construindo APIs e integrações. Quero praticar com uma squad multidisciplinar.',
  interests: ['APIs', 'Integrações'],
  secondary_roles: [],
  availability: '6 horas/semana',
  github_url: 'https://github.com/',
  linkedin_url: 'https://www.linkedin.com/',
}));
const project = {
  id: 'local-project',
  owner_id: owner,
  name: 'Sistema de Delivery',
  description: 'Pedidos, entregas e integrações para pequenos negócios.',
  category: 'Web',
  problem: '',
  objective: '',
  status: 'FORMING',
  moderation_status: 'APPROVED',
  origin: 'template',
  max_members: 5,
  difficulty: 'Misto',
  duration: '',
  suggested_composition: [],
  possible_stacks: [],
  outcomes: ['MVP navegável'],
  created_at: '2026-10-04T12:00:00Z',
  updated_at: '2026-10-04T12:00:00Z',
};
const publicMember = (profile = profiles[1]) => ({
  memberKey: profile.community_id,
  name: profile.name,
  primaryRole: profile.main_role,
  avatarUrl: '',
  bio: profile.bio,
  areas: ['Backend', 'Frontend'],
  technologies: ['React'],
  interests: profile.interests,
});

async function fixture(page: Page) {
  const user = {
    id: owner,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'local@example.test',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: '2026-10-04T00:00:00Z',
  };
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: owner, role: user.role, aud: user.aud, exp: expiry })}.local-fixture`;
  await page.addInitScript(
    (session) => localStorage.setItem('sb-rc-test-auth-token', JSON.stringify(session)),
    {
      user,
      access_token: token,
      refresh_token: 'fixture',
      expires_at: expiry,
      expires_in: 3600,
      token_type: 'bearer',
    },
  );
  await page.route('https://rc-test.invalid/**', async (route) => {
    const url = new URL(route.request().url());
    const resource = url.pathname.split('/').pop();
    let body: unknown = [];
    if (url.pathname.includes('/auth/')) body = user;
    if (resource === 'profiles')
      body = url.searchParams.get('id')?.startsWith('eq.') ? profiles[0] : profiles;
    if (resource === 'skills')
      body = [
        { id: 'backend', name: 'Backend', kind: 'area' },
        { id: 'frontend', name: 'Frontend', kind: 'area' },
        { id: 'react', name: 'React', kind: 'technology' },
      ];
    if (resource === 'profile_skills')
      body = profiles.flatMap((profile) => [
        { profile_id: profile.id, skill_id: 'backend' },
        { profile_id: profile.id, skill_id: 'react' },
      ]);
    if (resource === 'projects') body = [project];
    if (resource === 'project_members')
      body = [owner, ana].map((id) => ({
        project_id: project.id,
        user_id: id,
        main_role: id === owner ? 'Backend' : 'Frontend',
        contribution_intent: '',
        joined_at: project.created_at,
      }));
    if (resource === 'project_areas')
      body = ['backend', 'frontend'].map((id) => ({ project_id: project.id, skill_id: id }));
    if (resource === 'platform_accounts')
      body = {
        user_id: owner,
        platform_role: 'MEMBER',
        account_status: 'ACTIVE',
        suspension_reason: null,
      };
    if (resource === 'user_integrations')
      body = [
        {
          user_id: owner,
          provider: 'discord',
          provider_username: 'artur',
          provider_user_id: 'local-fixture',
        },
      ];
    if (resource === 'project_join_requests')
      body = [
        {
          id: 'request',
          project_id: project.id,
          user_id: maria,
          main_role: 'Frontend',
          contribution_intent: 'Estou estudando React e quero praticar integração com APIs.',
          status: 'PENDING',
          requested_at: project.created_at,
        },
      ];
    if (resource === 'get_project_discord_readiness')
      body = {
        memberCount: 2,
        readyCount: 2,
        members: profiles.slice(0, 2).map((profile) => ({
          userId: profile.id,
          name: profile.name,
          avatarUrl: '',
          role: profile.main_role,
          discordConnected: true,
        })),
      };
    if (resource === 'get_my_gamification')
      body = {
        points: 100,
        level: 2,
        currentLevelPoints: 100,
        nextLevelPoints: 300,
        achievements: [],
      };
    if (resource === 'list_community_members')
      body = { members: profiles.slice(1).map(publicMember), hasMore: false };
    if (resource === 'get_community_member') {
      const requested = route.request().postDataJSON().p_member_key;
      body = {
        ...publicMember(profiles.find((profile) => profile.community_id === requested)),
        discordConnected: true,
        links: { github: 'https://github.com/' },
        projects: [{ name: project.name, status: 'FORMING', role: 'Frontend' }],
        evidence: [
          {
            projectName: project.name,
            kind: 'join',
            role: 'Frontend',
            recordedAt: project.created_at,
          },
        ],
      };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  await page.goto('/');
  await expect(page.locator('.topbar')).toBeVisible();
}

for (const width of [1440, 1024, 768, 390]) {
  test(`community UX at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await fixture(page);
    const navigate = async (name: string) => {
      const mobile = await page
        .getByRole('button', { name: 'Abrir menu', exact: true })
        .isVisible();
      if (mobile) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
      await page.locator('.sidebar').getByRole('button', { name, exact: true }).click();
      if (mobile) {
        await expect(page.locator('.sidebar-overlay')).toHaveCount(0);
        await expect
          .poll(() =>
            page.locator('.sidebar').evaluate((element) => element.getBoundingClientRect().right),
          )
          .toBeLessThanOrEqual(0);
      }
    };
    const capture = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `test-results/community-${name}-${width}.png`,
        fullPage: true,
      });
    };
    await navigate('Criar projeto');
    await page.getByRole('tab', { name: /Criar projeto comunitário/ }).click();
    const boxes = await page
      .locator('.create-options > button')
      .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().toJSON()));
    expect(Math.abs(boxes[0].width - boxes[1].width)).toBeLessThan(2);
    if (width <= 1024) expect(boxes[1].top).toBeGreaterThanOrEqual(boxes[0].bottom);
    for (const box of boxes) expect(box.width).toBeGreaterThan(250);
    await page.getByRole('button', { name: 'Adicionar área' }).click();
    await page.getByRole('checkbox', { name: 'Backend' }).check();
    await page.getByRole('checkbox', { name: 'Frontend' }).check();
    await page.keyboard.press('Escape');
    await page.getByLabel('Sua função na squad').selectOption('Backend');
    await expect(page.getByLabel('Sua função na squad')).not.toHaveAttribute('multiple');
    await capture('create');
    await navigate('Perfil');
    await expect(page.getByRole('heading', { name: 'Artur Ribeiro' })).toBeVisible();
    await capture('profile');
    await navigate('Comunidade');
    await expect(page.getByRole('heading', { name: 'Ana Souza' })).toBeVisible();
    await capture('list');
    await page.getByRole('button', { name: 'Ver perfil de Ana Souza' }).click();
    await expect(page.getByRole('dialog', { name: 'Perfil da comunidade' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Perfil da comunidade' })).toHaveCSS(
      'transform',
      'matrix(1, 0, 0, 1, 0, 0)',
    );
    await expect(
      page.locator('.public-profile').getByRole('heading', { name: 'Ana Souza' }),
    ).toBeVisible();
    await capture('public');
    await page.setViewportSize({ width, height: 500 });
    const publicProfile = page.locator('.public-profile');
    await expect(publicProfile).toHaveCSS('overflow-y', 'auto');
    expect(
      await publicProfile.evaluate((element) => element.scrollHeight > element.clientHeight),
    ).toBe(true);
    await publicProfile.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(publicProfile.getByRole('heading', { name: 'Histórico recente' })).toBeVisible();
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await navigate('Projetos');
    await page.getByRole('button', { name: 'Ver projeto Sistema de Delivery' }).click();
    await page.getByRole('tab', { name: 'Squad', exact: true }).click();
    await capture('squad');
    await page.getByRole('button', { name: 'Ver perfil de Ana Souza' }).click();
    await expect(
      page.locator('.public-profile').getByRole('heading', { name: 'Ana Souza' }),
    ).toBeVisible();
    await page
      .getByRole('dialog', { name: 'Perfil da comunidade' })
      .getByRole('button', { name: 'Fechar', exact: true })
      .click();
    await expect(page.getByRole('dialog', { name: 'Perfil da comunidade' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Visão geral', exact: true }).click();
    await page.locator('.join-request-row').scrollIntoViewIfNeeded();
    await capture('request');
    await page.getByRole('button', { name: 'Ver perfil de Maria Silva' }).click();
    await expect(
      page.locator('.public-profile').getByRole('heading', { name: 'Maria Silva' }),
    ).toBeVisible();
  });
}
