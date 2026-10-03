import { Pencil, Save } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AvatarUploader } from '../components/profile/AvatarUploader';
import { EvidenceSection } from '../components/profile/EvidenceSection';
import { GamificationSection } from '../components/profile/GamificationSection';
import { DiscordSection } from '../components/profile/DiscordSection';
import type { DiscordConnection } from '../services/useDiscordIntegration';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { SkillsSection } from '../components/profile/SkillsSection';
import { TagSelector } from '../components/profile/TagSelector';
import { Button } from '../components/ui/Button';
import { roleOptions } from '../data/options';
import { projectStatusLabels } from '../domain/projectLifecycle';
import type { GamificationProgress, MemberProfile, ProjectDisplay } from '../types';
import {
  availabilityHours,
  bioLength,
  BIO_MAX_LENGTH,
  limitBio,
  safeExternalUrl,
} from '../utils/profileFields';

const interestSuggestions = [
  'APIs',
  'Integrações',
  'Sistemas web',
  'Mobile',
  'Dados',
  'IA',
  'Cloud',
  'DevOps',
  'Automação',
  'Segurança',
  'Open Source',
  'UI/UX',
  'E-commerce',
  'SaaS',
  'Games',
  'Projetos sociais',
];
const areaSuggestions = [
  'Frontend',
  'Backend',
  'Full Stack',
  'Mobile',
  'QA',
  'UX/UI',
  'Data Analysis',
  'Data Engineering',
  'Data Science',
  'Machine Learning / IA',
  'DevOps',
  'Cloud',
  'Cybersecurity',
  'Game Development',
  'Product',
  'Project Management',
];

