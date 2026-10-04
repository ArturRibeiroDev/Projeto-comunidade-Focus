import { expect, test } from '@playwright/test';

test('avatars remain circular with cover at desktop and mobile sizes', async ({ page }) => {
  await page.goto('/');
  await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="http://localhost:4180/src/styles.css"></head>
    <body><main style="padding:24px; max-width:600px">
      <section class="profile-header"><img alt="Perfil"></section>
      <div class="profile-mini"><img alt="Sidebar"></div>
      <img class="topbar-avatar" alt="Topbar">
      <div class="member-row"><img alt="Squad"><div><strong>Membro da squad</strong><span>Backend</span></div></div>
      <img class="admin-avatar" alt="Admin">
    </main></body></html>`);
  await page.locator('img').evaluateAll((images) => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 60;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#288466';
    context.fillRect(0, 0, 100, 60);
    context.fillStyle = '#fafafa';
    context.font = '20px sans-serif';
    context.fillText('RC', 35, 37);
    for (const image of images) (image as HTMLImageElement).src = canvas.toDataURL();
  });
  await expect(page.locator('.admin-avatar')).toHaveCSS('object-fit', 'cover');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const avatars = await page.locator('img').evaluateAll((images) =>
      images.map((image) => {
        const style = getComputedStyle(image);
        const rect = image.getBoundingClientRect();
        return {
          radius: style.borderRadius,
          fit: style.objectFit,
          width: rect.width,
          height: rect.height,
          loaded: image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
        };
      }),
    );
    for (const avatar of avatars) {
      expect(avatar.loaded).toBe(true);
      expect(avatar.fit).toBe('cover');
      expect(avatar.width).toBe(avatar.height);
      expect(avatar.radius === '50%' || parseFloat(avatar.radius) >= avatar.width / 2).toBe(true);
    }
    await page.screenshot({ path: `test-results/avatars-${width}.png` });
  }
});

test('project drawer action footer fits on desktop and stacks on mobile', async ({ page }) => {
  await page.goto('/');
  await page.setContent(`<!doctype html><html><head><link id="rc-styles" rel="stylesheet" href="http://localhost:4180/src/styles.css"></head>
    <body><div class="modal modal-drawer"><div class="project-detail">
      <div class="detail-panel" style="height: 900px"></div>
      <footer class="detail-primary-actions"><button class="button button-primary">Iniciar projeto</button>
      <p class="detail-action-note">Discord obrigatorio.</p></footer>
    </div></div></body></html>`);
  await page.waitForFunction(
    () =>
      Boolean((document.querySelector('#rc-styles') as HTMLLinkElement)?.sheet) &&
      getComputedStyle(document.querySelector('.detail-primary-actions')!).display === 'flex' &&
      getComputedStyle(document.querySelector('.detail-primary-actions')!).gap === '18px' &&
      getComputedStyle(document.querySelector('.detail-primary-actions')!).justifyContent ===
        'flex-start',
  );
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const note = page.locator('.detail-action-note');
  const footer = page.locator('.detail-primary-actions');
  const desktopLayout = await footer.evaluate((element) => {
    const button = element.querySelector('button')!.getBoundingClientRect();
    const note = element.querySelector('p')!.getBoundingClientRect();
    return { button: button.toJSON(), note: note.toJSON() };
  });
  expect(desktopLayout.button.right).toBeLessThanOrEqual(desktopLayout.note.left);

  await note.evaluate((element) => {
    element.textContent =
      'Todos os membros precisam conectar o Discord antes de iniciar. Esta mensagem longa deve continuar visivel, quebrar linha sem sobrepor o botao e respeitar a largura disponivel no rodape.';
  });
  const longLayout = await footer.evaluate((element) => {
    const button = element.querySelector('button')!.getBoundingClientRect();
    const note = element.querySelector('p')!.getBoundingClientRect();
    return { button: button.toJSON(), note: note.toJSON() };
  });
  expect(longLayout.button.right).toBeLessThanOrEqual(longLayout.note.left);
  expect(longLayout.note.height).toBeGreaterThan(desktopLayout.note.height);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await footer.evaluate((element) => {
    const button = element.querySelector('button')!.getBoundingClientRect();
    const note = element.querySelector('p')!.getBoundingClientRect();
    return {
      button: button.toJSON(),
      note: note.toJSON(),
      direction: getComputedStyle(element).flexDirection,
    };
  });
  expect(mobileLayout.note.top).toBeGreaterThanOrEqual(mobileLayout.button.bottom);
  expect(mobileLayout.direction).toBe('column');
  expect(await footer.evaluate((element) => getComputedStyle(element).position)).toBe('sticky');
});
