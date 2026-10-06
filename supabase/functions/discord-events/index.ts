import { createClient } from 'npm:@supabase/supabase-js@2';
import { DiscordClient } from './discord.ts';
import {
  processDiscordEvent,
  type DiscordEvent,
  type ProjectData,
  type SquadMember,
} from './processor.ts';
import {
  classifyDiscordEventFailure,
  nextDiscordRetryAt,
  type ClassifiedDiscordFailure,
} from './retryPolicy.ts';

const allowedLocalOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const userBatchLimit = 5;
const workerBatchLimit = 10;
const corsBase = {
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-focusedu-worker-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};

type AdminClient = ReturnType<typeof createClient>;
type RequestBody = {
  action?: string;
  projectId?: string;
  limit?: number;
};
type ClaimedDiscordEvent = DiscordEvent & {
  project_id: string;
  attempts: number;
  processing_token: string;
};

function allowedOrigins(): Set<string> {
  const values = [
    Deno.env.get('FOCUSEDU_ALLOWED_ORIGINS') ?? '',
    Deno.env.get('FOCUSEDU_APP_URL') ?? '',
  ]
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  const origins = new Set([...allowedLocalOrigins]);
  for (const value of values) {
    try {
      origins.add(new URL(value).origin);
    } catch {
      origins.add(value.replace(/\/+$/, ''));
    }
  }
  return origins;
}

function cors(request: Request): HeadersInit {
  const origin = request.headers.get('Origin');
  if (origin && allowedOrigins().has(origin)) {
    return {
      ...corsBase,
      'Access-Control-Allow-Origin': origin,
    };
  }
  return corsBase;
}

function json(request: Request, data: object, status = 200): Response {
  return Response.json(data, { status, headers: cors(request) });
}

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
}

async function readBody(request: Request): Promise<RequestBody> {
  try {
    return (await request.json()) as RequestBody;
  } catch {
    return {};
  }
}

function createAdmin(): AdminClient {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

function isUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value));
}

function parseWorkerLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return workerBatchLimit;
  return Math.min(Math.max(Math.trunc(value), 1), workerBatchLimit);
}

function workerAuthorized(request: Request): boolean {
  const expected = Deno.env.get('DISCORD_WORKER_SECRET');
  const received = request.headers.get('x-focusedu-worker-secret');
  return Boolean(expected && received && received === expected);
}

