import { UserPlus, UserMinus } from 'lucide-react';
import { useState } from 'react';
import type { ProjectDisplay } from '../../types';
import { removeProjectMember, updateMyProjectRole } from '../../services/projectService';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

export type ProjectMembersProps = {
  project: ProjectDisplay;
  profileId?: string;
  onMembersChanged?: () => Promise<void>;
  onOpenMember?: (key: string) => void;
};

export function ProjectMembers({
  project,
  profileId,
  onMembersChanged,
  onOpenMember,
}: ProjectMembersProps) {
  const [confirmId, setConfirmId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const forming = project.kind === 'project' && project.status === 'FORMING';
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      setConfirmId(undefined);
      await onMembersChanged?.();
    } catch {
      setError('Não foi possível atualizar a squad. Atualize o projeto e tente novamente.');
    } finally {
      setBusy(false);
    }
  };
  const vacancies = Math.max(project.memberLimit - project.members.length, 0);

  return (
    <div className="member-list">
      {project.members.map((member) => (
        <div className="member-row" key={`${project.id}-${member.memberId}`}>
          <Avatar src={member.avatarUrl} name={member.name} />
          <div>
            <strong>{member.name}</strong>
            {member.memberId === project.ownerId && (
              <small className="member-owner">Responsável</small>
            )}
            <span>{member.role}</span>
            {member.communityId && onOpenMember && (
              <Button
                variant="ghost"
                size="small"
                aria-label={`Ver perfil de ${member.name}`}
                onClick={() => onOpenMember(member.communityId!)}
              >
                Ver perfil
              </Button>
            )}
            {forming && member.memberId === profileId && (
              <label className="field">
                <span>Sua função na squad</span>
                <select
                  disabled={busy}
                  value={project.recommendedAreas.includes(member.role) ? member.role : ''}
                  onChange={(event) =>
                    void run(() => updateMyProjectRole(project.id, event.target.value))
                  }
                >
                  <option value="" disabled>
                    Selecione uma função permitida
                  </option>
                  {project.recommendedAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {forming &&
              project.ownerId === profileId &&
              member.memberId !== profileId &&
              (confirmId === member.memberId ? (
                <div className="member-confirmation">
                  <p>Remover {member.name} da squad?</p>
                  <Button
                    disabled={busy}
                    onClick={() => void run(() => removeProjectMember(project.id, member.memberId))}
                  >
                    Remover
                  </Button>
                  <Button disabled={busy} onClick={() => setConfirmId(undefined)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  disabled={busy}
                  title={`Remover ${member.name} da squad`}
                  aria-label={`Remover ${member.name} da squad`}
                  icon={<UserMinus size={16} />}
                  onClick={() => setConfirmId(member.memberId)}
                />
              ))}
          </div>
        </div>
      ))}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {vacancies > 0 && (
        <div className="vacancy-row">
          <span>
            <UserPlus size={17} />
          </span>
          <div>
            <strong>
              {vacancies === 1 ? '1 vaga disponível' : `${vacancies} vagas disponíveis`}
            </strong>
            <small>A função é definida por quem entra na squad.</small>
          </div>
        </div>
      )}
    </div>
  );
}
