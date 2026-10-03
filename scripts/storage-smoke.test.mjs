import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configuration, runStorageSmoke } from './storage-smoke.mjs';

const ref = 'abcdefghijklmnopqrst';
const env = {
  FOCUSEDU_STORAGE_ENVIRONMENT: 'staging',
  FOCUSEDU_STORAGE_SUPABASE_URL: `https://${ref}.supabase.co`,
  FOCUSEDU_STORAGE_STAGING_PROJECT_REF: ref,
  FOCUSEDU_STORAGE_CONFIRMED_STAGING_URL: `https://${ref}.supabase.co`,
  FOCUSEDU_STORAGE_PUBLIC_KEY: 'sb_publishable_test',
  FOCUSEDU_STORAGE_OWNER_EMAIL: 'owner@example.test',
  FOCUSEDU_STORAGE_OWNER_PASSWORD: 'owner-password',
  FOCUSEDU_STORAGE_OTHER_EMAIL: 'other@example.test',
  FOCUSEDU_STORAGE_OTHER_PASSWORD: 'other-password',
};

function fixture(options = {}) {
  const objects = new Map();
  const calls = [];
  const logs = [];
  let clients = 0;
  const makeClient = (_url, _key, config) => {
    assert.equal(config.auth.persistSession, false);
    const userId = clients++ === 0 ? 'owner' : options.sameUser ? 'owner' : 'other';
    const storage = {
      async upload(path, body) {
        calls.push(`${userId}:upload`);
        objects.set(path, Buffer.from(body));
        return { data: { path }, error: null };
      },
      async update(path, body) {
        calls.push(`${userId}:update`);
        if (options.transportError) throw new Error('secret-token request headers');
        if (userId === 'other' && !options.allowForeignUpdate) {
          if (options.corruptOnDenial) objects.set(path, Buffer.from(body));
          return {
            data: null,
            error: { statusCode: '403', message: 'new row violates row-level security policy' },
          };
        }
        objects.set(path, Buffer.from(body));
        return { data: { path }, error: null };
      },
      async download(path) {
        return objects.has(path)
          ? { data: new Blob([objects.get(path)]), error: null }
          : { data: null, error: { statusCode: '404', message: 'Object not found' } };
      },
      async list(folder) {
        return {
          data: [...objects.keys()]
            .filter((path) => path.startsWith(`${folder}/`))
            .map((path) => ({ name: path.split('/')[1] })),
          error: null,
        };
      },
      async remove(paths) {
        calls.push(`${userId}:remove`);
        if (userId === 'other') {
          if (options.silentForeignDelete) {
            paths.forEach((path) => objects.delete(path));
            return { data: [], error: null };
          }
          if (options.foreignDeleteOutage)
            return { data: null, error: { statusCode: '503', message: 'Unavailable' } };
          if (options.foreignDeleteDenied)
            return { data: null, error: { statusCode: '403', message: 'permission denied' } };
          if (!options.allowForeignDelete) return { data: [], error: null };
        }
        if (options.cleanupFails && calls.filter((call) => call === 'owner:remove').length > 1) {
          return { data: null, error: { statusCode: '503', message: 'secret-token' } };
        }
        const data = paths.filter((path) => objects.has(path)).map((name) => ({ name }));
        if (!options.ownerDeleteNoop || userId !== 'owner')
          paths.forEach((path) => objects.delete(path));
        return { data, error: null };
      },
    };
    return {
      auth: {
        async signInWithPassword() {
          const claims = Buffer.from(JSON.stringify({ role: 'authenticated' })).toString(
            'base64url',
          );
          return {
            data: { user: { id: userId }, session: { access_token: `header.${claims}.signature` } },
            error: null,
          };
        },
      },
      storage: {
        from: (bucket) => {
          assert.equal(bucket, 'avatars');
          return storage;
        },
      },
    };
  };
  return { makeClient, log: (message) => logs.push(message), objects, calls, logs };
}

