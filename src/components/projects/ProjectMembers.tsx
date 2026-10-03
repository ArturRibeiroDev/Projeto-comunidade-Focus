import { UserPlus } from 'lucide-react';
import type { ProjectDisplay } from '../../types';

export function ProjectMembers({ project }: { project: ProjectDisplay }) {
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
          </div>
        </div>
      ))}
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