export function ProfilePage({
  profile,
  discord,
  gamification,
  savedProfile,
  projects,
  skillOptions,
  editRequest,
  onChange,
  onCancel,
  onSubmit,
  busy,
}: {
  profile: MemberProfile;
  discord: DiscordConnection;
  gamification: GamificationProgress | null;
  savedProfile: MemberProfile;
  projects: ProjectDisplay[];
  skillOptions: { technologies: string[]; areas: string[] };
  editRequest: number;
  onChange: (profile: MemberProfile) => void;
  onCancel: () => void;
  onSubmit: (file?: File) => Promise<boolean>;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File>();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (editRequest > 0) setEditing(true);
  }, [editRequest]);
  useEffect(() => {
    if (editing)
      formRef.current?.querySelector<HTMLInputElement>('input[name="profile-name"]')?.focus();
  }, [editing]);
  const update = <Key extends keyof MemberProfile>(key: Key, value: MemberProfile[Key]) =>
    onChange({ ...profile, [key]: value });
  const close = () => {
    setEditing(false);
    setAvatarFile(undefined);
    onCancel();
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await onSubmit(avatarFile)) {
      setEditing(false);
      setAvatarFile(undefined);
    }
  };
  const currentProjects = projects.filter(
    (project) =>
      project.kind === 'project' &&
      ['FORMING', 'ACTIVE'].includes(project.status ?? '') &&
      project.members.some((member) => member.memberId === savedProfile.id),
  );
  const customRole = !roleOptions.includes(profile.primaryRole) || profile.primaryRole === 'Outra';
  const invalidLink =
    Boolean(profile.links.github && !safeExternalUrl(profile.links.github)) ||
    Boolean(profile.links.linkedin && !safeExternalUrl(profile.links.linkedin));

  return (
    <div className="page-stack content-narrow">
      <div className="profile-heading-actions">
        <span className="profile-kicker">Perfil profissional</span>
        {!editing && (
          <Button icon={<Pencil size={16} />} onClick={() => setEditing(true)}>
            Editar perfil
          </Button>
        )}
      </div>
      <ProfileHeader profile={savedProfile} />
      {editing ? (
        <form className="structured-form profile-edit-form" onSubmit={submit} ref={formRef}>
          <div className="form-intro field-wide">
            <h2>Editar perfil</h2>
          </div>
          <section className="profile-edit-section field-wide">
            <h3>Informações pessoais</h3>
            <div className="profile-edit-grid">
              <AvatarUploader
                avatarUrl={profile.avatarUrl.includes('api.dicebear.com/') ? '' : profile.avatarUrl}
                file={avatarFile}
                name={profile.name}
                onFile={setAvatarFile}
                onRemove={() => {
                  setAvatarFile(undefined);
                  update('avatarUrl', '');
                }}
              />
              <label className="field">
                <span>Nome</span>
                <input
                  name="profile-name"
                  required
                  maxLength={120}
                  value={profile.name}
                  onChange={(event) => update('name', event.target.value)}
                />
              </label>
              <div className="field field-wide bio-field">
                <label htmlFor="profile-bio">Bio curta</label>
                <textarea
                  aria-describedby="profile-bio-help profile-bio-count"
                  id="profile-bio"
                  rows={4}
                  value={profile.bio}
                  onChange={(event) => update('bio', limitBio(event.target.value))}
                />
                <div className="bio-field-footer">
                  <small id="profile-bio-help">Apresente-se em poucas linhas.</small>
                  <output
                    className={bioLength(profile.bio) >= BIO_MAX_LENGTH * 0.9 ? 'near-limit' : ''}
                    id="profile-bio-count"
                  >
                    {bioLength(profile.bio)} / {BIO_MAX_LENGTH}
                  </output>
                </div>
              </div>
            </div>
          </section>
          <section className="profile-edit-section field-wide">
            <h3>Perfil profissional</h3>
            <div className="profile-edit-grid">
              <label className="field">
                <span>Função principal</span>
                <select
                  value={customRole ? 'Outra' : profile.primaryRole}
                  onChange={(event) =>
                    update('primaryRole', event.target.value === 'Outra' ? '' : event.target.value)
                  }
                >
                  {roleOptions.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </label>
              {customRole && (
                <label className="field">
                  <span>Especifique a função</span>
                  <input
                    required
                    maxLength={80}
                    value={profile.primaryRole === 'Outra' ? '' : profile.primaryRole}
                    onChange={(event) => update('primaryRole', event.target.value)}
                  />
                </label>
              )}
              <TagSelector
                label="Também posso contribuir com"
                onChange={(values) => update('secondaryRoles', values)}
                suggestions={roleOptions.filter(
                  (item) => item !== 'Outra' && item !== profile.primaryRole,
                )}
                values={profile.secondaryRoles}
              />
              <TagSelector
                label="Áreas"
                onChange={(values) => update('areas', values)}
                suggestions={[...new Set([...areaSuggestions, ...skillOptions.areas])]}
                values={profile.areas}
              />
              <TagSelector
                label="Tecnologias"
                onChange={(values) => update('technologies', values)}
                suggestions={skillOptions.technologies}
                values={profile.technologies}
              />
            </div>
          </section>
          <section className="profile-edit-section field-wide">
            <h3>Preferências</h3>
            <div className="profile-edit-grid">
              <TagSelector
                helper="Escolha temas que você gostaria de praticar em projetos."
                label="Quero praticar"
                onChange={(values) => update('interests', values)}
                suggestions={interestSuggestions}
                values={profile.interests}
              />
              <label className="field">
                <span>Disponibilidade semanal</span>
                <span className="hours-input">
                  <input
                    max={80}
                    min={0}
                    type="number"
                    value={availabilityHours(profile.availability)}
                    onChange={(event) =>
                      update(
                        'availability',
                        event.target.value ? `${event.target.value} horas/semana` : '',
                      )
                    }
                  />
                  <span>horas</span>
                </span>
              </label>
            </div>
          </section>
          <section className="profile-edit-section field-wide">
            <h3>Links</h3>
            <div className="profile-edit-grid">
              <label className="field">
                <span>GitHub</span>
                <input
                  type="url"
                  value={profile.links.github ?? ''}
                  onChange={(event) =>
                    update('links', {
                      ...profile.links,
                      github: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                <span>LinkedIn</span>
                <input
                  type="url"
                  value={profile.links.linkedin ?? ''}
                  onChange={(event) =>
                    update('links', {
                      ...profile.links,
                      linkedin: event.target.value,
                    })
                  }
                />
              </label>
            </div>
          </section>
          {invalidLink && (
            <p className="field-error field-wide">Use links HTTP ou HTTPS válidos.</p>
          )}
          <div className="form-actions field-wide">
            <Button disabled={busy} onClick={close}>
              Cancelar
            </Button>
            <Button
              disabled={busy || invalidLink}
              icon={<Save size={17} />}
              type="submit"
              variant="primary"
            >
              {busy ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="profile-layout profile-layout-read">
          <div className="profile-overview">
            <SkillsSection title="Tecnologias" values={savedProfile.technologies} accent />
            <SkillsSection title="Áreas" values={savedProfile.areas} />
            <SkillsSection title="Quero praticar" values={savedProfile.interests} />
          </div>
          <div className="profile-overview">
            <DiscordSection connection={discord} />
            {gamification && <GamificationSection progress={gamification} />}
            <section className="profile-section">
              <div className="profile-section-title">
                <h2>Projetos</h2>
                <span>{currentProjects.length} ativos</span>
              </div>
              {currentProjects.length > 0 ? (
                <ul className="profile-projects">
                  {currentProjects.map((project) => (
                    <li key={project.id}>
                      <strong>{project.name}</strong>
                      <span>{project.status ? projectStatusLabels[project.status] : ''}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted-copy">Nenhuma participação ativa no momento.</p>
              )}
            </section>
            <EvidenceSection evidence={savedProfile.evidence} projects={projects} />
          </div>
        </div>
      )}
    </div>
  );
}
