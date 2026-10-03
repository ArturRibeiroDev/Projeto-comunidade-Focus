import { CheckCircle2, Link2, XCircle } from 'lucide-react';
import type { ProjectDiscordReadiness as Readiness } from '../../services/projectService';
import type { DiscordConnection } from '../../services/useDiscordIntegration';
import { Button } from '../ui/Button';

export function ProjectDiscordReadiness({
  readiness,
  profileId,
  connection,
  showCount = true,
}: {
  readiness: Readiness;
  profileId: string;
  connection: DiscordConnection;
  showCount?: boolean;
}) {
  const missingCount = readiness.memberCount - readiness.readyCount;
  return (
    <section className="detail-section discord-readiness-section">
      <div className="detail-section-heading">
        <h3>Discord da squad</h3>
        {showCount && (
          <span>
            {readiness.readyCount}/{readiness.memberCount} prontos
          </span>
        )}
      </div>
      {showCount && missingCount > 0 && (
        <p className="readiness-note">
          {missingCount === 1
            ? '1 membro ainda precisa conectar o Discord.'
            : `${missingCount} membros ainda precisam conectar o Discord.`}
        </p>
      )}
      <div className="readiness-list">
        {readiness.members.map((member) => {
          const own = member.userId === profileId;
          return (
            <div className="readiness-row" key={member.userId}>
              <span className={member.discordConnected ? 'ready' : 'pending'}>
                {member.discordConnected ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              </span>
              <div>
                <strong>{member.name}</strong>
                <small>
                  {member.discordConnected
                    ? 'Discord conectado'
                    : own
                      ? 'Conecte seu Discord para participar da squad.'
                      : 'Precisa conectar o Discord'}
                </small>
                {own && member.discordConnected && connection.username && (
                  <small>@{connection.username}</small>
                )}
                {own && !member.discordConnected && (
                  <Button
                    disabled={connection.pending || connection.loading}
                    icon={<Link2 size={15} />}
                    onClick={() =>
                      void (connection.error ? connection.retry() : connection.connect())
                    }
                    variant="primary"
                  >
                    {connection.pending
                      ? 'Conectando...'
                      : connection.error
                        ? 'Tentar novamente'
                        : 'Conectar meu Discord'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
