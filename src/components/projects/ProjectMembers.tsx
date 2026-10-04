import { UserPlus, UserMinus } from 'lucide-react';
import { useState } from 'react';
import type { ProjectDisplay } from '../../types';
import { removeProjectMember, updateMyProjectRole } from '../../services/projectService';
import { Button } from '../ui/Button';

export type ProjectMembersProps = {
  project: ProjectDisplay;
  profileId?: string;
  onMembersChanged?: () => Promise<void>;
};

export function ProjectMembers({ project, profileId, onMembersChanged }: ProjectMembersProps) {
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
          {member.avatarUrl ? (
            <img src={member.avatarUrl} alt="" />
          ) : (
            <div className="member-avatar-initials" aria-hidden="true">
              {member.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase()}
            </div>
          )}
          <div>
            <strong>{member.name}</strong>
            <span>{member.role}</span>
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
