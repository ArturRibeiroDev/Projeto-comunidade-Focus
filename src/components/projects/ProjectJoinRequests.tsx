import { Check, Clock, X } from 'lucide-react';
import type { ProjectJoinRequest } from '../../types';
import { formatDate } from '../../utils/format';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

export function ProjectJoinRequests({
  requests,
  onOpenMember,
  busy,
  onApprove,
  onReject,
}: {
  requests: ProjectJoinRequest[];
  onOpenMember?: (key: string) => void;
  busy: boolean;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}) {
  const pending = requests.filter((request) => request.status === 'PENDING');
  if (pending.length === 0) return null;

  return (
    <section className="detail-section join-requests-section">
      <div className="detail-section-heading">
        <h3>Solicitações para entrar ({pending.length})</h3>
      </div>
      <div className="join-request-list">
        {pending.map((request) => (
          <article className="join-request-row" key={request.id}>
            <Avatar src={request.avatarUrl} name={request.name} />
            <div className="join-request-main">
              <div>
                <strong>{request.name}</strong>
                <span>Função solicitada: {request.role}</span>
              </div>
              {request.contributionIntent && <p>{request.contributionIntent}</p>}
              {!request.contributionIntent && request.bio && (
                <p className="member-summary">{request.bio}</p>
              )}
              {Boolean(request.interests?.length) && (
                <p className="muted-copy">
                  Quer praticar: {request.interests!.slice(0, 4).join(' · ')}
                </p>
              )}
              {request.communityId && onOpenMember && (
                <Button
                  variant="ghost"
                  size="small"
                  aria-label={`Ver perfil de ${request.name}`}
                  onClick={() => onOpenMember(request.communityId!)}
                >
                  Ver perfil
                </Button>
              )}
              <small>
                <Clock size={13} />
                {formatDate(request.requestedAt)}
              </small>
              {(request.areas.length > 0 || request.technologies.length > 0) && (
                <div className="request-tags">
                  {[...request.areas, ...request.technologies].slice(0, 6).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="join-request-actions">
              <Button
                disabled={busy}
                icon={<Check size={15} />}
                onClick={() => onApprove(request.id)}
                size="small"
                variant="primary"
              >
                Aprovar
              </Button>
              <Button
                disabled={busy}
                icon={<X size={15} />}
                onClick={() => onReject(request.id)}
                size="small"
                variant="danger"
              >
                Rejeitar
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
