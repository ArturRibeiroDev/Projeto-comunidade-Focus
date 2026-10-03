import { expect, test } from '@playwright/test';

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
