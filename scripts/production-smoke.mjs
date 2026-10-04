#!/usr/bin/env node

const baseUrl = process.env.FOCUSEDU_SMOKE_BASE_URL;
const supabaseUrl = process.env.FOCUSEDU_SMOKE_SUPABASE_URL;
const publishableKey = process.env.FOCUSEDU_SMOKE_SUPABASE_PUBLISHABLE_KEY;
const localOnly = process.env.FOCUSEDU_SMOKE_LOCAL_ONLY === 'true';

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const marker = ok ? 'PASS' : 'FAIL';
  console.log(`${marker} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function expectStatus(name, url, allowed, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const ok = allowed.includes(response.status);
  record(name, ok, `HTTP ${response.status}`);
  return response;
}

function requiredUrl(name, value) {
  if (!value) throw new Error(`${name} is required`);
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error(`${name} must be HTTPS or localhost`);
  }
  return url;
}

try {
  const app = requiredUrl('FOCUSEDU_SMOKE_BASE_URL', baseUrl);
  if (localOnly && app.hostname !== 'localhost')
    throw new Error('Local-only smoke requires localhost');
  if (!localOnly && (!supabaseUrl || !publishableKey))
    throw new Error('Remote smoke requires public Supabase env');
  const home = await expectStatus('frontend document', app, [200]);
  const html = await home.text();
  record('html root element', html.includes('<div id="root">'), 'root container present');
  record(
    'public branding',
    html.includes('Focus Academy') && !/FocusEdu|FOCUSEDU|Focus Edu/.test(html),
  );
  if (!localOnly) {
    for (const header of [
      'content-security-policy',
      'strict-transport-security',
      'x-content-type-options',
      'referrer-policy',
      'permissions-policy',
    ]) {
      record(`header ${header}`, Boolean(home.headers.get(header)));
    }
    record('noindex', /noindex/.test(home.headers.get('x-robots-tag') || ''));
    record(
      'HTML revalidates',
      /no-cache|no-store|max-age=0/.test(home.headers.get('cache-control') || ''),
    );
  }

  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(
    (match) => match[1],
  );
  if (assetPaths.length === 0) {
    record('frontend assets', false, 'no JS/CSS assets found');
  } else {
    for (const assetPath of assetPaths.slice(0, 6)) {
      await expectStatus(`asset ${assetPath}`, new URL(assetPath, app), [200]);
    }
  }

  const robots = await expectStatus('robots.txt', new URL('/robots.txt', app), [200]);
  record('robots blocks crawling', /Disallow:\s*\//.test(await robots.text()));
  const deepLink = await expectStatus('SPA deep link', new URL('/rc-smoke-route', app), [200]);
  record('SPA fallback document', (await deepLink.text()).includes('<div id="root">'));

  if (supabaseUrl && publishableKey) {
    const supabase = requiredUrl('FOCUSEDU_SMOKE_SUPABASE_URL', supabaseUrl);
    await expectStatus(
      'supabase anon project read denied',
      new URL('/rest/v1/projects?select=id&limit=1', supabase),
      [401, 403],
      {
        headers: {
          apikey: publishableKey,
        },
      },
    );
    await expectStatus(
      'discord function unauthenticated denied',
      new URL('/functions/v1/discord-events', supabase),
      [401, 403],
      {
        method: 'POST',
        headers: {
          apikey: publishableKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'membership' }),
      },
    );
  } else {
    console.log('PENDING REMOTE VALIDATION Supabase (explicit local-only smoke)');
  }
} catch (error) {
  record('smoke runner', false, error instanceof Error ? error.message : 'unknown error');
}

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Production smoke failed: ${failed.length} check(s) failed.`);
  process.exit(1);
}

console.log(`Production smoke passed: ${results.length} check(s).`);