test('requires explicit matching staging target and rejects privileged keys before network', () => {
  assert.equal(configuration(env).url, env.FOCUSEDU_STORAGE_SUPABASE_URL);
  for (const override of [
    { FOCUSEDU_STORAGE_ENVIRONMENT: 'production' },
    { FOCUSEDU_STORAGE_CONFIRMED_STAGING_URL: 'https://different.supabase.co' },
    { FOCUSEDU_STORAGE_SUPABASE_URL: 'http://localhost:54321' },
    { FOCUSEDU_STORAGE_PUBLIC_KEY: 'sb_secret_secret' },
    {
      FOCUSEDU_STORAGE_PUBLIC_KEY: `header.${Buffer.from(JSON.stringify({ role: 'service_role', ref })).toString('base64url')}.signature`,
    },
  ])
    assert.throws(() => configuration({ ...env, ...override }));
});

for (const foreignDeleteDenied of [false, true]) {
  test(`real-operation sequence accepts filtered/denied foreign remove (${foreignDeleteDenied})`, async () => {
    const mock = fixture({ foreignDeleteDenied });
    await runStorageSmoke(configuration(env), mock);
    assert.equal(mock.objects.size, 0);
    assert.deepEqual(mock.calls, [
      'owner:upload',
      'owner:update',
      'other:update',
      'other:remove',
      'owner:remove',
      'owner:remove',
    ]);
  });
}

test('stops after unauthorized update succeeds and cleans up through owner', async () => {
  const mock = fixture({ allowForeignUpdate: true });
  await assert.rejects(runStorageSmoke(configuration(env), mock), /foreign update/);
  assert.equal(mock.objects.size, 0);
  assert(!mock.calls.includes('other:remove'));
});

test('detects foreign deletion and performs only cleanup afterward', async () => {
  const mock = fixture({ allowForeignDelete: true });
  await assert.rejects(runStorageSmoke(configuration(env), mock), /foreign delete/);
  assert.equal(mock.calls.filter((call) => call === 'owner:remove').length, 1);
});

test('does not trust a denial response if object contents changed', async () => {
  const mock = fixture({ corruptOnDenial: true });
  await assert.rejects(runStorageSmoke(configuration(env), mock), /content changed/);
  assert(!mock.calls.includes('other:remove'));
  assert.equal(mock.objects.size, 0);
});

test('does not trust an empty delete response if the object disappeared', async () => {
  const mock = fixture({ silentForeignDelete: true });
  await assert.rejects(runStorageSmoke(configuration(env), mock), /removed the owner object/);
  assert.equal(mock.calls.filter((call) => call === 'owner:remove').length, 1);
});

test('does not mistake an outage for denied authorization', async () => {
  const mock = fixture({ foreignDeleteOutage: true });
  await assert.rejects(runStorageSmoke(configuration(env), mock), /foreign delete/);
  assert.equal(mock.objects.size, 0);
});

test('detects a successful owner delete response that leaves the file behind', async () => {
  const mock = fixture({ ownerDeleteNoop: true });
  await assert.rejects(runStorageSmoke(configuration(env), mock), /owner delete/);
  assert(mock.logs.some((message) => message.startsWith('FAIL cleanup')));
});

test('cleanup failure makes the overall smoke fail', async () => {
  const mock = fixture({ cleanupFails: true });
  await assert.rejects(runStorageSmoke(configuration(env), mock), /cleanup/);
  assert(!mock.logs.join('\n').includes('secret-token'));
});

test('transport errors are sanitized and still trigger cleanup', async () => {
  const mock = fixture({ transportError: true });
  await assert.rejects(runStorageSmoke(configuration(env), mock), (error) => {
    assert(!error.message.includes('secret-token'));
    return /owner update/.test(error.message);
  });
  assert.equal(mock.objects.size, 0);
});

test('same account cannot act as both owner and attacker', async () => {
  const mock = fixture({ sameUser: true });
  await assert.rejects(runStorageSmoke(configuration(env), mock), /must be distinct/);
  assert.deepEqual(mock.calls, []);
});
