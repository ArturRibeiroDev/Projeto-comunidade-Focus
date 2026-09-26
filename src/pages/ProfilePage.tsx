import { Save } from 'lucide-react';
import type { FormEvent } from 'react';
import { roleOptions } from '../data/options';
import type { MemberProfile, Project } from '../types';
import { toList } from '../utils/format';
import { EvidenceSection } from '../components/profile/EvidenceSection';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { SkillsSection } from '../components/profile/SkillsSection';
import { Button } from '../components/ui/Button';

function ProfileTagField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return <label className="field field-wide"><span>{label}</span><input value={values.join(', ')} onChange={(event) => onChange(toList(event.target.value))} /></label>;
}

export function ProfilePage({ profile, projects, onChange, onSubmit }: {
  profile: MemberProfile;
  projects: Project[];
  onChange: (profile: MemberProfile) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = <Key extends keyof MemberProfile>(key: Key, value: MemberProfile[Key]) => onChange({ ...profile, [key]: value });
  const currentProjects = projects.filter((project) => project.members.some((member) => member.memberId === profile.id));

  return (
    <div className="page-stack content-narrow">
      <ProfileHeader profile={profile} />
      <div className="profile-layout">
        <div className="profile-overview">
          <SkillsSection title="Tecnologias" values={profile.technologies} accent />
          <SkillsSection title="Áreas" values={profile.areas} />
          <SkillsSection title="Interesses" values={profile.interests} />
          <section className="profile-section"><div className="profile-section-title"><h2>Projetos</h2><span>{currentProjects.length} ativos</span></div>{currentProjects.length > 0 ? <ul className="profile-projects">{currentProjects.map((project) => <li key={project.id}><strong>{project.name}</strong><span>{project.status}</span></li>)}</ul> : <p className="muted-copy">Nenhuma participação ativa no momento.</p>}</section>
          <EvidenceSection evidence={profile.evidence} projects={projects} />
        </div>

        <form className="structured-form profile-form" onSubmit={onSubmit}>
          <div className="form-intro field-wide"><h2>Editar perfil</h2><p>Mantenha suas competências e disponibilidade atualizadas.</p></div>
          <label className="field"><span>Nome</span><input required value={profile.name} onChange={(event) => update('name', event.target.value)} /></label>
          <label className="field"><span>Avatar</span><input required value={profile.avatarUrl} onChange={(event) => update('avatarUrl', event.target.value)} /></label>
          <label className="field field-wide"><span>Bio curta</span><textarea rows={4} value={profile.bio} onChange={(event) => update('bio', event.target.value)} /></label>
          <label className="field"><span>Função principal</span><select value={profile.primaryRole} onChange={(event) => update('primaryRole', event.target.value)}>{roleOptions.map((role) => <option value={role} key={role}>{role}</option>)}</select></label>
          <label className="field"><span>Disponibilidade</span><input value={profile.availability} onChange={(event) => update('availability', event.target.value)} /></label>
          <ProfileTagField label="Áreas" values={profile.areas} onChange={(values) => update('areas', values)} />
          <ProfileTagField label="Funções secundárias" values={profile.secondaryRoles} onChange={(values) => update('secondaryRoles', values)} />
          <ProfileTagField label="Tecnologias" values={profile.technologies} onChange={(values) => update('technologies', values)} />
          <ProfileTagField label="Interesses" values={profile.interests} onChange={(values) => update('interests', values)} />
          <label className="field"><span>GitHub</span><input type="url" value={profile.links.github ?? ''} onChange={(event) => update('links', { ...profile.links, github: event.target.value })} /></label>
          <label className="field"><span>LinkedIn</span><input type="url" value={profile.links.linkedin ?? ''} onChange={(event) => update('links', { ...profile.links, linkedin: event.target.value })} /></label>
          <div className="form-actions field-wide"><Button icon={<Save size={17} />} type="submit" variant="primary">Salvar perfil</Button></div>
        </form>
      </div>
    </div>
  );
}
