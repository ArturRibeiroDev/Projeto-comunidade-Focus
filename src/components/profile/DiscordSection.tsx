import { useEffect, useState } from 'react';
import { ExternalLink, Link2, Settings2, Unlink } from 'lucide-react';
import { Button } from '../ui/Button';
import { friendlyDiscordError } from '../../services/authService';
import { getDiscordMembership } from '../../services/discordService';
import type { DiscordConnection } from '../../services/useDiscordIntegration';

export function DiscordSection({ connection }: { connection: DiscordConnection }) {
  const [managing, setManaging] = useState(false);
  const [inGuild, setInGuild] = useState<boolean | null>(null);
  const [membershipError, setMembershipError] = useState('');
  const invite = import.meta.env.VITE_DISCORD_INVITE_URL;
  const inviteUrl =
    invite?.startsWith('https://discord.gg/') || invite?.startsWith('https://discord.com/invite/')
      ? invite
      : '';

  useEffect(() => {
    if (!connection.connected || !managing) return;
    let active = true;
    setMembershipError('');
    getDiscordMembership()
      .then((membership) => {
        if (active) setInGuild(membership.inGuild);
      })
      .catch((cause) => {
        if (active) setMembershipError(friendlyDiscordError(cause));
      });
    return () => {
      active = false;
    };
  }, [connection.connected, managing]);

  return (
    <section className="profile-section discord-section">
      <div className="profile-section-title">
        <h2>Integrações</h2>
      </div>
      <h3>Discord</h3>
      {connection.loading ? (
        <p className="muted-copy">Verificando conexão...</p>
      ) : (
        <>
          <p className="detail-note" role="status">
            {connection.pending
              ? 'Conectando...'
              : connection.connected
                ? 'Conectado'
                : connection.error
                  ? 'Erro'
                  : 'Não conectado'}
            {connection.connected && connection.username && (
              <strong> @{connection.username}</strong>
            )}
          </p>
          <div className="discord-actions">
            {connection.connected ? (
              <Button
                disabled={connection.pending}
                icon={<Settings2 size={15} />}
                onClick={() => setManaging((value) => !value)}
                aria-expanded={managing}
              >
                Gerenciar
              </Button>
            ) : (
              <Button
                disabled={connection.pending}
                icon={<Link2 size={15} />}
                onClick={() => void (connection.error ? connection.retry() : connection.connect())}
                variant="primary"
              >
                {connection.pending
                  ? 'Conectando...'
                  : connection.error
                    ? 'Tentar novamente'
                    : 'Conectar Discord'}
              </Button>
            )}
          </div>
          {connection.connected && managing && (
            <>
              <p className="detail-note">
                Servidor Focus:{' '}
                {inGuild === null
                  ? 'verificação indisponível'
                  : inGuild
                    ? 'conectado'
                    : 'não encontrado'}
              </p>
              <div className="discord-actions">
                {!inGuild && inviteUrl && (
                  <a className="button" href={inviteUrl} target="_blank" rel="noopener noreferrer">
                    Entrar no servidor <ExternalLink size={15} />
                  </a>
                )}
                <Button
                  disabled={connection.pending || connection.identityCount < 2}
                  icon={<Unlink size={15} />}
                  onClick={() => void connection.disconnect()}
                >
                  Desconectar
                </Button>
              </div>
              {connection.identityCount < 2 && (
                <p className="muted-copy">Adicione outra forma de acesso para desconectar.</p>
              )}
              {membershipError && (
                <p className="field-error" role="alert">
                  {membershipError}
                </p>
              )}
            </>
          )}
        </>
      )}
      {connection.error && (
        <p className="field-error" role="alert">
          {connection.error}
        </p>
      )}
      {connection.error && connection.connected && (
        <Button disabled={connection.pending} onClick={() => void connection.retry()}>
          Tentar novamente
        </Button>
      )}
    </section>
  );
}