async function loadProcessingContext(
  admin: AdminClient,
  projectId: string,
  event: ClaimedDiscordEvent,
) {
  const guildId = required('DISCORD_GUILD_ID');
  const activeCategoryId = required('DISCORD_ACTIVE_CATEGORY_ID');
  const archiveCategoryId = required('DISCORD_ARCHIVE_CATEGORY_ID');
  const api = new DiscordClient(required('DISCORD_BOT_TOKEN'));
  const [botId, projectResult, memberResult, integrationResult] = await Promise.all([
    api.botId(),
    admin
      .from('projects')
      .select(
        'id,owner_id,name,status,started_at,repository_url,demo_url,completion_summary,cancellation_reason',
      )
      .eq('id', projectId)
      .single(),
    admin.from('project_members').select('user_id,main_role').eq('project_id', projectId),
    admin
      .from('project_integrations')
      .select('external_id,external_name')
      .eq('project_id', projectId)
      .eq('provider', 'discord')
      .maybeSingle(),
  ]);
  if (projectResult.error || memberResult.error || integrationResult.error) {
    throw new Error('Dados indisponíveis');
  }

  const userIds = memberResult.data.map((member) => member.user_id);
  const [profileResult, identityResult] = userIds.length
    ? await Promise.all([
        admin.from('profiles').select('id,name').in('id', userIds),
        admin
          .from('user_integrations')
          .select('user_id,provider_user_id')
          .in('user_id', userIds)
          .eq('provider', 'discord'),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (profileResult.error || identityResult.error) throw new Error('Membros indisponíveis');

  const names = new Map(profileResult.data.map((profile) => [profile.id, profile.name]));
  const discordIds = new Map(
    identityResult.data.map((item) => [item.user_id, item.provider_user_id]),
  );
  const members: SquadMember[] = memberResult.data.map((member) => ({
    name: names.get(member.user_id) ?? 'Membro Focus',
    role: member.main_role,
    discordId: discordIds.get(member.user_id) ?? null,
  }));

  return {
    guildId,
    activeCategoryId,
    archiveCategoryId,
    appUrl: Deno.env.get('FOCUSEDU_APP_URL'),
    botId,
    project: projectResult.data as ProjectData,
    members,
    integration: integrationResult.data ?? { external_id: null, external_name: null },
    event,
    api,
  };
}

async function markFailed(
  admin: AdminClient,
  event: ClaimedDiscordEvent,
  failure: ClassifiedDiscordFailure,
) {
  const retryAfter = nextDiscordRetryAt(failure, event.attempts);
  const failureKind = retryAfter ? 'RETRYABLE' : 'FINAL';
  const [eventResult, integrationResult] = await Promise.all([
    admin
      .from('integration_events')
      .update({
        status: 'FAILED',
        last_error: failure.message,
        retry_after: retryAfter,
        failure_kind: failureKind,
        lease_until: null,
        processing_token: null,
      })
      .eq('id', event.id)
      .eq('processing_token', event.processing_token),
    admin.from('project_integrations').upsert(
      {
        project_id: event.project_id,
        provider: 'discord',
        status: 'FAILED',
        last_error: failure.message,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,provider' },
    ),
  ]);
  if (eventResult.error) throw eventResult.error;
  if (integrationResult.error) throw integrationResult.error;
  return { retryAfter, failureKind };
}

async function processClaimedEvent(admin: AdminClient, event: ClaimedDiscordEvent) {
  try {
    const context = await loadProcessingContext(admin, event.project_id, event);
    await processDiscordEvent({
      ...context,
      saveIntegration: async (data) => {
        const result = await admin.from('project_integrations').upsert(
          {
            project_id: event.project_id,
            provider: 'discord',
            ...data,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'project_id,provider' },
        );
        if (result.error) throw result.error;
      },
      saveMessageId: async (messageId) => {
        const result = await admin
          .from('integration_events')
          .update({ external_message_id: messageId })
          .eq('id', event.id)
          .eq('processing_token', event.processing_token);
        if (result.error) throw result.error;
      },
    });

    const completed = await admin
      .from('integration_events')
      .update({
        status: 'COMPLETED',
        processed_at: new Date().toISOString(),
        retry_after: null,
        failure_kind: null,
        lease_until: null,
        processing_token: null,
        last_error: null,
      })
      .eq('id', event.id)
      .eq('processing_token', event.processing_token);
    if (completed.error) throw completed.error;
    return { status: 'processed' as const };
  } catch (error) {
    const failure = classifyDiscordEventFailure(error);
    const marked = await markFailed(admin, event, failure);
    return {
      status: 'failed' as const,
      retryable: marked.failureKind === 'RETRYABLE',
      retryAfter: marked.retryAfter,
      message: failure.message,
    };
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors(request) });
  if (request.method !== 'POST') return json(request, { error: 'Método não permitido' }, 405);

  try {
    const body = await readBody(request);
    const admin = createAdmin();

    if (body.action === 'worker') {
      if (!Deno.env.get('DISCORD_WORKER_SECRET')) {
        return json(request, { error: 'Worker Discord não configurado' }, 500);
      }
      if (!workerAuthorized(request)) return json(request, { error: 'Acesso negado' }, 403);

      const limit = parseWorkerLimit(body.limit);
      let claimed = 0;
      let processed = 0;
      let failed = 0;
      let retryable = 0;
      let final = 0;

      for (let index = 0; index < limit; index += 1) {
        // Claim immediately before processing so waiting events do not lose their lease.
        const claim = await admin.rpc('discord_claim_events', { p_limit: 1 });
        if (claim.error) throw claim.error;
        const event = (claim.data as ClaimedDiscordEvent[] | null)?.[0];
        if (!event) break;
        claimed += 1;
        const outcome = await processClaimedEvent(admin, event);
        if (outcome.status === 'processed') {
          processed += 1;
        } else {
          failed += 1;
          if (outcome.retryable) retryable += 1;
          else final += 1;
        }
      }

      return json(request, {
        claimed,
        processed,
        failed,
        retryable,
        final,
      });
    }

    const token = request.headers.get('Authorization')?.replace(/^Bearer /i, '');
    if (!token) return json(request, { error: 'Autenticação necessária' }, 401);

    const { data: identity, error: authError } = await admin.auth.getUser(token);
    if (authError || !identity.user) return json(request, { error: 'Sessão inválida' }, 401);

    if (body.action === 'membership') {
      const linked = await admin
        .from('user_integrations')
        .select('provider_user_id')
        .eq('user_id', identity.user.id)
        .eq('provider', 'discord')
        .maybeSingle();
      if (linked.error) throw linked.error;
      if (!linked.data) return json(request, { connected: false, inGuild: false });
      try {
        const api = new DiscordClient(required('DISCORD_BOT_TOKEN'));
        const inGuild = await api.guildMember(
          required('DISCORD_GUILD_ID'),
          linked.data.provider_user_id,
        );
        return json(request, { connected: true, inGuild });
      } catch {
        return json(request, { connected: true, inGuild: null });
      }
    }

    const projectId = body.projectId;
    if (!isUuid(projectId)) return json(request, { error: 'Projeto inválido' }, 400);

    const [projectResult, accountResult] = await Promise.all([
      admin.from('projects').select('id,owner_id').eq('id', projectId).single(),
      admin
        .from('platform_accounts')
        .select('platform_role,account_status')
        .eq('user_id', identity.user.id)
        .single(),
    ]);
    if (projectResult.error || accountResult.error)
      return json(request, { error: 'Projeto não encontrado' }, 404);

    const account = accountResult.data;
    const isOwner = projectResult.data.owner_id === identity.user.id;
    if (body.action === 'project-link') {
      const membership = await admin
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('user_id', identity.user.id)
        .maybeSingle();
      if (membership.error) throw membership.error;
      if (
        account.account_status !== 'ACTIVE' ||
        (!isOwner && account.platform_role !== 'ADMIN' && !membership.data)
      ) {
        return json(request, { error: 'Acesso negado' }, 403);
      }
      const integration = await admin
        .from('project_integrations')
        .select('external_id')
        .eq('project_id', projectId)
        .eq('provider', 'discord')
        .maybeSingle();
      if (integration.error) throw integration.error;
      const channelId = integration.data?.external_id;
      return json(request, {
        url: channelId
          ? `https://discord.com/channels/${required('DISCORD_GUILD_ID')}/${channelId}`
          : null,
      });
    }

    if (account.account_status !== 'ACTIVE' || (!isOwner && account.platform_role !== 'ADMIN')) {
      return json(request, { error: 'Acesso negado' }, 403);
    }

    let processed = 0;
    let failed = 0;
    for (let index = 0; index < userBatchLimit; index += 1) {
      const claim = await admin.rpc('discord_claim_event', { p_project_id: projectId });
      if (claim.error) throw claim.error;
      const event = claim.data as ClaimedDiscordEvent | null;
      if (!event) break;
      const outcome = await processClaimedEvent(admin, event);
      if (outcome.status === 'processed') processed += 1;
      else failed += 1;
    }

    return json(request, { processed, failed });
  } catch {
    return json(request, { error: 'Não foi possível processar a integração' }, 500);
  }
});
