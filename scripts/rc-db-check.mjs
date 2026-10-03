import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const container = `focusedu-rc-${process.pid}`;
const withExtensions = process.argv.includes('--extensions');
const upstreamCronSchema = process.argv.includes('--upstream-cron-schema');
const extensionImage =
  'supabase/postgres:17.6.1.136@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00';
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 60_000 });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || result.stdout);
  }
  return result.stdout;
}
function sql(source) {
  return docker(
    ['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    source,
  );
}

function concurrentSql(source) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [
      'exec',
      '-i',
      container,
      'psql',
      '-h',
      '127.0.0.1',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ]);
    let stderr = '';
    child.stdout.resume();
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stderr }));
    child.stdin.end(`set statement_timeout = '10s'; set lock_timeout = '5s';\n${source}`);
  });
}

try {
  if (upstreamCronSchema && !withExtensions) {
    throw new Error('--upstream-cron-schema requires --extensions');
  }
  docker(
    withExtensions
      ? [
          'run',
          '-d',
          '--rm',
          '--network',
          'none',
          '--name',
          container,
          '--entrypoint',
          'sleep',
          extensionImage,
          'infinity',
        ]
      : [
          'run',
          '-d',
          '--rm',
          '--network',
          'none',
          '--name',
          container,
          '-e',
          'POSTGRES_HOST_AUTH_METHOD=trust',
          'postgres:16-alpine',
        ],
  );
  if (withExtensions) {
    if (upstreamCronSchema) {
      docker([
        'cp',
        'supabase/tests/pg_cron_upstream_schema.control',
        `${container}:/usr/share/postgresql/extension/pg_cron.control`,
      ]);
    }
    docker([
      'exec',
      '--user',
      'postgres',
      container,
      'initdb',
      '-D',
      '/tmp/rc-db',
      '--auth=trust',
      '--username=postgres',
      '--no-locale',
    ]);
    docker([
      'exec',
      '-d',
      '--user',
      'postgres',
      container,
      'postgres',
      '-D',
      '/tmp/rc-db',
      '-c',
      'shared_preload_libraries=pg_cron,pg_net',
      '-c',
      'cron.database_name=postgres',
      '-c',
      'cron.launch_active_jobs=off',
    ]);
  }
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const result = spawnSync(
      'docker',
      ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'],
      { encoding: 'utf8' },
    );
    if (result.status === 0) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Isolated PostgreSQL did not become ready');
  if (withExtensions) {
    // Probe both the provider's permissive control and the upstream fixed schema.
    sql(`create schema extensions;
      do $$ begin
        begin
          execute 'create extension pg_cron with schema extensions';
          ${upstreamCronSchema ? "raise exception 'Historical pg_cron schema unexpectedly accepted';" : "raise exception 'Rollback successful permissive-control probe' using errcode = 'P0002';"}
        exception when feature_not_supported or invalid_parameter_value then
          if sqlerrm not like '%pg_catalog%' then raise; end if;
        when no_data_found then
          ${upstreamCronSchema ? 'raise;' : 'null;'}
        end;
      end $$;`);
    console.log(
      upstreamCronSchema
        ? 'PASS reproduced historical failure with upstream schema control fixture'
        : 'PASS native provider control probe (installation rolled back)',
    );
    const bootstrap = readFileSync('supabase/preflight/staging_extensions.sql', 'utf8');
    let refused = false;
    try {
      sql(bootstrap);
    } catch (error) {
      refused = error.message.includes('Confirm staging');
    }
    if (!refused) throw new Error('Bootstrap did not require explicit staging confirmation');
    for (let attempt = 0; attempt < 2; attempt++) {
      sql(`set focusedu.preflight.environment = 'staging';\n${bootstrap}`);
    }
    console.log('PASS staging bootstrap confirmation and idempotency (real extensions)');
    console.log(sql(readFileSync('supabase/preflight/check_extensions.sql', 'utf8')));
  }
  sql(readFileSync('supabase/tests/local_bootstrap.sql', 'utf8'));
  sql(readFileSync('supabase/tests/discord_local_bootstrap.sql', 'utf8'));
  // Match browser default ACLs so revocations are exercised, not assumed.
  sql(`grant usage on schema public to anon, authenticated, service_role;
    alter role service_role bypassrls;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    grant select, update, delete on storage.objects to authenticated;`);
  for (const file of readdirSync('supabase/migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort()) {
    let source = readFileSync(`supabase/migrations/${file}`, 'utf8');
    if (!withExtensions && file === '202609280004_discord_event_worker.sql') {
      source = source.slice(0, source.indexOf('create extension if not exists pg_cron'));
      console.log('PENDING REMOTE VALIDATION: pg_cron/pg_net/Vault scheduling (not emulated)');
    }
    sql(source);
    console.log(`PASS migration ${file}`);
  }
  if (withExtensions) {
    sql(`do $$ begin
      if (select count(*) from cron.job where jobname = 'focusedu-discord-events-worker') <> 1 then
        raise exception 'Historical worker migration did not schedule exactly one job'; end if;
      execute 'prepare focusedu_worker_probe as ' ||
        (select command from cron.job where jobname = 'focusedu-discord-events-worker');
      deallocate focusedu_worker_probe;
    end $$;
    select cron.alter_job(jobid, active := false) from cron.job
      where jobname = 'focusedu-discord-events-worker';`);
    console.log(sql(readFileSync('supabase/preflight/check_extensions.sql', 'utf8')));
    let refused = false;
    try {
      sql(
        `set focusedu.preflight.environment = 'staging';\n${readFileSync('supabase/preflight/staging_extensions.sql', 'utf8')}`,
      );
    } catch (error) {
      refused = error.message.includes('application tables already exist');
    }
    if (!refused) throw new Error('Bootstrap accepted a nonempty application database');
    console.log('PASS complete historical worker migration, paused job and nonempty-db guard');
  }
  sql(readFileSync('supabase/seed.sql', 'utf8'));
  for (const file of [
    'security_catalog_smoke.sql',
    'participation_roles_smoke.sql',
    'remote_smoke.sql',
    'lifecycle_smoke.sql',
    'ux_smoke.sql',
    'admin_smoke.sql',
    'discord_smoke.sql',
    'discord_worker_smoke.sql',
    'join_gamification_smoke.sql',
    'release_candidate_smoke.sql',
  ]) {
    const output = sql(readFileSync(`supabase/tests/${file}`, 'utf8'));
    console.log(`PASS ${file}`);
    if (file === 'security_catalog_smoke.sql') console.log(output);
  }
  // Committed fixtures exist only in this disposable, network-isolated database.
  sql(readFileSync('supabase/tests/rc_concurrency_fixture.sql', 'utf8'));
  const outcomes = await Promise.all(
    ['a', 'b'].map((label) =>
      concurrentSql(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', false);
    select public.decide_project_join_request((select id from rc_concurrency.requests where label = '${label}'), 'APPROVED');
  `),
    ),
  );
  if (
    outcomes.filter((outcome) => outcome.code === 0).length !== 1 ||
    outcomes.filter((outcome) => outcome.code !== 0 && outcome.stderr.includes('PROJECT_FULL'))
      .length !== 1
  ) {
    throw new Error(
      'Concurrent final-slot approval did not produce one approval and one PROJECT_FULL',
    );
  }
  sql(`do $$ begin
    if (select count(*) from public.project_members where project_id = (select id from rc_concurrency.projects)) <> 2 then
      raise exception 'Concurrent approvals exceeded capacity'; end if;
  end $$;`);
  console.log('PASS two concurrent owner approvals for the final slot');
} catch (error) {
  console.error('FAIL isolated RC database check:', error.message);
  process.exitCode = 1;
} finally {
  spawnSync('docker', ['rm', '-f', container], { encoding: 'utf8' });
}
