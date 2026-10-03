#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

function required(env, name) {
  const value = env[`FOCUSEDU_STORAGE_${name}`];
  if (!value) throw new Error(`Missing FOCUSEDU_STORAGE_${name}`);
  return value;
}

export function configuration(env) {
  if (required(env, 'ENVIRONMENT') !== 'staging') {
    throw new Error('Storage smoke requires staging');
  }
  const url = required(env, 'SUPABASE_URL');
  const ref = required(env, 'STAGING_PROJECT_REF');
  if (!/^[a-z0-9]{20}$/.test(ref) || url !== `https://${ref}.supabase.co`) {
    throw new Error('Storage URL must match the staging project ref');
  }
  if (url !== required(env, 'CONFIRMED_STAGING_URL')) {
    throw new Error('Exact staging URL confirmation required');
  }
  const key = required(env, 'PUBLIC_KEY');
  if (!key.startsWith('sb_publishable_')) {
    let claims;
    try {
      claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    } catch {
      throw new Error('Use a publishable key or legacy anon key, never service_role');
    }
    if (claims.role !== 'anon' || claims.ref !== ref) {
      throw new Error('Legacy key must be anon and belong to staging');
    }
  }
  return {
    url,
    key,
    owner: { email: required(env, 'OWNER_EMAIL'), password: required(env, 'OWNER_PASSWORD') },
    other: { email: required(env, 'OTHER_EMAIL'), password: required(env, 'OTHER_PASSWORD') },
  };
}

class SmokeFailure extends Error {}

function check(ok, message) {
  if (!ok) throw new SmokeFailure(message);
}

async function identity(config, credentials, makeClient) {
  const api = makeClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) }),
    },
  });
  const { data, error } = await api.auth.signInWithPassword(credentials);
  check(!error && data?.user && data?.session, 'User authentication failed');
  const claims = JSON.parse(Buffer.from(data.session.access_token.split('.')[1], 'base64url'));
  check(claims.role === 'authenticated', 'Authorization checks require an authenticated session');
  return { api, userId: data.user.id, storage: api.storage.from('avatars') };
}

async function content(storage, path, expected) {
  const { data, error } = await storage.download(path, { cacheNonce: randomUUID() });
  check(!error && data, 'Owner could not download the test object');
  check(
    Buffer.from(await data.arrayBuffer()).equals(expected),
    'Object content changed unexpectedly',
  );
}

async function present(storage, folder, name) {
  const { data, error } = await storage.list(folder, { search: name, limit: 100 });
  check(!error && Array.isArray(data), 'Owner object listing failed');
  return data.some((object) => object.name === name);
}

function denied(error) {
  return (
    error &&
    [400, 403].includes(Number(error.statusCode ?? error.status)) &&
    /row.level security|unauthorized|not authorized|permission denied/i.test(error.message)
  );
}

// Two small real PNG files; content comparison avoids trusting status codes alone.
const original = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);
const updated = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

export async function runStorageSmoke(
  config,
  { makeClient = createClient, log = console.log } = {},
) {
  let owner;
  let path;
  let folder;
  let name;
  let failure;
  let stage = 'authentication';
  try {
    owner = await identity(config, config.owner, makeClient);
    const other = await identity(config, config.other, makeClient);
    check(owner.userId !== other.userId, 'Owner and other user must be distinct');
    name = `storage-smoke-${randomUUID()}.png`;
    folder = owner.userId;
    path = `${folder}/${name}`;

    stage = 'owner upload';
    const upload = await owner.storage.upload(path, original, {
      contentType: 'image/png',
      upsert: false,
    });
    check(!upload.error, 'Owner upload failed');
    check(await present(owner.storage, folder, name), 'Uploaded object is missing');
    await content(owner.storage, path, original);
    log('PASS owner upload');

    stage = 'owner update';
    const update = await owner.storage.update(path, updated, { contentType: 'image/png' });
    check(!update.error, 'Owner update failed');
    await content(owner.storage, path, updated);
    log('PASS owner update');

    stage = 'foreign update';
    const foreignUpdate = await other.storage.update(path, original, { contentType: 'image/png' });
    check(denied(foreignUpdate.error), 'Foreign update did not return an authorization denial');
    await content(owner.storage, path, updated);
    log('PASS foreign update denied; original owner content preserved');

    stage = 'foreign delete';
    const foreignDelete = await other.storage.remove([path]);
    check(
      denied(foreignDelete.error) ||
        (!foreignDelete.error &&
          Array.isArray(foreignDelete.data) &&
          foreignDelete.data.length === 0),
      'Foreign delete returned an unexpected result',
    );
    check(await present(owner.storage, folder, name), 'Foreign delete removed the owner object');
    await content(owner.storage, path, updated);
    log('PASS foreign delete denied or filtered; owner object preserved');

    stage = 'owner delete';
    const removal = await owner.storage.remove([path]);
    check(!removal.error, 'Owner delete failed');
    check(
      Array.isArray(removal.data) && removal.data.some((object) => object.name === path),
      'Owner delete did not report the test object',
    );
    check(!(await present(owner.storage, folder, name)), 'Owner delete left object metadata');
    const download = await owner.storage.download(path, { cacheNonce: randomUUID() });
    check(
      download.error &&
        [400, 404].includes(Number(download.error.statusCode ?? download.error.status)) &&
        /not found|does not exist/i.test(download.error.message),
      'Deleted object remains downloadable or absence could not be confirmed',
    );
    log('PASS owner delete through Storage API');
  } catch (error) {
    // Do not expose SDK errors, credentials, JWTs or request headers.
    failure = `FAIL Storage smoke: ${stage}: ${error instanceof SmokeFailure ? error.message : 'API request or response failed'}`;
  } finally {
    if (owner && path) {
      try {
        const cleanup = await owner.storage.remove([path]);
        check(!cleanup.error, 'Cleanup failed');
        check(!(await present(owner.storage, folder, name)), 'Cleanup left test object');
        log('PASS cleanup through owner Storage API');
      } catch {
        log(`FAIL cleanup; remove avatars/${path} using the owner Storage API`);
        failure ??= 'FAIL Storage smoke: cleanup';
      }
    }
  }
  if (failure) throw new Error(failure);
  log('PASS Storage API authorization smoke');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runStorageSmoke(configuration(process.env));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
