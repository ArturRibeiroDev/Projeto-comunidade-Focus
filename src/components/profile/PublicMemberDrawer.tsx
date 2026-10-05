import { useCallback } from 'react';
import { Github, Linkedin } from 'lucide-react';
import { getCommunityMember } from '../../services/communityService';
import { useCommunityQuery } from '../../services/useCommunityQuery';
import { projectStatusLabels } from '../../domain/projectLifecycle';
import type { ProjectStatus } from '../../types';
import { formatDate } from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { SkillsSection } from './SkillsSection';

export function PublicMemberDrawer({
  memberKey,
  refreshKey,
  onClose,
}: {
  memberKey: string;
  refreshKey: number;
  onClose: () => void;
}) {
  const read = useCallback(() => getCommunityMember(memberKey), [memberKey]);
  const { data: profile, loading, error, retry } = useCommunityQuery(read, refreshKey);
  return (
    <Modal open title="Perfil da comunidade" variant="drawer" onClose={onClose}>
      <div className="public-profile">
        {loading && <p role="status">Carregando perfil...</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <Button onClick={retry}>Tentar novamente</Button>
          </div>
        )}
        {!loading && !error && profile === null && <p>Perfil indisponível.</p>}
        {profile && (
          <>
            <header className="public-profile-header">
              <Avatar name={profile.name} src={profile.avatarUrl} />
              <div>
                <h2>{profile.name}</h2>
                <p>{profile.primaryRole}</p>
              </div>
            </header>
            {profile.bio && <p className="public-bio">{profile.bio}</p>}
            <div className="profile-links">
              {profile.links.github && (
                <a href={profile.links.github} target="_blank" rel="noopener noreferrer">
                  <Github size={16} />
                  GitHub
                </a>
              )}
              {profile.links.linkedin && (
                <a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer">
                  <Linkedin size={16} />
                  LinkedIn
                </a>
              )}
              {profile.discordConnected && <span>Discord conectado</span>}
            </div>
            <SkillsSection title="Áreas" values={profile.areas} />
            <SkillsSection title="Tecnologias" values={profile.technologies} />
            <SkillsSection title="Quer praticar" values={profile.interests} />
            <section className="profile-section">
              <h3>Projetos recentes</h3>
              <ul className="profile-projects">
                {profile.projects.map((project, index) => (
                  <li key={index}>
                    <strong>{project.name}</strong>
                    <span>
                      {project.role} ·{' '}
                      {projectStatusLabels[project.status as ProjectStatus] ?? project.status}
                    </span>
                  </li>
                ))}
              </ul>
              {!profile.projects.length && (
                <p className="muted-copy">Nenhum projeto público no momento.</p>
              )}
            </section>
            <section className="profile-section">
              <h3>Histórico recente</h3>
              <ul className="public-history">
                {profile.evidence.map((item, index) => (
                  <li key={index}>
                    <strong>
                      {item.kind === 'completion' ? 'Concluiu' : 'Participou de'} {item.projectName}
                    </strong>
                    <span>
                      {item.role} · {formatDate(item.recordedAt)}
                    </span>
                  </li>
                ))}
              </ul>
              {!profile.evidence.length && (
                <p className="muted-copy">Nenhum registro público no momento.</p>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
