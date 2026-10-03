import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import {
  getProjectDiscordIntegration,
  getProjectDiscordLink,
  requestDiscordResync,
  retryDiscordEvent,
} from '../../services/discordService';
import type { ProjectStatus } from '../../types';
import { formatDate } from '../../utils/format';
import { Button } from '../ui/Button';

type DiscordState = Awaited<ReturnType<typeof getProjectDiscordIntegration>>;

export function ProjectDiscordSection({
  projectId,
  status,
  started,
  canManage,
  refreshKey,
}: {
  projectId: string;
  status: ProjectStatus;
  started: boolean;
  canManage: boolean;
  refreshKey: number;
}) {
  const [state, setState] = useState<DiscordState>();
  const [channelUrl, setChannelUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(status !== 'FORMING');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const next = await getProjectDiscordIntegration(projectId);
    setState(next);
    if (next.integration?.external_id) {
      setChannelUrl(await getProjectDiscordLink(projectId));
    }
  };

  useEffect(() => {
    if (status === 'FORMING') return;
    let active = true;
    getProjectDiscordIntegration(projectId)
      .then(async (next) => {
        if (!active) return;
        setState(next);
        if (next.integration?.external_id) {
          const url = await getProjectDiscordLink(projectId);
          if (active) setChannelUrl(url);
        }
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar a integração Discord.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, status, refreshKey]);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      await load();
    } catch {
      setError('Não foi possível sincronizar Discord.');
    } finally {
      setBusy(false);
    }
  };

  const integration = state?.integration;
  const failed = state?.failedEvent;
  const isFailed = integration?.status === 'FAILED' || Boolean(failed);
  const retryAvailable =
    failed && (!failed.retry_after || new Date(failed.retry_after) <= new Date());

  return (
    <section className="detail-section discord-project-section">
      <div className="detail-section-heading">
        <h3>Discord</h3>
      </div>
      {status === 'FORMING' ? (
        <p className="detail-note">A integração será criada quando o projeto iniciar.</p>
      ) : loading ? (
        <p className="detail-note">Verificando integração...</p>
      ) : (
        <>
          {isFailed ? (
            <>
              <p className="field-error">
                Falha ao sincronizar Discord. {integration?.last_error || failed?.last_error}
              </p>
              {integration && (
                <p className="detail-note">
                  {integration.synced_count} de {integration.member_count} membros sincronizados
                </p>
              )}
              {failed && (
                <p className="detail-note">
                  Tentativas: {failed.attempts} · Última:{' '}
                  {failed.last_attempted_at ? formatDate(failed.last_attempted_at) : 'nunca'} ·
                  Próxima:{' '}
                  {failed.retry_after ? formatDate(failed.retry_after) : 'tentativa manual'}
                </p>
              )}
            </>
          ) : integration?.external_id ? (
            <>
              <p className="detail-note">#{integration.external_name || 'canal-da-squad'}</p>
              <p className="detail-note">
                {integration.synced_count} de {integration.member_count} membros sincronizados
              </p>
            </>
          ) : !started && (status === 'CANCELLED' || status === 'ARCHIVED') ? (
            <p className="detail-note">
              O projeto terminou antes do início; nenhum canal foi criado.
            </p>
          ) : (
            <p className="detail-note">Sincronização pendente.</p>
          )}
          <div className="discord-actions">
            {channelUrl && (
              <a className="button" href={channelUrl} target="_blank" rel="noopener noreferrer">
                Abrir no Discord <ExternalLink size={15} />
              </a>
            )}
            {canManage && failed && retryAvailable && (
              <Button
                disabled={busy}
                icon={<RefreshCw size={15} />}
                onClick={() => void run(() => retryDiscordEvent(failed.id, projectId))}
              >
                Tentar novamente
              </Button>
            )}
            {canManage && !isFailed && started && (
              <Button
                disabled={busy}
                icon={<RefreshCw size={15} />}
                onClick={() => void run(() => requestDiscordResync(projectId))}
              >
                Sincronizar
              </Button>
            )}
          </div>
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
